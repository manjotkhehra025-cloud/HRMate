import { all, get, insert, one, run, update } from '../lib/db.js';
import { addDays, badRequest, dateRange, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { visibleEmployeeIds } from '../lib/scope.js';
import { statusTone } from './_shared.js';

export function register(router) {
  // unified month feed: holidays, events, leaves, shifts, birthdays
  router.get('/api/calendar', (ctx) => {
    const month = ctx.query.month || today().slice(0, 7);
    const from = `${month}-01`;
    const to = `${month}-31`;
    const companyId = ctx.actor.company_id;
    const scope = visibleEmployeeIds(ctx.actor);

    const holidays = all('SELECT * FROM holidays WHERE company_id = ? AND date BETWEEN ? AND ? ORDER BY date', companyId, from, to);
    const events = all('SELECT ev.*, e.first_name, e.last_name FROM events ev LEFT JOIN employees e ON e.id = ev.organizer_id WHERE ev.company_id = ? AND ev.date BETWEEN ? AND ? ORDER BY ev.date, ev.start_time', companyId, from, to);

    const leaveWhere = ['lr.status = ?', 'lr.start_date <= ?', 'lr.end_date >= ?'];
    const leaveArgs = ['approved', to, from];
    if (scope !== null) {
      if (!scope.length) leaveWhere.push('1 = 0');
      else {
        leaveWhere.push(`lr.employee_id IN (${scope.map(() => '?').join(',')})`);
        leaveArgs.push(...scope);
      }
    }
    const leaves = all(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.days, lr.employee_id, lt.name, lt.color, lt.icon, e.first_name, e.last_name
       FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id JOIN employees e ON e.id = lr.employee_id
       WHERE ${leaveWhere.join(' AND ')}`,
      ...leaveArgs
    );

    const myAttendance = all(
      'SELECT date, status, first_in, last_out, work_minutes FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?',
      ctx.actor.id,
      from,
      to
    );
    const myRoster = all(
      `SELECT r.date, r.kind, s.name AS shift_name, s.start_time, s.end_time, s.color
       FROM roster r LEFT JOIN shifts s ON s.id = r.shift_id WHERE r.employee_id = ? AND r.date BETWEEN ? AND ?`,
      ctx.actor.id,
      from,
      to
    );
    const birthdays = all(
      "SELECT id, first_name, last_name, date_of_birth, designation FROM employees WHERE company_id = ? AND status != 'terminated' AND substr(date_of_birth,6,2) = ?",
      companyId,
      month.slice(5, 7)
    );

    const days = dateRange(from, to).filter((d) => d.startsWith(month));
    return {
      month,
      days: days.map((d) => ({
        date: d,
        weekday: new Date(d + 'T00:00:00Z').getUTCDay(),
        holiday: holidays.find((h) => h.date === d) || null,
        events: events.filter((e) => e.date === d).map((e) => ({ ...e, organizer: e.first_name ? `${e.first_name} ${e.last_name || ''}`.trim() : null })),
        leaves: leaves.filter((l) => l.start_date <= d && l.end_date >= d).map((l) => ({ ...l, full_name: `${l.first_name} ${l.last_name || ''}`.trim() })),
        attendance: myAttendance.find((a) => a.date === d) || null,
        roster: myRoster.find((r) => r.date === d) || null,
        birthdays: birthdays.filter((b) => b.date_of_birth?.slice(8, 10) === d.slice(8, 10)).map((b) => ({ ...b, full_name: `${b.first_name} ${b.last_name || ''}`.trim() })),
        isToday: d === today()
      })),
      summary: {
        holidays: holidays.length,
        events: events.length,
        leaves: leaves.length,
        birthdays: birthdays.length,
        workdays: days.filter((d) => !holidays.find((h) => h.date === d) && [1, 2, 3, 4, 5].includes(new Date(d + 'T00:00:00Z').getUTCDay())).length
      }
    };
  });

  router.get('/api/holidays', (ctx) => ({
    rows: all('SELECT * FROM holidays WHERE company_id = ? ORDER BY date', ctx.actor.company_id)
  }));

  router.post('/api/holidays', (ctx) => {
    requirePerm(ctx, 'admin.settings');
    const { name, date, type = 'public', color = '#6366f1', optional = false } = ctx.body;
    if (!name || !date) throw badRequest('name and date are required');
    const id = insert('holidays', { company_id: ctx.actor.company_id, name, date, type, color, optional: optional ? 1 : 0, applies_to: 'all' });
    audit(ctx, 'holiday.create', 'holiday', id, `Added holiday ${name} on ${date}`);
    return { id };
  });

  router.delete('/api/holidays/:id', (ctx) => {
    requirePerm(ctx, 'admin.settings');
    run('DELETE FROM holidays WHERE id = ?', Number(ctx.params.id));
    audit(ctx, 'holiday.delete', 'holiday', Number(ctx.params.id), 'Holiday removed', { severity: 'warning' });
    return { ok: true };
  });

  router.get('/api/events', (ctx) => {
    const where = ['ev.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (ctx.query.from) {
      where.push('ev.date >= ?');
      args.push(ctx.query.from);
    }
    if (ctx.query.to) {
      where.push('ev.date <= ?');
      args.push(ctx.query.to);
    }
    if (ctx.query.mine === '1') where.push(`(ev.organizer_id = ? OR ev.attendees LIKE ?)`), args.push(ctx.actor.id, `%"${ctx.actor.id}"%`);
    const rows = all(
      `SELECT ev.*, e.first_name, e.last_name FROM events ev LEFT JOIN employees e ON e.id = ev.organizer_id WHERE ${where.join(' AND ')} ORDER BY ev.date, ev.start_time LIMIT 200`,
      ...args
    );
    return {
      rows: rows.map((r) => ({
        ...r,
        organizer: r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : 'HRMate',
        attendees: JSON.parse(r.attendees || '[]')
      }))
    };
  });

  router.post('/api/events', (ctx) => {
    const { title, description, date, start_time, end_time, all_day = false, kind = 'meeting', location, attendees = [] } = ctx.body;
    if (!title || !date) throw badRequest('title and date are required');
    const id = insert('events', {
      company_id: ctx.actor.company_id,
      title,
      description: description || null,
      date,
      start_time: start_time || null,
      end_time: end_time || null,
      all_day: all_day ? 1 : 0,
      kind,
      location: location || null,
      organizer_id: ctx.actor.id,
      color: ctx.body.color || '#3b82f6',
      attendees
    });
    audit(ctx, 'event.create', 'event', id, `Created event “${title}” on ${date}`);
    for (const a of attendees) push(a, { type: 'event', title: 'Event invitation', body: `${title} on ${date}${start_time ? ` at ${start_time}` : ''}`, icon: '📅', link: '#/calendar' });
    return { id };
  });

  router.patch('/api/events/:id', (ctx) => {
    update('events', Number(ctx.params.id), ctx.body);
    return { ok: true };
  });

  router.delete('/api/events/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const event = get('SELECT * FROM events WHERE id = ?', id);
    if (!event) throw notFound('Event not found');
    if (event.organizer_id !== ctx.actor.id) requirePerm(ctx, 'announcement.manage');
    run('DELETE FROM events WHERE id = ?', id);
    audit(ctx, 'event.delete', 'event', id, 'Event deleted', { severity: 'warning' });
    return { ok: true };
  });
}
