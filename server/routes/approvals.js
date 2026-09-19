import { all, get, insert, one, run, update } from '../lib/db.js';
import { badRequest, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { employeeLabel, reportTreeIds, visibleEmployeeIds } from '../lib/scope.js';
import { maps } from './_shared.js';

function loadReference(type, refId) {
  switch (type) {
    case 'leave':
      return get(
        `SELECT lr.*, lt.name AS leave_name, lt.color, lt.icon FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?`,
        refId
      );
    case 'shift_swap':
      return get(`SELECT s.*, sh.name AS shift_name FROM swap_requests s LEFT JOIN shifts sh ON sh.id = s.shift_id WHERE s.id = ?`, refId);
    case 'overtime':
      return get('SELECT * FROM overtime_requests WHERE id = ?', refId);
    case 'expense':
      return get('SELECT * FROM expenses WHERE id = ?', refId);
    case 'regularization':
      return get('SELECT * FROM attendance WHERE id = ?', refId);
    default:
      return null;
  }
}

function applyDecision(approval, action, note, actor) {
  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
  const ref = loadReference(approval.type, approval.ref_id);
  switch (approval.type) {
    case 'leave': {
      if (!ref) break;
      if (status === 'approved') {
        update('leave_requests', ref.id, { status, decided_at: nowIso(), approver_id: actor.id, decision_note: note || null });
        const bal = get('SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', ref.employee_id, ref.leave_type_id, Number(ref.start_date.slice(0, 4)));
        if (bal) update('leave_balances', bal.id, { used: bal.used + ref.days, pending: Math.max(0, bal.pending - ref.days) });
      } else if (status === 'rejected') {
        update('leave_requests', ref.id, { status, decided_at: nowIso(), approver_id: actor.id, decision_note: note || 'Rejected' });
        const bal = get('SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', ref.employee_id, ref.leave_type_id, Number(ref.start_date.slice(0, 4)));
        if (bal) update('leave_balances', bal.id, { pending: Math.max(0, bal.pending - ref.days) });
      }
      break;
    }
    case 'shift_swap':
      if (ref) update('swap_requests', ref.id, { status, decided_at: nowIso() });
      break;
    case 'overtime':
      if (ref) update('overtime_requests', ref.id, { status, decided_at: nowIso(), approver_id: actor.id });
      break;
    case 'expense':
      if (ref) update('expenses', ref.id, { status, decided_at: nowIso(), approver_id: actor.id });
      break;
    case 'regularization':
      if (ref) update('attendance', ref.id, { regularized: status === 'approved' ? 1 : 0 });
      break;
    default:
      break;
  }
  update('approvals', approval.id, { status, decided_at: nowIso(), decision_note: note || null });
  return { status, ref };
}

export function register(router) {
  router.get('/api/approvals', (ctx) => {
    const q = ctx.query;
    const m = maps();
    const scope = q.scope || 'inbox';
    const where = ['a.company_id = ?'];
    const args = [ctx.actor.company_id];

    if (scope === 'inbox') {
      requirePerm(ctx, 'approval.inbox');
      where.push("(a.approver_id = ? OR a.approver_id IS NULL)");
      args.push(ctx.actor.id);
    } else if (scope === 'mine') {
      where.push('a.requester_id = ?');
      args.push(ctx.actor.id);
    } else {
      const ids = visibleEmployeeIds(ctx.actor);
      if (ids !== null) {
        if (!ids.length) where.push('1 = 0');
        else {
          where.push(`a.requester_id IN (${ids.map(() => '?').join(',')})`);
          args.push(...ids);
        }
      }
    }
    if (q.status) {
      where.push('a.status = ?');
      args.push(q.status);
    }
    if (q.type) {
      where.push('a.type = ?');
      args.push(q.type);
    }

    const rows = all(
      `SELECT a.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji, e.department_id
       FROM approvals a JOIN employees e ON e.id = a.requester_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC LIMIT 200`,
      ...args
    );

    const enriched = rows.map((a) => {
      const ref = loadReference(a.type, a.ref_id);
      let detail = null;
      let tone = 'slate';
      if (a.type === 'leave' && ref) {
        detail = {
          label: ref.leave_name,
          icon: ref.icon,
          color: ref.color,
          value: `${ref.days} day${ref.days === 1 ? '' : 's'}`,
          range: `${ref.start_date} → ${ref.end_date}`,
          reason: ref.reason
        };
        tone = ref.color;
      } else if (a.type === 'shift_swap' && ref) {
        detail = { label: 'Shift swap', icon: '🔁', value: ref.shift_name || 'Shift', range: ref.date, reason: ref.reason };
      } else if (a.type === 'overtime' && ref) {
        detail = { label: 'Overtime', icon: '⏱️', value: `${ref.minutes} min`, range: ref.date, reason: ref.reason };
      } else if (a.type === 'expense' && ref) {
        detail = { label: ref.category || 'Expense', icon: '🧾', value: `₹${Number(ref.amount).toLocaleString('en-IN')}`, range: ref.date, reason: ref.description };
      } else if (a.type === 'regularization' && ref) {
        detail = { label: 'Attendance fix', icon: '🛠️', value: ref.date, range: ref.notes || '', reason: ref.notes };
      }
      return {
        ...a,
        full_name: `${a.first_name} ${a.last_name || ''}`.trim(),
        designation: a.designation,
        avatar_color: a.avatar_color,
        avatar_emoji: a.avatar_emoji,
        department: m.depts[a.department_id]?.name,
        detail,
        tone
      };
    });

    return {
      rows: enriched,
      counts: {
        inbox: one(`SELECT COUNT(*) FROM approvals WHERE approver_id = ? AND status = 'pending'`, ctx.actor.id),
        mine: one(`SELECT COUNT(*) FROM approvals WHERE requester_id = ? AND status = 'pending'`, ctx.actor.id),
        approvedThisMonth: one(
          `SELECT COUNT(*) FROM approvals WHERE approver_id = ? AND status = 'approved' AND decided_at >= date('now','start of month')`,
          ctx.actor.id
        ),
        avgDecisionHours: Number(
          (
            one(
              `SELECT AVG((julianday(decided_at) - julianday(created_at)) * 24) FROM approvals WHERE approver_id = ? AND decided_at IS NOT NULL`,
              ctx.actor.id
            ) || 0
          ).toFixed(1)
        )
      },
      types: [
        { key: 'leave', label: 'Leave', icon: '🌴' },
        { key: 'shift_swap', label: 'Shift swap', icon: '🔁' },
        { key: 'overtime', label: 'Overtime', icon: '⏱️' },
        { key: 'expense', label: 'Expense', icon: '🧾' },
        { key: 'regularization', label: 'Attendance fix', icon: '🛠️' }
      ]
    };
  });

  router.post('/api/approvals/:id/decide', (ctx) => {
    requirePerm(ctx, 'approval.approve');
    const id = Number(ctx.params.id);
    const approval = get('SELECT * FROM approvals WHERE id = ?', id);
    if (!approval) throw notFound('Approval not found');
    if (approval.status !== 'pending') throw badRequest(`Already ${approval.status}`);
    const { action, note } = ctx.body;
    if (!['approve', 'reject'].includes(action)) throw badRequest('action must be approve or reject');
    const { status, ref } = applyDecision(approval, action, note, ctx.actor);
    audit(ctx, `approval.${status}`, approval.type, approval.ref_id, `${approval.summary} → ${status}`);
    push(approval.requester_id, {
      type: 'approval',
      title: status === 'approved' ? 'Approved ✅' : 'Rejected',
      body: `${approval.summary}`,
      icon: status === 'approved' ? '✅' : '↩️',
      link: '#/approvals',
      priority: status === 'approved' ? 'normal' : 'high'
    });
    return { ok: true, status };
  });

  router.post('/api/approvals/bulk', (ctx) => {
    requirePerm(ctx, 'approval.approve');
    const { ids = [], action = 'approve', note = null } = ctx.body;
    if (!ids.length) throw badRequest('No approvals selected');
    let count = 0;
    for (const id of ids) {
      const approval = get('SELECT * FROM approvals WHERE id = ?', id);
      if (!approval || approval.status !== 'pending') continue;
      applyDecision(approval, action, note, ctx.actor);
      push(approval.requester_id, {
        type: 'approval',
        title: action === 'approve' ? 'Approved ✅' : 'Rejected',
        body: approval.summary,
        icon: action === 'approve' ? '✅' : '↩️',
        link: '#/approvals'
      });
      count += 1;
    }
    audit(ctx, `approval.${action}_bulk`, 'approval', null, `Bulk ${action} of ${count} request(s)`);
    return { ok: true, count };
  });

  // --- expenses ------------------------------------------------------------
  router.get('/api/expenses', (ctx) => {
    const scope = visibleEmployeeIds(ctx.actor);
    const where = ['e.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (ctx.query.scope === 'mine') {
      where.push('e.employee_id = ?');
      args.push(ctx.actor.id);
    } else if (scope !== null) {
      if (!scope.length) where.push('1 = 0');
      else {
        where.push(`e.employee_id IN (${scope.map(() => '?').join(',')})`);
        args.push(...scope);
      }
    }
    const rows = all(
      `SELECT e.*, emp.first_name, emp.last_name FROM expenses e JOIN employees emp ON emp.id = e.employee_id
       WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC LIMIT 100`,
      ...args
    );
    return {
      rows: rows.map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim() })),
      totals: {
        pending: rows.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0),
        approved: rows.filter((r) => ['approved', 'paid'].includes(r.status)).reduce((s, r) => s + r.amount, 0)
      }
    };
  });

  router.post('/api/expenses', (ctx) => {
    const { category, amount, date, description, receipt_url } = ctx.body;
    if (!amount || !category) throw badRequest('category and amount are required');
    const id = insert('expenses', {
      company_id: ctx.actor.company_id,
      employee_id: ctx.actor.id,
      category,
      amount: Number(amount),
      currency: 'INR',
      date: date || today(),
      description: description || null,
      receipt_url: receipt_url || null,
      status: 'pending',
      approver_id: ctx.actor.manager_id
    });
    insert('approvals', {
      company_id: ctx.actor.company_id,
      type: 'expense',
      ref_id: id,
      requester_id: ctx.actor.id,
      approver_id: ctx.actor.manager_id,
      summary: `Expense · ${category} · ₹${Number(amount).toLocaleString('en-IN')}`,
      status: 'pending'
    });
    audit(ctx, 'expense.create', 'expense', id, `Submitted ${category} expense ₹${amount}`);
    if (ctx.actor.manager_id) push(ctx.actor.manager_id, { type: 'approval', title: 'Expense to approve', body: `${employeeLabel(ctx.actor)} submitted ₹${amount} for ${category}.`, icon: '🧾', link: '#/approvals' });
    return { id };
  });
}
