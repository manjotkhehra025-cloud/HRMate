import { all, get, insert, one, run, update } from '../lib/db.js';
import { addDays, badRequest, dateRange, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { employeeLabel, nextApprover, scopeClause, visibleEmployeeIds } from '../lib/scope.js';
import { balancesFor, employeeCard, maps } from './_shared.js';

const YEAR = Number(new Date().toISOString().slice(0, 4));

function workDays(from, to) {
  let days = 0;
  for (const d of dateRange(from, to)) {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return days;
}

function syncApproval(request) {
  run(
    'UPDATE approvals SET status = ?, summary = ?, decided_at = ? WHERE type = ? AND ref_id = ?',
    request.status,
    `${request.leave_name || 'Leave'} · ${request.days} day(s) · ${request.start_date}`,
    request.decided_at,
    'leave',
    request.id
  );
}

function applyBalance(request, delta) {
  const bal = get(
    'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
    request.employee_id,
    request.leave_type_id,
    Number(String(request.start_date).slice(0, 4))
  );
  if (!bal) return;
  if (delta === 'pending+') update('leave_balances', bal.id, { pending: bal.pending + request.days });
  if (delta === 'pending-') update('leave_balances', bal.id, { pending: Math.max(0, bal.pending - request.days) });
  if (delta === 'use') update('leave_balances', bal.id, { used: bal.used + request.days, pending: Math.max(0, bal.pending - request.days) });
  if (delta === 'release') update('leave_balances', bal.id, { used: Math.max(0, bal.used - request.days) });
}

export function register(router) {
  // --- leave types ---------------------------------------------------------
  router.get('/api/leave-types', (ctx) => ({
    rows: all('SELECT * FROM leave_types WHERE company_id = ? ORDER BY name', ctx.actor.company_id)
  }));

  router.post('/api/leave-types', (ctx) => {
    requirePerm(ctx, 'leave.manage_types');
    const id = insert('leave_types', {
      company_id: ctx.actor.company_id,
      name: ctx.body.name,
      code: ctx.body.code || String(ctx.body.name || '').slice(0, 3).toUpperCase(),
      color: ctx.body.color || '#6366f1',
      icon: ctx.body.icon || '🌴',
      annual_quota: Number(ctx.body.annual_quota || 0),
      carry_forward: Number(ctx.body.carry_forward || 0),
      paid: ctx.body.paid === false ? 0 : 1,
      min_notice_days: Number(ctx.body.min_notice_days || 0),
      max_days_per_request: Number(ctx.body.max_days_per_request || 0),
      requires_proof: ctx.body.requires_proof ? 1 : 0,
      applies_to: ctx.body.applies_to || 'all',
      active: 1
    });
    audit(ctx, 'leave_type.create', 'leave_type', id, `Created leave type ${ctx.body.name}`);
    return { id };
  });

  router.patch('/api/leave-types/:id', (ctx) => {
    requirePerm(ctx, 'leave.manage_types');
    update('leave_types', Number(ctx.params.id), ctx.body);
    audit(ctx, 'leave_type.update', 'leave_type', Number(ctx.params.id), `Updated leave type #${ctx.params.id}`);
    return { ok: true };
  });

  router.delete('/api/leave-types/:id', (ctx) => {
    requirePerm(ctx, 'leave.manage_types');
    const id = Number(ctx.params.id);
    const used = one('SELECT COUNT(*) FROM leave_requests WHERE leave_type_id = ?', id);
    if (used) {
      update('leave_types', id, { active: 0 });
      audit(ctx, 'leave_type.deactivate', 'leave_type', id, `Deactivated leave type #${id} (${used} requests exist)`);
      return { ok: true, deactivated: true };
    }
    run('DELETE FROM leave_types WHERE id = ?', id);
    audit(ctx, 'leave_type.delete', 'leave_type', id, 'Deleted leave type');
    return { ok: true };
  });

  // --- balances ------------------------------------------------------------
  router.get('/api/leaves/balances', (ctx) => {
    const employeeId = Number(ctx.query.employee_id) || ctx.actor.id;
    return { balances: balancesFor(employeeId, Number(ctx.query.year || YEAR)) };
  });

  // --- requests ------------------------------------------------------------
  router.get('/api/leaves', (ctx) => {
    const q = ctx.query;
    const m = maps();
    const where = ['lr.company_id = ?'];
    const args = [ctx.actor.company_id];
    const scope = q.scope || 'mine';

    if (scope === 'mine') {
      where.push('lr.employee_id = ?');
      args.push(ctx.actor.id);
    } else {
      const ids = visibleEmployeeIds(ctx.actor);
      if (scope === 'team') {
        const teamIds = ids === null ? all('SELECT id FROM employees WHERE manager_id = ?', ctx.actor.id).map((r) => r.id) : ids.filter((i) => i !== ctx.actor.id);
        if (!teamIds.length) where.push('1 = 0');
        else {
          where.push(`lr.employee_id IN (${teamIds.map(() => '?').join(',')})`);
          args.push(...teamIds);
        }
      } else if (ids !== null) {
        if (!ids.length) where.push('1 = 0');
        else {
          where.push(`lr.employee_id IN (${ids.map(() => '?').join(',')})`);
          args.push(...ids);
        }
      }
    }
    if (q.status) {
      where.push('lr.status = ?');
      args.push(q.status);
    }
    if (q.from) {
      where.push('lr.end_date >= ?');
      args.push(q.from);
    }
    if (q.to) {
      where.push('lr.start_date <= ?');
      args.push(q.to);
    }
    if (q.type) {
      where.push('lr.leave_type_id = ?');
      args.push(Number(q.type));
    }
    const rows = all(
      `SELECT lr.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji, e.department_id,
              lt.name AS leave_name, lt.code AS leave_code, lt.color AS leave_color, lt.icon AS leave_icon,
              ap.first_name AS approver_first, ap.last_name AS approver_last
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       LEFT JOIN employees ap ON ap.id = lr.approver_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END, lr.created_at DESC
       LIMIT 300`,
      ...args
    );
    return {
      rows: rows.map((r) => ({
        ...r,
        full_name: `${r.first_name} ${r.last_name || ''}`.trim(),
        approver_name: r.approver_first ? `${r.approver_first} ${r.approver_last || ''}`.trim() : null,
        department: m.depts[r.department_id]?.name
      })),
      counts: {
        pending: one(`SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND status = 'pending'`, ctx.actor.id),
        approvedThisMonth: one(
          `SELECT COUNT(*) FROM leave_requests WHERE employee_id = ? AND status = 'approved' AND start_date >= date('now','start of month')`,
          ctx.actor.id
        ),
        awaitingMe: one(`SELECT COUNT(*) FROM leave_requests WHERE approver_id = ? AND status = 'pending'`, ctx.actor.id)
      }
    };
  });

  router.post('/api/leaves', (ctx) => {
    const {
      leave_type_id,
      start_date,
      end_date,
      reason,
      half_day = false,
      proof_url = null,
      employee_id = null
    } = ctx.body;
    if (!leave_type_id || !start_date || !end_date) throw badRequest('Leave type and dates are required');
    if (end_date < start_date) throw badRequest('End date must be after the start date');
    const targetId = employee_id && Number(employee_id) !== ctx.actor.id ? Number(employee_id) : ctx.actor.id;
    if (targetId !== ctx.actor.id) requirePerm(ctx, 'leave.approve');

    const leaveType = get('SELECT * FROM leave_types WHERE id = ?', leave_type_id);
    if (!leaveType) throw notFound('Leave type not found');
    const days = half_day ? 0.5 : Math.max(1, workDays(start_date, end_date));

    const bal = get('SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', targetId, leave_type_id, Number(start_date.slice(0, 4)));
    const available = bal ? bal.entitled - bal.used - bal.pending : null;
    if (bal && leaveType.annual_quota > 0 && available < days) {
      throw badRequest(`Only ${available} day(s) left in your ${leaveType.name} balance`);
    }
    const overlap = one(
      `SELECT id FROM leave_requests WHERE employee_id = ? AND status IN ('pending','approved') AND start_date <= ? AND end_date >= ?`,
      targetId,
      end_date,
      start_date
    );
    if (overlap) throw badRequest('This period overlaps an existing request');

    const approverId = targetId === ctx.actor.id ? nextApprover(ctx.actor.id) : ctx.actor.id;
    const id = insert('leave_requests', {
      company_id: ctx.actor.company_id,
      employee_id: targetId,
      leave_type_id,
      start_date,
      end_date,
      days,
      half_day: half_day ? 1 : 0,
      reason: reason || null,
      status: 'pending',
      approver_id: approverId,
      proof_url,
      created_at: nowIso()
    });
    insert('approvals', {
      company_id: ctx.actor.company_id,
      type: 'leave',
      ref_id: id,
      requester_id: targetId,
      approver_id: approverId,
      summary: `${leaveType.name} · ${days} day(s) · ${start_date}`,
      status: 'pending',
      created_at: nowIso()
    });
    applyBalance({ employee_id: targetId, leave_type_id, start_date, days }, 'pending+');
    audit(ctx, 'leave.create', 'leave', id, `${leaveType.name} requested for ${start_date} → ${end_date}`);
    if (approverId) {
      push(approverId, {
        type: 'approval',
        title: 'Leave request waiting',
        body: `${employeeLabel(get('SELECT * FROM employees WHERE id = ?', targetId))} applied for ${leaveType.name} (${days}d).`,
        icon: '🧾',
        link: '#/approvals',
        payload: { requestId: id }
      });
    }
    return { id, days, approver_id: approverId };
  });

  router.patch('/api/leaves/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const lr = get('SELECT * FROM leave_requests WHERE id = ?', id);
    if (!lr) throw notFound('Leave request not found');
    if (lr.employee_id !== ctx.actor.id && !['pending'].includes(lr.status)) requirePerm(ctx, 'leave.approve');
    if (lr.status !== 'pending') throw badRequest('Only pending requests can be edited');
    const patch = {};
    for (const f of ['start_date', 'end_date', 'reason', 'half_day', 'proof_url']) if (ctx.body[f] !== undefined) patch[f] = ctx.body[f];
    if (patch.start_date && patch.end_date) patch.days = patch.half_day ? 0.5 : Math.max(1, workDays(patch.start_date, patch.end_date));
    update('leave_requests', id, patch);
    audit(ctx, 'leave.update', 'leave', id, 'Leave request updated');
    syncApproval(get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id));
    return { ok: true };
  });

  router.post('/api/leaves/:id/cancel', (ctx) => {
    const id = Number(ctx.params.id);
    const lr = get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id);
    if (!lr) throw notFound('Leave request not found');
    if (lr.employee_id !== ctx.actor.id) requirePerm(ctx, 'leave.approve');
    if (lr.status === 'cancelled') throw badRequest('Already cancelled');
    update('leave_requests', id, { status: 'cancelled', decision_note: ctx.body.reason || 'Cancelled by employee', decided_at: nowIso() });
    applyBalance(lr, lr.status === 'approved' ? 'release' : 'pending-');
    syncApproval(get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id));
    audit(ctx, 'leave.cancel', 'leave', id, 'Leave request cancelled');
    return { ok: true };
  });

  router.post('/api/leaves/:id/approve', (ctx) => {
    requirePerm(ctx, 'leave.approve');
    const id = Number(ctx.params.id);
    const lr = get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id);
    if (!lr) throw notFound('Leave request not found');
    if (lr.status !== 'pending') throw badRequest(`Request is already ${lr.status}`);
    update('leave_requests', id, { status: 'approved', decided_at: nowIso(), approver_id: ctx.actor.id, decision_note: ctx.body.note || null });
    applyBalance(lr, 'use');
    syncApproval(get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id));
    audit(ctx, 'leave.approve', 'leave', id, `Approved ${lr.leave_name} for ${employeeLabel(get('SELECT * FROM employees WHERE id = ?', lr.employee_id))}`);
    push(lr.employee_id, {
      type: 'leave',
      title: 'Leave approved ✅',
      body: `Your ${lr.leave_name} from ${lr.start_date} was approved.`,
      icon: '✅',
      link: '#/leaves'
    });
    return { ok: true, balances: balancesFor(lr.employee_id, YEAR) };
  });

  router.post('/api/leaves/:id/reject', (ctx) => {
    requirePerm(ctx, 'leave.approve');
    const id = Number(ctx.params.id);
    const lr = get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id);
    if (!lr) throw notFound('Leave request not found');
    if (lr.status !== 'pending') throw badRequest(`Request is already ${lr.status}`);
    update('leave_requests', id, { status: 'rejected', decided_at: nowIso(), approver_id: ctx.actor.id, decision_note: ctx.body.note || 'Rejected' });
    applyBalance(lr, 'pending-');
    syncApproval(get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id));
    audit(ctx, 'leave.reject', 'leave', id, `Rejected ${lr.leave_name}`, { severity: 'warning' });
    push(lr.employee_id, {
      type: 'leave',
      title: 'Leave rejected',
      body: ctx.body.note || `Your ${lr.leave_name} request was declined.`,
      icon: '↩️',
      link: '#/leaves',
      priority: 'high'
    });
    return { ok: true, balances: balancesFor(lr.employee_id, YEAR) };
  });

  // bulk approve / reject ---------------------------------------------------
  router.post('/api/leaves/bulk', (ctx) => {
    requirePerm(ctx, 'leave.approve');
    const { ids = [], action = 'approve', note = null } = ctx.body;
    if (!Array.isArray(ids) || !ids.length) throw badRequest('No requests selected');
    let count = 0;
    for (const id of ids) {
      const lr = get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id);
      if (!lr || lr.status !== 'pending') continue;
      if (action === 'approve') {
        update('leave_requests', id, { status: 'approved', decided_at: nowIso(), approver_id: ctx.actor.id, decision_note: note });
        applyBalance(lr, 'use');
      } else {
        update('leave_requests', id, { status: 'rejected', decided_at: nowIso(), approver_id: ctx.actor.id, decision_note: note || 'Bulk rejection' });
        applyBalance(lr, 'pending-');
      }
      syncApproval(get('SELECT lr.*, lt.name AS leave_name FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?', id));
      push(lr.employee_id, {
        type: 'leave',
        title: action === 'approve' ? 'Leave approved ✅' : 'Leave rejected',
        body: `${lr.leave_name} from ${lr.start_date}`,
        icon: action === 'approve' ? '✅' : '↩️',
        link: '#/leaves'
      });
      count += 1;
    }
    audit(ctx, `leave.${action}_bulk`, 'leave', null, `Bulk ${action} of ${count} leave request(s)`);
    return { ok: true, count };
  });

  router.delete('/api/leaves/:id', (ctx) => {
    requirePerm(ctx, 'leave.manage_types');
    const id = Number(ctx.params.id);
    const lr = get('SELECT * FROM leave_requests WHERE id = ?', id);
    if (!lr) throw notFound('Leave request not found');
    if (lr.status === 'approved') applyBalance({ ...lr, leave_name: '' }, 'release');
    run('DELETE FROM leave_requests WHERE id = ?', id);
    run("DELETE FROM approvals WHERE type = 'leave' AND ref_id = ?", id);
    audit(ctx, 'leave.delete', 'leave', id, 'Leave request deleted', { severity: 'warning' });
    return { ok: true };
  });

  // calendar feed -----------------------------------------------------------
  router.get('/api/leaves/calendar', (ctx) => {
    const month = ctx.query.month || today().slice(0, 7);
    const scope = visibleEmployeeIds(ctx.actor);
    const where = [`lr.start_date <= ? AND lr.end_date >= ?`];
    const args = [`${month}-31`, `${month}-01`];
    if (scope !== null) {
      if (!scope.length) where.push('1 = 0');
      else {
        where.push(`lr.employee_id IN (${scope.map(() => '?').join(',')})`);
        args.push(...scope);
      }
    }
    const rows = all(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.status, lr.days, lt.name AS leave_name, lt.color, e.first_name, e.last_name
       FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id JOIN employees e ON e.id = lr.employee_id
       WHERE ${where.join(' AND ')}`,
      ...args
    );
    return {
      month,
      rows: rows.map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim() }))
    };
  });
}
