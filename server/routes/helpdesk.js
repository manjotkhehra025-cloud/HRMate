import { all, get, insert, one, run, update } from '../lib/db.js';
import { addDays, badRequest, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { canSeeEmployee, visibleEmployeeIds } from '../lib/scope.js';

const CATEGORIES = [
  { key: 'it', label: 'IT & Devices', icon: '🖥️' },
  { key: 'hr', label: 'HR & Payroll', icon: '🧑‍💼' },
  { key: 'payroll', label: 'Payroll', icon: '💵' },
  { key: 'facilities', label: 'Facilities', icon: '🏢' },
  { key: 'finance', label: 'Finance', icon: '📊' },
  { key: 'admin', label: 'Admin', icon: '🗂️' },
  { key: 'access', label: 'Access & Security', icon: '🔐' }
];

export function register(router) {
  router.get('/api/tickets', (ctx) => {
    const q = ctx.query;
    const where = ['t.company_id = ?'];
    const args = [ctx.actor.company_id];
    const scope = q.scope || 'mine';
    if (scope === 'mine') {
      where.push('t.employee_id = ?');
      args.push(ctx.actor.id);
    } else if (scope === 'assigned') {
      where.push('(t.assignee_id = ? OR t.status IN (?, ?))');
      args.push(ctx.actor.id, 'open', 'escalated');
    } else {
      const ids = visibleEmployeeIds(ctx.actor);
      if (scope === 'team' && ids !== null) {
        if (!ids.length) where.push('1 = 0');
        else {
          where.push(`t.employee_id IN (${ids.map(() => '?').join(',')})`);
          args.push(...ids);
        }
      } else if (scope === 'all') {
        requirePerm(ctx, 'ticket.view_all');
      }
    }
    if (q.status) {
      where.push('t.status = ?');
      args.push(q.status);
    }
    if (q.category) {
      where.push('t.category = ?');
      args.push(q.category);
    }
    if (q.priority) {
      where.push('t.priority = ?');
      args.push(q.priority);
    }
    if (q.search) {
      where.push('(t.subject LIKE ? OR t.body LIKE ?)');
      args.push(`%${q.search}%`, `%${q.search}%`);
    }
    const rows = all(
      `SELECT t.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji,
              a.first_name AS assignee_first, a.last_name AS assignee_last,
              (SELECT COUNT(*) FROM comments c WHERE c.ticket_id = t.id) AS comment_count
       FROM tickets t JOIN employees e ON e.id = t.employee_id LEFT JOIN employees a ON a.id = t.assignee_id
       WHERE ${where.join(' AND ')} ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'escalated' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, t.created_at DESC LIMIT 200`,
      ...args
    );
    return {
      rows: rows.map((t) => ({
        ...t,
        requester: `${t.first_name} ${t.last_name || ''}`.trim(),
        assignee: t.assignee_first ? `${t.assignee_first} ${t.assignee_last || ''}`.trim() : null,
        slaHours: Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000)
      })),
      categories: CATEGORIES,
      totals: {
        open: rows.filter((t) => t.status === 'open').length,
        inProgress: rows.filter((t) => t.status === 'in_progress').length,
        resolved: rows.filter((t) => ['resolved', 'closed'].includes(t.status)).length,
        escalated: rows.filter((t) => t.status === 'escalated').length,
        breached: rows.filter((t) => !['resolved', 'closed'].includes(t.status) && Date.now() - new Date(t.created_at).getTime() > 24 * 3600000).length
      }
    };
  });

  router.get('/api/tickets/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const ticket = get('SELECT t.*, e.first_name, e.last_name, e.designation, e.avatar_color FROM tickets t JOIN employees e ON e.id = t.employee_id WHERE t.id = ?', id);
    if (!ticket) throw notFound('Ticket not found');
    if (ticket.employee_id !== ctx.actor.id && ticket.assignee_id !== ctx.actor.id) {
      if (!canSeeEmployee(ctx.actor, ticket.employee_id)) requirePerm(ctx, 'ticket.view_all');
    }
    const comments = all('SELECT c.*, e.first_name, e.last_name, e.avatar_color, e.designation FROM comments c JOIN employees e ON e.id = c.employee_id WHERE c.ticket_id = ? ORDER BY c.created_at', id);
    return {
      ticket: { ...ticket, requester: `${ticket.first_name} ${ticket.last_name || ''}`.trim() },
      comments: comments.map((c) => ({ ...c, author: `${c.first_name} ${c.last_name || ''}`.trim() })),
      categories: CATEGORIES
    };
  });

  router.post('/api/tickets', (ctx) => {
    const { subject, body, category = 'it', priority = 'medium', employee_id = null, due_date = null } = ctx.body;
    if (!subject) throw badRequest('Subject is required');
    const targetId = employee_id || ctx.actor.id;
    if (targetId !== ctx.actor.id) requirePerm(ctx, 'ticket.assign');
    const id = insert('tickets', {
      company_id: ctx.actor.company_id,
      employee_id: targetId,
      assignee_id: null,
      subject,
      body: body || null,
      category,
      priority,
      status: 'open',
      due_date: due_date || addDays(today(), priority === 'high' ? 1 : 3),
      created_at: nowIso(),
      updated_at: nowIso()
    });
    const admins = all("SELECT id FROM employees WHERE company_id = ? AND role IN ('hr_admin','hr_manager','supervisor') LIMIT 3", ctx.actor.company_id);
    for (const a of admins) push(a.id, { type: 'ticket', title: `New ${category} ticket`, body: subject, icon: '🎫', link: '#/helpdesk', priority: priority === 'high' ? 'high' : 'normal' });
    audit(ctx, 'ticket.create', 'ticket', id, `Raised ticket “${subject}”`);
    return { id };
  });

  router.patch('/api/tickets/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const ticket = get('SELECT * FROM tickets WHERE id = ?', id);
    if (!ticket) throw notFound('Ticket not found');
    const patch = { ...ctx.body, updated_at: nowIso() };
    if (patch.status && !['open', 'in_progress', 'resolved', 'closed', 'escalated'].includes(patch.status)) throw badRequest('Invalid status');
    if (patch.status === 'resolved' && !patch.resolved_at) patch.resolved_at = nowIso();
    if ((patch.assignee_id !== undefined || patch.status !== undefined) && ticket.employee_id !== ctx.actor.id) requirePerm(ctx, 'ticket.assign');
    update('tickets', id, patch);
    audit(ctx, 'ticket.update', 'ticket', id, `Ticket #${id} → ${patch.status || 'updated'}`);
    push(ticket.employee_id, {
      type: 'ticket',
      title: patch.status === 'resolved' ? 'Ticket resolved ✅' : 'Ticket updated',
      body: ticket.subject,
      icon: '🎫',
      link: '#/helpdesk'
    });
    return { ok: true };
  });

  router.post('/api/tickets/:id/comments', (ctx) => {
    const id = Number(ctx.params.id);
    const ticket = get('SELECT * FROM tickets WHERE id = ?', id);
    if (!ticket) throw notFound('Ticket not found');
    const { body } = ctx.body;
    if (!body) throw badRequest('Comment cannot be empty');
    const commentId = insert('comments', { ticket_id: id, employee_id: ctx.actor.id, body: String(body).slice(0, 1000), created_at: nowIso() });
    update('tickets', id, { updated_at: nowIso(), status: ticket.status === 'open' && ctx.actor.id !== ticket.employee_id ? 'in_progress' : ticket.status });
    if (ticket.employee_id !== ctx.actor.id) {
      push(ticket.employee_id, { type: 'ticket', title: 'New reply on your ticket', body: `${ctx.actor.first_name}: ${String(body).slice(0, 90)}`, icon: '💬', link: '#/helpdesk' });
    }
    return { id: commentId };
  });

  router.post('/api/tickets/:id/rate', (ctx) => {
    const id = Number(ctx.params.id);
    const { rating } = ctx.body;
    if (!rating || rating < 1 || rating > 5) throw badRequest('rating must be 1-5');
    update('tickets', id, { rating: Number(rating), status: 'closed', resolved_at: nowIso() });
    audit(ctx, 'ticket.rate', 'ticket', id, `Ticket rated ${rating}/5`);
    return { ok: true };
  });

  router.delete('/api/tickets/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const ticket = get('SELECT * FROM tickets WHERE id = ?', id);
    if (!ticket) throw notFound('Ticket not found');
    if (ticket.employee_id !== ctx.actor.id) requirePerm(ctx, 'ticket.view_all');
    run('DELETE FROM tickets WHERE id = ?', id);
    audit(ctx, 'ticket.delete', 'ticket', id, 'Ticket deleted', { severity: 'warning' });
    return { ok: true };
  });
}
