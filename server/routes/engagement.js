import { all, get, insert, one, run, update } from '../lib/db.js';
import { badRequest, notFound, nowIso } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push, pushMany } from '../lib/notify.js';
import { scopeIdsOrDefault, visibleEmployeeIds } from '../lib/scope.js';

export function register(router) {
  // --- announcements -------------------------------------------------------
  router.get('/api/announcements', (ctx) => {
    const rows = all('SELECT a.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji FROM announcements a LEFT JOIN employees e ON e.id = a.author_id WHERE a.company_id = ? ORDER BY a.pinned DESC, a.publish_at DESC LIMIT 100', ctx.actor.company_id);
    return {
      rows: rows.map((a) => ({ ...a, author: a.first_name ? `${a.first_name} ${a.last_name || ''}`.trim() : 'HRMate' })),
      unread: rows.filter((a) => a.pinned).length
    };
  });

  router.post('/api/announcements', (ctx) => {
    requirePerm(ctx, 'announcement.manage');
    const { title, body, category = 'general', audience = 'all', pinned = false, priority = 'normal' } = ctx.body;
    if (!title || !body) throw badRequest('Title and body are required');
    const id = insert('announcements', {
      company_id: ctx.actor.company_id,
      title,
      body,
      category,
      audience,
      pinned: pinned ? 1 : 0,
      priority,
      author_id: ctx.actor.id,
      publish_at: nowIso(),
      created_at: nowIso()
    });
    audit(ctx, 'announcement.create', 'announcement', id, `Published “${title}”`);
    pushMany(scopeIdsOrDefault(ctx.actor), {
      type: 'announcement',
      title,
      body: String(body).slice(0, 140),
      icon: '📣',
      link: '#/announcements',
      priority
    });
    return { id };
  });

  router.patch('/api/announcements/:id', (ctx) => {
    requirePerm(ctx, 'announcement.manage');
    update('announcements', Number(ctx.params.id), ctx.body);
    audit(ctx, 'announcement.update', 'announcement', Number(ctx.params.id), 'Announcement updated');
    return { ok: true };
  });

  router.delete('/api/announcements/:id', (ctx) => {
    requirePerm(ctx, 'announcement.manage');
    run('DELETE FROM announcements WHERE id = ?', Number(ctx.params.id));
    audit(ctx, 'announcement.delete', 'announcement', Number(ctx.params.id), 'Announcement deleted', { severity: 'warning' });
    return { ok: true };
  });

  // --- social wall ---------------------------------------------------------
  router.get('/api/posts', (ctx) => {
    const limit = Math.min(60, Number(ctx.query.limit) || 20);
    const offset = Number(ctx.query.offset) || 0;
    const where = ['p.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (ctx.query.tag) {
      where.push('p.tag = ?');
      args.push(ctx.query.tag);
    }
    if (ctx.query.employee_id) {
      where.push('p.employee_id = ?');
      args.push(Number(ctx.query.employee_id));
    }
    const rows = all(
      `SELECT p.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji, e.department_id, d.name AS department
       FROM posts p JOIN employees e ON e.id = p.employee_id LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      ...args,
      limit,
      offset
    );
    const postIds = rows.map((r) => r.id);
    const comments = postIds.length ? all(`SELECT c.*, e.first_name, e.last_name, e.avatar_color FROM comments c JOIN employees e ON e.id = c.employee_id WHERE c.post_id IN (${postIds.map(() => '?').join(',')}) ORDER BY c.created_at`, ...postIds) : [];
    const likes = postIds.length ? all(`SELECT post_id, employee_id FROM post_likes WHERE post_id IN (${postIds.map(() => '?').join(',')})`, ...postIds) : [];
    const total = one(`SELECT COUNT(*) FROM posts p WHERE ${where.join(' AND ')}`, ...args);
    return {
      rows: rows.map((p) => ({
        ...p,
        author: `${p.first_name} ${p.last_name || ''}`.trim(),
        liked: likes.some((l) => l.post_id === p.id && l.employee_id === ctx.actor.id),
        comments: comments.filter((c) => c.post_id === p.id).map((c) => ({ ...c, author: `${c.first_name} ${c.last_name || ''}`.trim() }))
      })),
      total,
      tags: all('SELECT tag, COUNT(*) AS count FROM posts WHERE company_id = ? GROUP BY tag ORDER BY count DESC', ctx.actor.company_id)
    };
  });

  router.post('/api/posts', (ctx) => {
    requirePerm(ctx, 'post.create');
    const { body, tag = 'general', image_url = null } = ctx.body;
    if (!body || !String(body).trim()) throw badRequest('Post body cannot be empty');
    const id = insert('posts', {
      company_id: ctx.actor.company_id,
      employee_id: ctx.actor.id,
      body: String(body).slice(0, 2000),
      tag,
      image_url,
      likes: 0,
      comments_count: 0,
      created_at: nowIso()
    });
    audit(ctx, 'post.create', 'post', id, 'Published a post on the social wall');
    return { id };
  });

  router.post('/api/posts/:id/like', (ctx) => {
    const id = Number(ctx.params.id);
    const post = get('SELECT * FROM posts WHERE id = ?', id);
    if (!post) throw notFound('Post not found');
    const existing = get('SELECT * FROM post_likes WHERE post_id = ? AND employee_id = ?', id, ctx.actor.id);
    if (existing) {
      run('DELETE FROM post_likes WHERE post_id = ? AND employee_id = ?', id, ctx.actor.id);
      update('posts', id, { likes: Math.max(0, post.likes - 1) });
      return { liked: false, likes: Math.max(0, post.likes - 1) };
    }
    insert('post_likes', { post_id: id, employee_id: ctx.actor.id });
    update('posts', id, { likes: post.likes + 1 });
    if (post.employee_id !== ctx.actor.id) {
      push(post.employee_id, { type: 'social', title: 'Someone liked your post', body: `${ctx.actor.first_name} reacted to your post.`, icon: '❤️', link: '#/social' });
    }
    return { liked: true, likes: post.likes + 1 };
  });

  router.post('/api/posts/:id/comments', (ctx) => {
    const id = Number(ctx.params.id);
    const post = get('SELECT * FROM posts WHERE id = ?', id);
    if (!post) throw notFound('Post not found');
    const { body } = ctx.body;
    if (!body) throw badRequest('Comment cannot be empty');
    const commentId = insert('comments', { post_id: id, employee_id: ctx.actor.id, body: String(body).slice(0, 800), created_at: nowIso() });
    update('posts', id, { comments_count: post.comments_count + 1 });
    if (post.employee_id !== ctx.actor.id) {
      push(post.employee_id, { type: 'social', title: 'New comment', body: `${ctx.actor.first_name}: ${String(body).slice(0, 80)}`, icon: '💬', link: '#/social' });
    }
    return { id: commentId };
  });

  router.delete('/api/posts/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const post = get('SELECT * FROM posts WHERE id = ?', id);
    if (!post) throw notFound('Post not found');
    if (post.employee_id !== ctx.actor.id) requirePerm(ctx, 'post.delete_any');
    run('DELETE FROM posts WHERE id = ?', id);
    audit(ctx, 'post.delete', 'post', id, 'Post deleted', { severity: 'warning' });
    return { ok: true };
  });

  // --- kudos / star workers ------------------------------------------------
  router.get('/api/kudos', (ctx) => {
    const q = ctx.query;
    const where = ['k.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (q.scope === 'received') {
      where.push('k.to_employee_id = ?');
      args.push(ctx.actor.id);
    } else if (q.scope === 'given') {
      where.push('k.from_employee_id = ?');
      args.push(ctx.actor.id);
    } else {
      const ids = visibleEmployeeIds(ctx.actor);
      if (ids !== null) {
        where.push(`(k.to_employee_id IN (${ids.length ? ids.map(() => '?').join(',') : 'NULL'}) OR k.from_employee_id IN (${ids.length ? ids.map(() => '?').join(',') : 'NULL'}))`);
        if (ids.length) args.push(...ids, ...ids);
      }
    }
    const rows = all(
      `SELECT k.*, f.first_name AS from_first, f.last_name AS from_last, f.avatar_color AS from_color, f.avatar_emoji AS from_emoji,
              t.first_name AS to_first, t.last_name AS to_last, t.designation AS to_designation, t.avatar_color AS to_color, t.avatar_emoji AS to_emoji,
              d.name AS department
       FROM kudos k JOIN employees f ON f.id = k.from_employee_id JOIN employees t ON t.id = k.to_employee_id
       LEFT JOIN departments d ON d.id = t.department_id
       WHERE ${where.join(' AND ')} ORDER BY k.created_at DESC LIMIT 100`,
      ...args
    );
    return {
      rows: rows.map((k) => ({
        ...k,
        from_name: `${k.from_first} ${k.from_last || ''}`.trim(),
        to_name: `${k.to_first} ${k.to_last || ''}`.trim()
      })),
      values: all('SELECT value, COUNT(*) AS count FROM kudos WHERE company_id = ? GROUP BY value ORDER BY count DESC', ctx.actor.company_id),
      totals: {
        received: one('SELECT COUNT(*) FROM kudos WHERE to_employee_id = ?', ctx.actor.id),
        given: one('SELECT COUNT(*) FROM kudos WHERE from_employee_id = ?', ctx.actor.id),
        points: one('SELECT COALESCE(SUM(points),0) FROM kudos WHERE to_employee_id = ?', ctx.actor.id)
      }
    };
  });

  router.post('/api/kudos', (ctx) => {
    requirePerm(ctx, 'kudos.give');
    const { to_employee_id, value, message, points = 5, badge = null } = ctx.body;
    if (!to_employee_id) throw badRequest('Choose who to recognise');
    if (Number(to_employee_id) === ctx.actor.id) throw badRequest('You cannot send kudos to yourself');
    if (!value) throw badRequest('Pick a value to recognise');
    const target = get('SELECT * FROM employees WHERE id = ?', to_employee_id);
    if (!target) throw notFound('Employee not found');
    const id = insert('kudos', {
      company_id: ctx.actor.company_id,
      from_employee_id: ctx.actor.id,
      to_employee_id,
      value,
      message: message || null,
      points: Number(points),
      badge,
      created_at: nowIso()
    });
    audit(ctx, 'kudos.give', 'kudos', id, `Recognised ${target.first_name} for ${value}`);
    push(to_employee_id, {
      type: 'kudos',
      title: 'You earned kudos! 🌟',
      body: `${ctx.actor.first_name} recognised you for ${value}.`,
      icon: '🌟',
      link: '#/star-workers'
    });
    return { id };
  });

  router.get('/api/star-workers', (ctx) => {
    const period = ctx.query.period || '90';
    const rows = all(
      `SELECT t.id, t.first_name, t.last_name, t.designation, t.department_id, t.avatar_color, t.avatar_emoji,
              COUNT(k.id) AS kudos_count, COALESCE(SUM(k.points),0) AS points
       FROM employees t LEFT JOIN kudos k ON k.to_employee_id = t.id AND k.created_at >= date('now', ?)
       WHERE t.company_id = ? AND t.status != 'terminated'
       GROUP BY t.id ORDER BY points DESC, kudos_count DESC LIMIT 25`,
      `-${Number(period)} day`,
      ctx.actor.company_id
    );
    const badges = all(
      `SELECT t.id, t.first_name, t.last_name, k.badge, COUNT(*) AS count FROM kudos k JOIN employees t ON t.id = k.to_employee_id
       WHERE k.badge IS NOT NULL AND k.created_at >= date('now', ?) GROUP BY t.id, k.badge ORDER BY count DESC LIMIT 12`,
      `-${Number(period)} day`
    );
    const departments = all(
      `SELECT d.name, COUNT(k.id) AS count, COALESCE(SUM(k.points),0) AS points
       FROM departments d LEFT JOIN employees e ON e.department_id = d.id
       LEFT JOIN kudos k ON k.to_employee_id = e.id AND k.created_at >= date('now', ?)
       WHERE d.company_id = ? GROUP BY d.id ORDER BY points DESC LIMIT 8`,
      `-${Number(period)} day`,
      ctx.actor.company_id
    );
    return {
      leaderboard: rows.map((r, i) => ({ ...r, rank: i + 1, full_name: `${r.first_name} ${r.last_name || ''}`.trim(), points: Number(r.points) })),
      badges: badges.map((b) => ({ ...b, full_name: `${b.first_name} ${b.last_name || ''}`.trim() })),
      departments,
      myRank: (() => {
        const idx = rows.findIndex((r) => r.id === ctx.actor.id);
        return idx >= 0 ? { rank: idx + 1, points: Number(rows[idx].points), kudos: rows[idx].kudos_count } : null;
      })()
    };
  });
}
