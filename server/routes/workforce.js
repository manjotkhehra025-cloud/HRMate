import { all, get, insert, one, run, update } from '../lib/db.js';
import { addDays, badRequest, dateRange, minutesBetween, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { employeeLabel, reportTreeIds, scopeIdsOrDefault, visibleEmployeeIds } from '../lib/scope.js';
import { employeeCard, maps } from './_shared.js';

const startOfWeek = (dateISO, weekStart = 1) => {
  const d = new Date(dateISO + 'T00:00:00Z');
  const diff = (d.getUTCDay() - weekStart + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
};

export function register(router) {
  // --- shifts --------------------------------------------------------------
  router.get('/api/shifts', (ctx) => ({
    rows: all('SELECT * FROM shifts WHERE company_id = ? ORDER BY start_time', ctx.actor.company_id).map((s) => ({
      ...s,
      days: JSON.parse(s.days || '[]'),
      assigned: one('SELECT COUNT(*) FROM employees WHERE shift_id = ? AND status != ?', s.id, 'terminated')
    }))
  }));

  router.post('/api/shifts', (ctx) => {
    requirePerm(ctx, 'shift.manage');
    const { name, code, start_time, end_time, break_minutes = 30, color, days = [1, 2, 3, 4, 5], grace_min = 10, description } = ctx.body;
    if (!name || !start_time || !end_time) throw badRequest('Name, start and end times are required');
    const id = insert('shifts', {
      company_id: ctx.actor.company_id,
      name,
      code: code || name.slice(0, 3).toUpperCase(),
      start_time,
      end_time,
      break_minutes,
      color: color || '#6366f1',
      days,
      grace_min,
      work_hours: Number(((minutesBetween(start_time, end_time, today()) - break_minutes) / 60).toFixed(2)),
      overnight: end_time < start_time ? 1 : 0,
      description: description || null,
      active: 1
    });
    audit(ctx, 'shift.create', 'shift', id, `Created shift ${name} (${start_time}–${end_time})`);
    return { id };
  });

  router.patch('/api/shifts/:id', (ctx) => {
    requirePerm(ctx, 'shift.manage');
    const id = Number(ctx.params.id);
    const patch = { ...ctx.body };
    const shift = get('SELECT * FROM shifts WHERE id = ?', id);
    if (!shift) throw notFound('Shift not found');
    const start = patch.start_time || shift.start_time;
    const end = patch.end_time || shift.end_time;
    const brk = patch.break_minutes ?? shift.break_minutes;
    patch.work_hours = Number(((minutesBetween(start, end, today()) - brk) / 60).toFixed(2));
    patch.overnight = end < start ? 1 : 0;
    update('shifts', id, patch);
    audit(ctx, 'shift.update', 'shift', id, `Updated shift ${patch.name || shift.name}`);
    return { ok: true };
  });

  router.delete('/api/shifts/:id', (ctx) => {
    requirePerm(ctx, 'shift.manage');
    const id = Number(ctx.params.id);
    const used = one('SELECT COUNT(*) FROM employees WHERE shift_id = ?', id);
    if (used) throw badRequest(`${used} employees are still assigned to this shift`);
    run('DELETE FROM shifts WHERE id = ?', id);
    audit(ctx, 'shift.delete', 'shift', id, 'Deleted shift', { severity: 'warning' });
    return { ok: true };
  });

  // --- roster --------------------------------------------------------------
  router.get('/api/roster', (ctx) => {
    const q = ctx.query;
    const weekStartDay = q.week || startOfWeek(q.date || today());
    const days = dateRange(weekStartDay, addDays(weekStartDay, 6));
    const m = maps();
    const scope = visibleEmployeeIds(ctx.actor);
    let ids = scope === null ? scopeIdsOrDefault(ctx.actor) : scope;
    if (q.department) {
      const deptId = Number(q.department);
      ids = ids.filter((id) => get('SELECT department_id FROM employees WHERE id = ?', id)?.department_id === deptId);
    }
    if (!ids.length) return { weekStart: weekStartDay, days, groups: [], employees: [], coverage: {} };

    const marks = ids.map(() => '?').join(',');
    const dayMarks = days.map(() => '?').join(',');
    const rows = all(
      `SELECT * FROM roster WHERE employee_id IN (${marks}) AND date IN (${dayMarks})`,
      ...ids,
      ...days
    );
    const employees = all(`SELECT * FROM employees WHERE id IN (${marks}) AND status != 'terminated' ORDER BY first_name`, ...ids);
    const byEmp = {};
    for (const r of rows) {
      byEmp[r.employee_id] = byEmp[r.employee_id] || {};
      byEmp[r.employee_id][r.date] = r;
    }
    const leaves = all(
      `SELECT employee_id, start_date, end_date, status, days, lt.name AS leave_name, lt.color FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.status = 'approved' AND lr.start_date <= ? AND lr.end_date >= ? AND lr.employee_id IN (${marks})`,
      days[6],
      days[0],
      ...ids
    );
    const holidays = all('SELECT * FROM holidays WHERE date IN (' + dayMarks + ')', ...days);

    const coverage = {};
    for (const d of days) {
      coverage[d] = {
        scheduled: rows.filter((r) => r.date === d && r.kind === 'work').length,
        off: rows.filter((r) => r.date === d && r.kind !== 'work').length,
        onLeave: leaves.filter((l) => l.start_date <= d && l.end_date >= d).length,
        holiday: holidays.find((h) => h.date === d) || null
      };
    }

    return {
      weekStart: weekStartDay,
      days,
      holidays,
      employees: employees.map((e) => ({
        ...employeeCard(e, m),
        week: days.map((d) => {
          const r = byEmp[e.id]?.[d];
          const shift = r?.shift_id ? m.shifts[r.shift_id] : null;
          const leave = leaves.find((l) => l.employee_id === e.id && l.start_date <= d && l.end_date >= d);
          return {
            date: d,
            kind: r?.kind || 'off',
            shift: shift ? { id: shift.id, name: shift.name, start: shift.start_time, end: shift.end_time, color: shift.color } : null,
            leave: leave ? { name: leave.leave_name, color: leave.color } : null,
            note: r?.note || null
          };
        })
      })),
      coverage,
      totals: {
        scheduled: rows.filter((r) => r.kind === 'work').length,
        onLeave: leaves.length,
        hours: Number(
          rows
            .filter((r) => r.kind === 'work' && r.shift_id)
            .reduce((sum, r) => sum + (m.shifts[r.shift_id]?.work_hours || 0), 0)
            .toFixed(1)
        )
      }
    };
  });

  router.post('/api/roster', (ctx) => {
    requirePerm(ctx, 'roster.manage');
    const { employee_id, date, shift_id = null, kind = 'work', note = null } = ctx.body;
    if (!employee_id || !date) throw badRequest('employee_id and date are required');
    const existing = get('SELECT * FROM roster WHERE employee_id = ? AND date = ?', employee_id, date);
    if (existing) {
      update('roster', existing.id, { shift_id, kind, note });
      audit(ctx, 'roster.update', 'roster', existing.id, `Updated roster ${date}`);
    } else {
      insert('roster', { company_id: ctx.actor.company_id, employee_id, date, shift_id, kind, note, published: 1 });
      audit(ctx, 'roster.assign', 'roster', null, `Assigned roster for ${date}`);
    }
    push(employee_id, { type: 'shift', title: 'Roster updated', body: `Your roster for ${date} was updated.`, icon: '🗓️', link: '#/roster' });
    return { ok: true };
  });

  // bulk assign a shift pattern across a date range
  router.post('/api/roster/bulk', (ctx) => {
    requirePerm(ctx, 'roster.manage');
    const { employee_ids = [], from, to, shift_id = null, kind = 'work' } = ctx.body;
    if (!employee_ids.length || !from || !to) throw badRequest('employee_ids, from and to are required');
    let count = 0;
    for (const date of dateRange(from, to)) {
      for (const employeeId of employee_ids) {
        const existing = get('SELECT * FROM roster WHERE employee_id = ? AND date = ?', employeeId, date);
        if (existing) update('roster', existing.id, { shift_id, kind });
        else insert('roster', { company_id: ctx.actor.company_id, employee_id: employeeId, date, shift_id, kind, published: 1 });
        count += 1;
      }
    }
    audit(ctx, 'roster.bulk', 'roster', null, `Bulk roster update for ${employee_ids.length} people (${from} → ${to})`);
    for (const id of employee_ids) push(id, { type: 'shift', title: 'New roster published', body: `Your roster from ${from} has been updated.`, icon: '🗓️', link: '#/roster' });
    return { ok: true, count };
  });

  router.post('/api/roster/publish', (ctx) => {
    requirePerm(ctx, 'roster.manage');
    const { from, to } = ctx.body;
    if (!from || !to) throw badRequest('from and to are required');
    const info = run(`UPDATE roster SET published = 1 WHERE company_id = ? AND date BETWEEN ? AND ?`, ctx.actor.company_id, from, to);
    const affected = all(
      'SELECT DISTINCT employee_id FROM roster WHERE company_id = ? AND date BETWEEN ? AND ?',
      ctx.actor.company_id,
      from,
      to
    );
    for (const a of affected) push(a.employee_id, { type: 'shift', title: 'Roster published', body: `Your schedule for ${from} → ${to} is live.`, icon: '📆', link: '#/roster' });
    audit(ctx, 'roster.publish', 'roster', null, `Published roster ${from} → ${to} (${info.changes} slots)`);
    return { ok: true, slots: Number(info.changes) };
  });

  router.get('/api/roster/my', (ctx) => {
    const weekStartDay = startOfWeek(ctx.query.date || today());
    const days = dateRange(weekStartDay, addDays(weekStartDay, 6));
    const m = maps();
    const rows = all('SELECT * FROM roster WHERE employee_id = ? AND date IN (' + days.map(() => '?').join(',') + ')', ctx.actor.id, ...days);
    const leaves = all(`SELECT lr.*, lt.name AS leave_name, lt.color FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.employee_id = ? AND lr.status = 'approved' AND lr.start_date <= ? AND lr.end_date >= ?`, ctx.actor.id, days[6], days[0]);
    const holidays = all('SELECT * FROM holidays WHERE date IN (' + days.map(() => '?').join(',') + ')', ...days);
    return {
      weekStart: weekStartDay,
      days: days.map((d) => {
        const r = rows.find((x) => x.date === d);
        const shift = r?.shift_id ? m.shifts[r.shift_id] : null;
        const attendance = get('SELECT status, first_in, last_out, work_minutes FROM attendance WHERE employee_id = ? AND date = ?', ctx.actor.id, d);
        return {
          date: d,
          kind: r?.kind || 'off',
          shift: shift ? { id: shift.id, name: shift.name, start: shift.start_time, end: shift.end_time, color: shift.color, work_hours: shift.work_hours } : null,
          leave: leaves.find((l) => l.start_date <= d && l.end_date >= d) || null,
          holiday: holidays.find((h) => h.date === d) || null,
          attendance: attendance || null
        };
      }),
      swaps: all('SELECT * FROM swap_requests WHERE employee_id = ? ORDER BY created_at DESC LIMIT 10', ctx.actor.id)
    };
  });

  // --- shift swap requests -------------------------------------------------
  router.get('/api/swaps', (ctx) => {
    const scope = visibleEmployeeIds(ctx.actor);
    const where = [];
    const args = [];
    if (ctx.query.scope !== 'all') {
      if (scope !== null) {
        if (!scope.length) where.push('1 = 0');
        else {
          where.push(`s.employee_id IN (${scope.map(() => '?').join(',')}) OR s.with_employee_id IN (${scope.map(() => '?').join(',')})`);
          args.push(...scope, ...scope);
        }
      }
    }
    const clause = where.length ? `WHERE (${where.join(' AND ')})` : '';
    const rows = all(
      `SELECT s.*, e.first_name, e.last_name, w.first_name AS with_first, w.last_name AS with_last, sh.name AS shift_name
       FROM swap_requests s JOIN employees e ON e.id = s.employee_id
       LEFT JOIN employees w ON w.id = s.with_employee_id
       LEFT JOIN shifts sh ON sh.id = s.shift_id ${clause} ORDER BY s.created_at DESC LIMIT 100`,
      ...args
    );
    return { rows: rows.map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim(), with_name: r.with_first ? `${r.with_first} ${r.with_last || ''}`.trim() : null })) };
  });

  router.post('/api/swaps', (ctx) => {
    const { date, shift_id = null, with_employee_id = null, reason } = ctx.body;
    if (!date) throw badRequest('date is required');
    const id = insert('swap_requests', {
      company_id: ctx.actor.company_id,
      employee_id: ctx.actor.id,
      with_employee_id,
      date,
      shift_id: shift_id || ctx.actor.shift_id,
      reason: reason || null,
      status: 'pending'
    });
    insert('approvals', {
      company_id: ctx.actor.company_id,
      type: 'shift_swap',
      ref_id: id,
      requester_id: ctx.actor.id,
      approver_id: ctx.actor.manager_id,
      summary: `Shift swap · ${date}`,
      status: 'pending'
    });
    if (with_employee_id) {
      push(with_employee_id, { type: 'shift', title: 'Shift swap proposed', body: `${employeeLabel(ctx.actor)} wants to swap the ${date} shift with you.`, icon: '🔁', link: '#/roster' });
    }
    if (ctx.actor.manager_id) {
      push(ctx.actor.manager_id, { type: 'approval', title: 'Swap request', body: `${employeeLabel(ctx.actor)} requested a shift swap on ${date}.`, icon: '🔁', link: '#/approvals' });
    }
    audit(ctx, 'swap.create', 'swap', id, `Shift swap requested for ${date}`);
    return { id };
  });

  router.post('/api/swaps/:id/decide', (ctx) => {
    const id = Number(ctx.params.id);
    const swap = get('SELECT * FROM swap_requests WHERE id = ?', id);
    if (!swap) throw notFound('Swap request not found');
    const { action } = ctx.body; // approve | reject | accept (counterpart)
    const isOwner = swap.employee_id === ctx.actor.id;
    const isCounterpart = swap.with_employee_id === ctx.actor.id;
    if (!isCounterpart && !isOwner) requirePerm(ctx, 'roster.swap_approve');
    const status = action === 'approve' || action === 'accept' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
    update('swap_requests', id, { status, decided_at: nowIso() });
    run("UPDATE approvals SET status = ?, decided_at = ? WHERE type = 'shift_swap' AND ref_id = ?", status, nowIso(), id);
    if (status === 'approved' && swap.with_employee_id) {
      const a = get('SELECT * FROM roster WHERE employee_id = ? AND date = ?', swap.employee_id, swap.date);
      const b = get('SELECT * FROM roster WHERE employee_id = ? AND date = ?', swap.with_employee_id, swap.date);
      if (a) update('roster', a.id, { shift_id: b?.shift_id || null, kind: b?.kind || 'off' });
      if (b) update('roster', b.id, { shift_id: a?.shift_id || null, kind: a?.kind || 'off' });
    }
    audit(ctx, `swap.${status}`, 'swap', id, `Shift swap ${status}`);
    push(swap.employee_id, { type: 'shift', title: `Swap ${status}`, body: `Your ${swap.date} swap request was ${status}.`, icon: '🔁', link: '#/roster' });
    return { ok: true, status };
  });

  // --- overtime ------------------------------------------------------------
  router.get('/api/overtime', (ctx) => {
    const scope = visibleEmployeeIds(ctx.actor);
    const where = ['o.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (ctx.query.scope === 'mine') {
      where.push('o.employee_id = ?');
      args.push(ctx.actor.id);
    } else if (scope !== null) {
      if (!scope.length) where.push('1 = 0');
      else {
        where.push(`o.employee_id IN (${scope.map(() => '?').join(',')})`);
        args.push(...scope);
      }
    }
    const rows = all(
      `SELECT o.*, e.first_name, e.last_name FROM overtime_requests o JOIN employees e ON e.id = o.employee_id
       WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT 100`,
      ...args
    );
    return { rows: rows.map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim() })) };
  });

  router.post('/api/overtime', (ctx) => {
    const { date, minutes, reason } = ctx.body;
    if (!date || !minutes) throw badRequest('date and minutes are required');
    const id = insert('overtime_requests', {
      company_id: ctx.actor.company_id,
      employee_id: ctx.actor.id,
      date,
      minutes: Number(minutes),
      reason: reason || null,
      status: 'pending',
      approver_id: ctx.actor.manager_id
    });
    insert('approvals', {
      company_id: ctx.actor.company_id,
      type: 'overtime',
      ref_id: id,
      requester_id: ctx.actor.id,
      approver_id: ctx.actor.manager_id,
      summary: `Overtime · ${minutes} min · ${date}`,
      status: 'pending'
    });
    audit(ctx, 'overtime.create', 'overtime', id, `Requested ${minutes} min overtime for ${date}`);
    return { id };
  });
}
