import { all, get, insert, one, run, update } from '../lib/db.js';
import { addDays, badRequest, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { canSeeEmployee, reportTreeIds, visibleEmployeeIds } from '../lib/scope.js';
import { employeeCard, maps } from './_shared.js';

export function register(router) {
  // --- goals / KRA ---------------------------------------------------------
  router.get('/api/goals', (ctx) => {
    const q = ctx.query;
    const m = maps();
    const where = ['g.company_id = ?'];
    const args = [ctx.actor.company_id];
    const scope = q.scope || 'mine';
    if (scope === 'mine') {
      where.push('g.employee_id = ?');
      args.push(ctx.actor.id);
    } else {
      const ids = visibleEmployeeIds(ctx.actor);
      if (scope === 'team') {
        const teamIds = reportTreeIds(ctx.actor.id, false);
        if (!teamIds.length) where.push('1 = 0');
        else {
          where.push(`g.employee_id IN (${teamIds.map(() => '?').join(',')})`);
          args.push(...teamIds);
        }
      } else if (ids !== null) {
        if (!ids.length) where.push('1 = 0');
        else {
          where.push(`g.employee_id IN (${ids.map(() => '?').join(',')})`);
          args.push(...ids);
        }
      }
    }
    if (q.employee_id) {
      if (!canSeeEmployee(ctx.actor, Number(q.employee_id))) throw badRequest('No access to this employee');
      where.push('g.employee_id = ?');
      args.push(Number(q.employee_id));
    }
    if (q.status) {
      where.push('g.status = ?');
      args.push(q.status);
    }
    if (q.category) {
      where.push('g.category = ?');
      args.push(q.category);
    }
    const rows = all(
      `SELECT g.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji
       FROM goals g JOIN employees e ON e.id = g.employee_id WHERE ${where.join(' AND ')} ORDER BY g.created_at DESC LIMIT 200`,
      ...args
    );
    const goalIds = rows.map((r) => r.id);
    const krs = goalIds.length ? all(`SELECT * FROM key_results WHERE goal_id IN (${goalIds.map(() => '?').join(',')})`, ...goalIds) : [];
    return {
      rows: rows.map((g) => ({
        ...g,
        full_name: `${g.first_name} ${g.last_name || ''}`.trim(),
        keyResults: krs.filter((k) => k.goal_id === g.id).map((k) => ({ ...k, percent: k.target ? Math.min(100, Math.round((k.current / k.target) * 100)) : 0 }))
      })),
      totals: {
        count: rows.length,
        avgProgress: rows.length ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length) : 0,
        atRisk: rows.filter((r) => ['at_risk', 'behind'].includes(r.status)).length,
        ahead: rows.filter((r) => r.status === 'ahead').length,
        weight: rows.reduce((s, r) => s + (r.weight || 0), 0)
      }
    };
  });

  router.post('/api/goals', (ctx) => {
    const { title, description, category = 'business', weight = 25, due_date, start_date, employee_id = null, keyResults = [] } = ctx.body;
    const targetId = employee_id || ctx.actor.id;
    if (targetId !== ctx.actor.id) requirePerm(ctx, 'goal.manage_team');
    if (!title) throw badRequest('Goal title is required');
    const id = insert('goals', {
      company_id: ctx.actor.company_id,
      employee_id: targetId,
      title,
      description: description || null,
      category,
      weight: Number(weight),
      progress: 0,
      status: 'on_track',
      start_date: start_date || today(),
      due_date: due_date || addDays(today(), 90),
      owner_id: ctx.actor.id
    });
    for (const kr of keyResults) {
      insert('key_results', {
        goal_id: id,
        title: kr.title,
        metric: kr.metric || 'percentage',
        target: Number(kr.target || 100),
        current: 0,
        unit: kr.unit || '%',
        due_date: kr.due_date || null,
        status: 'on_track',
        updated_at: nowIso()
      });
    }
    audit(ctx, 'goal.create', 'goal', id, `Created goal “${title}”`);
    if (targetId !== ctx.actor.id) push(targetId, { type: 'goal', title: 'New goal assigned', body: title, icon: '🎯', link: '#/goals' });
    return { id };
  });

  router.patch('/api/goals/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const goal = get('SELECT * FROM goals WHERE id = ?', id);
    if (!goal) throw notFound('Goal not found');
    if (goal.employee_id !== ctx.actor.id) requirePerm(ctx, 'goal.manage_team');
    update('goals', id, ctx.body);
    if (ctx.body.progress !== undefined) {
      const progress = Number(ctx.body.progress);
      update('goals', id, { status: progress >= 80 ? 'ahead' : progress >= 50 ? 'on_track' : progress >= 25 ? 'at_risk' : 'behind' });
    }
    audit(ctx, 'goal.update', 'goal', id, `Updated goal “${goal.title}”`);
    return { ok: true };
  });

  router.delete('/api/goals/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const goal = get('SELECT * FROM goals WHERE id = ?', id);
    if (!goal) throw notFound('Goal not found');
    if (goal.employee_id !== ctx.actor.id) requirePerm(ctx, 'goal.manage_company');
    run('DELETE FROM goals WHERE id = ?', id);
    audit(ctx, 'goal.delete', 'goal', id, `Deleted goal “${goal.title}”`, { severity: 'warning' });
    return { ok: true };
  });

  // --- key results ---------------------------------------------------------
  router.post('/api/key-results', (ctx) => {
    const { goal_id, title, target = 100, unit = '%', metric = 'percentage', due_date = null } = ctx.body;
    const goal = get('SELECT * FROM goals WHERE id = ?', goal_id);
    if (!goal) throw notFound('Goal not found');
    if (goal.employee_id !== ctx.actor.id) requirePerm(ctx, 'goal.manage_team');
    const id = insert('key_results', { goal_id, title, target: Number(target), current: 0, unit, metric, due_date, status: 'on_track', updated_at: nowIso() });
    audit(ctx, 'key_result.create', 'key_result', id, `Added key result to goal #${goal_id}`);
    return { id };
  });

  router.patch('/api/key-results/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const kr = get('SELECT * FROM key_results WHERE id = ?', id);
    if (!kr) throw notFound('Key result not found');
    const goal = get('SELECT * FROM goals WHERE id = ?', kr.goal_id);
    if (goal.employee_id !== ctx.actor.id) requirePerm(ctx, 'goal.manage_team');
    const patch = { ...ctx.body, updated_at: nowIso() };
    if (patch.current !== undefined) {
      const percent = kr.target ? (patch.current / kr.target) * 100 : 0;
      patch.status = percent >= 80 ? 'ahead' : percent >= 50 ? 'on_track' : percent >= 25 ? 'at_risk' : 'behind';
    }
    update('key_results', id, patch);
    // roll up goal progress from key results
    const siblings = all('SELECT * FROM key_results WHERE goal_id = ?', kr.goal_id);
    if (siblings.length) {
      const avg = siblings.reduce((s, k) => s + Math.min(100, ((Number(k.current) || 0) / (Number(k.target) || 1)) * 100), 0) / siblings.length;
      update('goals', kr.goal_id, {
        progress: Math.round(avg),
        status: avg >= 80 ? 'ahead' : avg >= 50 ? 'on_track' : avg >= 25 ? 'at_risk' : 'behind'
      });
    }
    return { ok: true };
  });

  router.delete('/api/key-results/:id', (ctx) => {
    run('DELETE FROM key_results WHERE id = ?', Number(ctx.params.id));
    return { ok: true };
  });

  // --- review cycles & reviews --------------------------------------------
  router.get('/api/review-cycles', (ctx) => ({
    rows: all('SELECT * FROM review_cycles WHERE company_id = ? ORDER BY start_date DESC', ctx.actor.company_id).map((c) => ({
      ...c,
      reviews: one('SELECT COUNT(*) FROM reviews WHERE cycle_id = ?', c.id),
      completed: one("SELECT COUNT(*) FROM reviews WHERE cycle_id = ? AND status = 'published'", c.id),
      avgRating: Number((one('SELECT AVG(rating) FROM reviews WHERE cycle_id = ? AND rating IS NOT NULL', c.id) || 0).toFixed(2))
    }))
  }));

  router.post('/api/review-cycles', (ctx) => {
    requirePerm(ctx, 'performance.manage');
    const { name, period, start_date, end_date } = ctx.body;
    if (!name) throw badRequest('Cycle name is required');
    const id = insert('review_cycles', { company_id: ctx.actor.company_id, name, period: period || null, start_date: start_date || today(), end_date: end_date || null, status: 'active' });
    audit(ctx, 'review_cycle.create', 'review_cycle', id, `Created review cycle ${name}`);
    return { id };
  });

  router.get('/api/reviews', (ctx) => {
    const q = ctx.query;
    const where = ['r.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (q.scope === 'mine') {
      where.push('(r.employee_id = ? OR r.reviewer_id = ?)');
      args.push(ctx.actor.id, ctx.actor.id);
    } else if (q.employee_id) {
      if (!canSeeEmployee(ctx.actor, Number(q.employee_id))) throw badRequest('No access to this employee');
      where.push('r.employee_id = ?');
      args.push(Number(q.employee_id));
    } else {
      const ids = visibleEmployeeIds(ctx.actor);
      if (ids !== null) {
        if (!ids.length) where.push('1 = 0');
        else {
          where.push(`r.employee_id IN (${ids.map(() => '?').join(',')})`);
          args.push(...ids);
        }
      }
    }
    if (q.cycle_id) {
      where.push('r.cycle_id = ?');
      args.push(Number(q.cycle_id));
    }
    if (q.status) {
      where.push('r.status = ?');
      args.push(q.status);
    }
    const rows = all(
      `SELECT r.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji, e.department_id,
              rv.first_name AS reviewer_first, rv.last_name AS reviewer_last, c.name AS cycle_name, c.period
       FROM reviews r JOIN employees e ON e.id = r.employee_id
       LEFT JOIN employees rv ON rv.id = r.reviewer_id
       LEFT JOIN review_cycles c ON c.id = r.cycle_id
       WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 200`,
      ...args
    );
    const m = maps();
    return {
      rows: rows.map((r) => ({
        ...r,
        full_name: `${r.first_name} ${r.last_name || ''}`.trim(),
        reviewer_name: r.reviewer_first ? `${r.reviewer_first} ${r.reviewer_last || ''}`.trim() : null,
        department: m.depts[r.department_id]?.name,
        strengths: JSON.parse(r.strengths || '[]'),
        improvements: JSON.parse(r.improvements || '[]'),
        composite: r.rating ? Number(r.rating).toFixed(1) : null
      })),
      totals: {
        count: rows.length,
        avgRating: rows.length ? Number((rows.filter((r) => r.rating).reduce((s, r) => s + r.rating, 0) / Math.max(1, rows.filter((r) => r.rating).length)).toFixed(2)) : 0,
        published: rows.filter((r) => r.status === 'published').length,
        pending: rows.filter((r) => ['draft', 'in_progress'].includes(r.status)).length
      },
      distribution: [1, 2, 3, 4, 5].map((band) => ({
        band,
        count: rows.filter((r) => r.rating && Math.round(r.rating) === band).length
      }))
    };
  });

  router.post('/api/reviews', (ctx) => {
    requirePerm(ctx, 'performance.manage');
    const { employee_id, cycle_id, rating, strengths = [], improvements = [], summary, status = 'draft', self_rating = null, productivity, quality, teamwork, initiative, reliability } = ctx.body;
    if (!employee_id) throw badRequest('employee_id is required');
    const id = insert('reviews', {
      company_id: ctx.actor.company_id,
      cycle_id: cycle_id || one("SELECT id FROM review_cycles WHERE company_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", ctx.actor.company_id),
      employee_id,
      reviewer_id: ctx.actor.id,
      rating: rating ?? null,
      potential: ctx.body.potential ?? 3,
      productivity: productivity || 70,
      quality: quality || 70,
      teamwork: teamwork || 70,
      initiative: initiative || 70,
      reliability: reliability || 70,
      strengths,
      improvements,
      summary: summary || null,
      status,
      self_rating,
      created_at: nowIso()
    });
    audit(ctx, 'review.create', 'review', id, `Created review for employee #${employee_id}`);
    return { id };
  });

  router.patch('/api/reviews/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const review = get('SELECT * FROM reviews WHERE id = ?', id);
    if (!review) throw notFound('Review not found');
    const patch = { ...ctx.body };
    if (patch.status === 'published') patch.ack = 0;
    update('reviews', id, patch);
    if (patch.status === 'published') {
      push(review.employee_id, { type: 'performance', title: 'Performance review published', body: 'Your latest review is ready to read.', icon: '📈', link: '#/performance' });
    }
    audit(ctx, `review.${patch.status || 'update'}`, 'review', id, `Review #${id} ${patch.status || 'updated'}`);
    return { ok: true };
  });

  router.post('/api/reviews/:id/acknowledge', (ctx) => {
    const id = Number(ctx.params.id);
    update('reviews', id, { ack: 1, self_rating: ctx.body.self_rating ?? get('SELECT self_rating FROM reviews WHERE id = ?', id) });
    audit(ctx, 'review.acknowledge', 'review', id, 'Employee acknowledged review');
    return { ok: true };
  });

  router.delete('/api/reviews/:id', (ctx) => {
    requirePerm(ctx, 'performance.manage');
    run('DELETE FROM reviews WHERE id = ?', Number(ctx.params.id));
    audit(ctx, 'review.delete', 'review', Number(ctx.params.id), 'Review deleted', { severity: 'warning' });
    return { ok: true };
  });
}
