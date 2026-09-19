import { all, get, one } from '../lib/db.js';
import { addDays, dateRange, today } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { can } from '../lib/rbac.js';
import { reportTreeIds, scopeIdsOrDefault, visibleEmployeeIds } from '../lib/scope.js';
import { attendanceRollup, employeeCard, maps } from './_shared.js';
import { unreadCount } from '../lib/notify.js';

const scopeFor = (actor, query) => {
  if (query.employee_id) return [Number(query.employee_id)];
  const ids = visibleEmployeeIds(actor);
  if (ids === null) return scopeIdsOrDefault(actor);
  return ids.length ? ids : [-1];
};

export function register(router) {
  // --- home dashboard ------------------------------------------------------
  router.get('/api/dashboard', (ctx) => {
    const actor = ctx.actor;
    const m = maps();
    const date = today();
    const scope = scopeIdsOrDefault(actor);
    const marks = scope.length ? scope.map(() => '?').join(',') : 'NULL';
    const company = get('SELECT * FROM companies WHERE id = ?', actor.company_id);

    const todayRows = all(
      `SELECT a.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji, e.department_id, s.name AS shift_name
       FROM attendance a JOIN employees e ON e.id = a.employee_id LEFT JOIN shifts s ON s.id = a.shift_id
       WHERE a.date = ? AND a.employee_id IN (${marks}) ORDER BY a.first_in DESC LIMIT 200`,
      date,
      ...scope
    );
    const rollup = attendanceRollup(scope, date, date);
    const headcount = scope.length;

    const myToday = get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', actor.id, date);
    const myRoster = get('SELECT r.*, s.name AS shift_name, s.start_time, s.end_time, s.color FROM roster r LEFT JOIN shifts s ON s.id = r.shift_id WHERE r.employee_id = ? AND date = ?', actor.id, date);
    const myBalances = all(
      `SELECT b.*, lt.name, lt.code, lt.color, lt.icon FROM leave_balances b JOIN leave_types lt ON lt.id = b.leave_type_id WHERE b.employee_id = ? AND b.year = ? ORDER BY lt.name`,
      actor.id,
      Number(date.slice(0, 4))
    ).map((b) => ({ ...b, available: Number((b.entitled - b.used - b.pending).toFixed(1)) }));

    const pendingApprovals = one(`SELECT COUNT(*) FROM approvals WHERE approver_id = ? AND status = 'pending'`, actor.id);
    const myPendingLeaves = one(`SELECT COUNT(*) FROM leave_requests WHERE approver_id = ? AND status = 'pending'`, actor.id);

    const upcoming = all(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.days, lr.status, lt.name, lt.color, lt.icon, e.first_name, e.last_name
       FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id JOIN employees e ON e.id = lr.employee_id
       WHERE lr.start_date >= ? AND lr.status = 'approved' AND lr.employee_id IN (${marks}) ORDER BY lr.start_date LIMIT 8`,
      date,
      ...scope
    );

    const trends = dateRange(addDays(date, -13), date).map((d) => {
      const day = attendanceRollup(scope, d, d);
      const scheduled = one(`SELECT COUNT(*) FROM roster WHERE date = ? AND kind = 'work' AND employee_id IN (${marks})`, d, ...scope) || 0;
      return {
        date: d,
        present: day.present + day.late + day.wfh,
        late: day.late,
        absent: day.absent,
        leave: day.leave,
        scheduled,
        rate: scheduled ? Number((((day.present + day.late + day.wfh) / scheduled) * 100).toFixed(1)) : 0
      };
    });

    const announcements = all(
      'SELECT a.*, e.first_name, e.last_name FROM announcements a LEFT JOIN employees e ON e.id = a.author_id WHERE a.company_id = ? ORDER BY a.pinned DESC, a.publish_at DESC LIMIT 5',
      actor.company_id
    ).map((a) => ({ ...a, author: a.first_name ? `${a.first_name} ${a.last_name || ''}`.trim() : 'HRMate' }));

    const starWorkers = all(
      `SELECT t.id, t.first_name, t.last_name, t.designation, t.avatar_color, t.avatar_emoji, COUNT(k.id) AS kudos, COALESCE(SUM(k.points),0) AS points
       FROM employees t JOIN kudos k ON k.to_employee_id = t.id
       WHERE k.created_at >= date('now','-30 day') AND t.company_id = ? GROUP BY t.id ORDER BY points DESC LIMIT 5`,
      actor.company_id
    ).map((s) => ({ ...s, full_name: `${s.first_name} ${s.last_name || ''}`.trim() }));

    const departmentLoad = all(
      `SELECT d.id, d.name, d.color, d.icon, COUNT(e.id) AS headcount,
              SUM(CASE WHEN a.status IN ('present','late','wfh') THEN 1 ELSE 0 END) AS present
       FROM departments d LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'terminated'
       LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
       WHERE d.company_id = ? GROUP BY d.id ORDER BY headcount DESC LIMIT 8`,
      date,
      actor.company_id
    );

    const holidays = all('SELECT * FROM holidays WHERE company_id = ? AND date >= ? ORDER BY date LIMIT 5', actor.company_id, date);
    const events = all('SELECT * FROM events WHERE company_id = ? AND date >= ? ORDER BY date LIMIT 6', actor.company_id, date);

    const liveNow = todayRows.filter((r) => r.first_in && !r.last_out).length;
    const avgHoursToday = todayRows.length
      ? Number((todayRows.reduce((s, r) => s + (r.work_minutes || 0), 0) / todayRows.length / 60).toFixed(1))
      : 0;

    const tickets = one(
      `SELECT COUNT(*) FROM tickets WHERE company_id = ? AND status IN ('open','in_progress','escalated')`,
      actor.company_id
    );

    audit(ctx, 'dashboard.view', 'dashboard', null, 'Viewed dashboard');

    return {
      date,
      actor: {
        id: actor.id,
        name: `${actor.first_name} ${actor.last_name || ''}`.trim(),
        role: actor.role,
        department: m.depts[actor.department_id]?.name,
        shift: myRoster?.shift_name || (actor.shift_id ? m.shifts[actor.shift_id]?.name : null)
      },
      kpis: {
        headcount,
        presentToday: rollup.present + rollup.late + rollup.wfh,
        lateToday: rollup.late,
        onLeave: rollup.leave + rollup.half,
        absent: rollup.absent,
        onClockNow: liveNow,
        avgHoursToday,
        pendingApprovals,
        myPendingLeaves,
        unreadNotifications: unreadCount(actor.id),
        openTickets: tickets,
        attendanceRate: trends.length ? Number((trends.reduce((s, t) => s + t.rate, 0) / trends.length).toFixed(1)) : 0,
        workedHours14d: Math.round(trends.reduce((s, t) => s + t.present * 8, 0))
      },
      myDay: {
        attendance: myToday,
        roster: myRoster,
        punchState: myToday?.last_out ? 'completed' : myToday?.first_in ? 'working' : 'not_punched',
        workedMinutes: myToday?.first_in ? Math.round((Date.now() - new Date(myToday.first_in).getTime()) / 60000) : 0,
        balances: myBalances,
        nextHoliday: holidays[0] || null
      },
      trends,
      team: todayRows.slice(0, 12).map((r) => ({
        ...employeeCard(get('SELECT * FROM employees WHERE id = ?', r.employee_id), m),
        status: r.status,
        first_in: r.first_in,
        last_out: r.last_out,
        work_minutes: r.work_minutes,
        shift_name: r.shift_name
      })),
      upcomingLeaves: upcoming.map((u) => ({ ...u, full_name: `${u.first_name} ${u.last_name || ''}`.trim() })),
      announcements,
      starWorkers,
      departmentLoad: departmentLoad.map((d) => ({ ...d, rate: d.headcount ? Math.round((d.present / d.headcount) * 100) : 0 })),
      holidays,
      events,
      company
    };
  });

  // --- attendance report ---------------------------------------------------
  router.get('/api/reports/attendance', (ctx) => {
    requireReport(ctx);
    const from = ctx.query.from || addDays(today(), -29);
    const to = ctx.query.to || today();
    const scope = scopeFor(ctx.actor, ctx.query);
    const marks = scope.map(() => '?').join(',');
    const m = maps();

    const daily = dateRange(from, to).map((d) => {
      const r = attendanceRollup(scope, d, d);
      const scheduled = one(`SELECT COUNT(*) FROM roster WHERE date = ? AND kind = 'work' AND employee_id IN (${marks})`, d, ...scope) || 0;
      return { date: d, ...r, scheduled, rate: scheduled ? Number((((r.present + r.late + r.wfh) / scheduled) * 100).toFixed(1)) : 0 };
    });

    const byDepartment = all(
      `SELECT d.name, d.color, COUNT(DISTINCT a.employee_id) AS employees,
              SUM(CASE WHEN a.status IN ('present','late','wfh') THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
              SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END) AS on_leave,
              SUM(COALESCE(a.work_minutes,0)) AS minutes, SUM(COALESCE(a.ot_minutes,0)) AS ot
       FROM attendance a JOIN employees e ON e.id = a.employee_id JOIN departments d ON d.id = e.department_id
       WHERE a.date BETWEEN ? AND ? AND a.employee_id IN (${marks}) GROUP BY d.id ORDER BY present DESC`,
      from,
      to,
      ...scope
    );

    const byStatus = all(
      `SELECT status, COUNT(*) AS count FROM attendance WHERE date BETWEEN ? AND ? AND employee_id IN (${marks}) GROUP BY status`,
      from,
      to,
      ...scope
    );

    const topLate = all(
      `SELECT e.id, e.first_name, e.last_name, e.designation, e.department_id, COUNT(*) AS late_days, SUM(a.late_minutes) AS late_minutes
       FROM attendance a JOIN employees e ON e.id = a.employee_id
       WHERE a.date BETWEEN ? AND ? AND a.status = 'late' AND a.employee_id IN (${marks})
       GROUP BY e.id ORDER BY late_days DESC LIMIT 10`,
      from,
      to,
      ...scope
    ).map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim(), department: m.depts[r.department_id]?.name }));

    const methodMix = all(
      `SELECT method, COUNT(*) AS count FROM punches WHERE date(at) BETWEEN ? AND ? AND type = 'in' AND employee_id IN (${marks}) GROUP BY method ORDER BY count DESC`,
      from,
      to,
      ...scope
    );

    const geofence = {
      inside: one(`SELECT COUNT(*) FROM punches WHERE type='in' AND geofence_ok = 1 AND date(at) BETWEEN ? AND ? AND employee_id IN (${marks})`, from, to, ...scope) || 0,
      outside: one(`SELECT COUNT(*) FROM punches WHERE type='in' AND geofence_ok = 0 AND date(at) BETWEEN ? AND ? AND employee_id IN (${marks})`, from, to, ...scope) || 0
    };

    audit(ctx, 'report.view', 'report', null, `Attendance report ${from} → ${to}`);
    return {
      from,
      to,
      daily,
      byDepartment: byDepartment.map((d) => ({
        ...d,
        hours: Math.round(d.minutes / 60),
        otHours: Math.round(d.ot / 60),
        rate: d.present + d.late ? Number((((d.present + d.late) / Math.max(1, d.present + d.late + d.absent + d.on_leave)) * 100).toFixed(1)) : 0
      })),
      byStatus,
      topLate,
      methodMix,
      geofence: { ...geofence, compliance: geofence.inside + geofence.outside ? Math.round((geofence.inside / (geofence.inside + geofence.outside)) * 100) : 100 },
      rollup: attendanceRollup(scope, from, to),
      totals: {
        personDays: one(`SELECT COUNT(*) FROM attendance WHERE date BETWEEN ? AND ? AND employee_id IN (${marks})`, from, to, ...scope),
        workedHours: Math.round((one(`SELECT COALESCE(SUM(work_minutes),0) FROM attendance WHERE date BETWEEN ? AND ? AND employee_id IN (${marks})`, from, to, ...scope) || 0) / 60),
        otHours: Math.round((one(`SELECT COALESCE(SUM(ot_minutes),0) FROM attendance WHERE date BETWEEN ? AND ? AND employee_id IN (${marks})`, from, to, ...scope) || 0) / 60),
        avgDaily: Number(
          (
            (one(`SELECT AVG(work_minutes) FROM attendance WHERE date BETWEEN ? AND ? AND status IN ('present','late','wfh') AND employee_id IN (${marks})`, from, to, ...scope) || 0) / 60
          ).toFixed(1)
        )
      }
    };
  });

  // --- leave report --------------------------------------------------------
  router.get('/api/reports/leave', (ctx) => {
    requireReport(ctx);
    const from = ctx.query.from || `${today().slice(0, 4)}-01-01`;
    const to = ctx.query.to || today();
    const scope = scopeFor(ctx.actor, ctx.query);
    const marks = scope.map(() => '?').join(',');
    const byType = all(
      `SELECT lt.name, lt.code, lt.color, lt.icon, COUNT(lr.id) AS requests, COALESCE(SUM(lr.days),0) AS days
       FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.start_date BETWEEN ? AND ? AND lr.status = 'approved' AND lr.employee_id IN (${marks})
       GROUP BY lt.id ORDER BY days DESC`,
      from,
      to,
      ...scope
    );
    const byMonth = all(
      `SELECT substr(lr.start_date,1,7) AS month, COALESCE(SUM(lr.days),0) AS days, COUNT(*) AS requests
       FROM leave_requests lr WHERE lr.start_date BETWEEN ? AND ? AND lr.status='approved' AND lr.employee_id IN (${marks})
       GROUP BY month ORDER BY month`,
      from,
      to,
      ...scope
    );
    const byDepartment = all(
      `SELECT d.name, d.color, COALESCE(SUM(lr.days),0) AS days, COUNT(lr.id) AS requests
       FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id JOIN departments d ON d.id = e.department_id
       WHERE lr.start_date BETWEEN ? AND ? AND lr.status = 'approved' AND lr.employee_id IN (${marks})
       GROUP BY d.id ORDER BY days DESC`,
      from,
      to,
      ...scope
    );
    const statusMix = all(
      `SELECT status, COUNT(*) AS count FROM leave_requests WHERE start_date BETWEEN ? AND ? AND employee_id IN (${marks}) GROUP BY status`,
      from,
      to,
      ...scope
    );
    const balanceUtilisation = all(
      `SELECT lt.name, lt.code, lt.color, COALESCE(SUM(b.entitled),0) AS entitled, COALESCE(SUM(b.used),0) AS used, COALESCE(SUM(b.pending),0) AS pending
       FROM leave_balances b JOIN leave_types lt ON lt.id = b.leave_type_id
       WHERE b.employee_id IN (${marks}) AND b.year = ? GROUP BY lt.id ORDER BY used DESC`,
      ...scope,
      Number(today().slice(0, 4))
    ).map((r) => ({ ...r, utilisation: r.entitled ? Math.round((r.used / r.entitled) * 100) : 0 }));
    return {
      from,
      to,
      byType,
      byMonth,
      byDepartment,
      statusMix,
      balanceUtilisation,
      totals: {
        requests: one(`SELECT COUNT(*) FROM leave_requests WHERE start_date BETWEEN ? AND ? AND employee_id IN (${marks})`, from, to, ...scope),
        approved: one(`SELECT COUNT(*) FROM leave_requests WHERE start_date BETWEEN ? AND ? AND status='approved' AND employee_id IN (${marks})`, from, to, ...scope),
        pending: one(`SELECT COUNT(*) FROM leave_requests WHERE status='pending' AND employee_id IN (${marks})`, ...scope),
        daysTaken: Number((one(`SELECT COALESCE(SUM(days),0) FROM leave_requests WHERE start_date BETWEEN ? AND ? AND status='approved' AND employee_id IN (${marks})`, from, to, ...scope) || 0).toFixed(1)),
        avgApprovalHours: Number((one(`SELECT AVG((julianday(decided_at)-julianday(created_at))*24) FROM leave_requests WHERE decided_at IS NOT NULL AND employee_id IN (${marks})`, ...scope) || 0).toFixed(1))
      }
    };
  });

  // --- headcount -----------------------------------------------------------
  router.get('/api/reports/headcount', (ctx) => {
    requireReport(ctx);
    const companyId = ctx.actor.company_id;
    const byDepartment = all(
      `SELECT d.name, d.color, d.icon, COUNT(e.id) AS headcount,
              SUM(CASE WHEN e.employment_type = 'full_time' THEN 1 ELSE 0 END) AS full_time,
              SUM(CASE WHEN e.gender = 'female' THEN 1 ELSE 0 END) AS female,
              AVG(e.salary) AS avg_salary
       FROM departments d LEFT JOIN employees e ON e.department_id = d.id AND e.status != 'terminated'
       WHERE d.company_id = ? GROUP BY d.id ORDER BY headcount DESC`,
      companyId
    );
    const byRole = all(`SELECT role, COUNT(*) AS count FROM employees WHERE company_id = ? AND status != 'terminated' GROUP BY role`, companyId);
    const byLocation = all(
      `SELECT l.name, COUNT(e.id) AS count FROM locations l LEFT JOIN employees e ON e.location_id = l.id AND e.status != 'terminated' WHERE l.company_id = ? GROUP BY l.id`,
      companyId
    );
    const byTenure = all(
      `SELECT CASE
          WHEN julianday('now') - julianday(join_date) < 365 THEN '0-1 yr'
          WHEN julianday('now') - julianday(join_date) < 1095 THEN '1-3 yrs'
          WHEN julianday('now') - julianday(join_date) < 1825 THEN '3-5 yrs'
          ELSE '5+ yrs' END AS band, COUNT(*) AS count
       FROM employees WHERE company_id = ? AND status != 'terminated' GROUP BY band`,
      companyId
    );
    const byWorkMode = all(`SELECT work_mode, COUNT(*) AS count FROM employees WHERE company_id = ? AND status != 'terminated' GROUP BY work_mode`, companyId);
    const joiners = all(
      `SELECT substr(join_date,1,7) AS month, COUNT(*) AS joiners FROM employees WHERE company_id = ? AND join_date >= date('now','-12 month') GROUP BY month ORDER BY month`,
      companyId
    );
    const exits = all(
      `SELECT substr(exit_date,1,7) AS month, COUNT(*) AS exits FROM employees WHERE company_id = ? AND exit_date IS NOT NULL AND exit_date >= date('now','-12 month') GROUP BY month ORDER BY month`,
      companyId
    );
    return {
      total: one(`SELECT COUNT(*) FROM employees WHERE company_id = ? AND status != 'terminated'`, companyId),
      newJoiners30: one(`SELECT COUNT(*) FROM employees WHERE company_id = ? AND join_date >= date('now','-30 day')`, companyId),
      exits12m: one(`SELECT COUNT(*) FROM employees WHERE company_id = ? AND exit_date >= date('now','-12 month')`, companyId),
      attrition: Number(
        (
          ((one(`SELECT COUNT(*) FROM employees WHERE company_id = ? AND exit_date >= date('now','-12 month')`, companyId) || 0) /
            Math.max(1, one(`SELECT COUNT(*) FROM employees WHERE company_id = ?`, companyId))) *
          100
        ).toFixed(1)
      ),
      avgSalary: Math.round(one(`SELECT AVG(salary) FROM employees WHERE company_id = ? AND status != 'terminated'`, companyId) || 0),
      diversity: Number(
        (
          ((one(`SELECT COUNT(*) FROM employees WHERE company_id = ? AND gender = 'female' AND status != 'terminated'`, companyId) || 0) /
            Math.max(1, one(`SELECT COUNT(*) FROM employees WHERE company_id = ? AND status != 'terminated'`, companyId))) *
          100
        ).toFixed(1)
      ),
      byDepartment: byDepartment.map((d) => ({ ...d, avg_salary: Math.round(d.avg_salary || 0) })),
      byRole,
      byLocation,
      byTenure,
      byWorkMode,
      joiners,
      exits
    };
  });

  // --- payroll -------------------------------------------------------------
  router.get('/api/reports/payroll', (ctx) => {
    if (!can(ctx.actor, 'report.payroll')) {
      const err = new Error('Payroll data requires HR access');
      err.status = 403;
      throw err;
    }
    const companyId = ctx.actor.company_id;
    const scope = scopeFor(ctx.actor, ctx.query);
    const marks = scope.map(() => '?').join(',');
    const month = ctx.query.month || today().slice(0, 7);
    const rows = all(
      `SELECT e.id, e.first_name, e.last_name, e.emp_code, e.designation, e.salary, e.department_id,
              COUNT(a.id) AS days_worked, SUM(COALESCE(a.work_minutes,0)) AS minutes, SUM(COALESCE(a.ot_minutes,0)) AS ot,
              SUM(CASE WHEN a.status = 'on_leave' THEN 1 ELSE 0 END) AS leave_days,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_days, SUM(COALESCE(a.late_minutes,0)) AS late_minutes
       FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND a.date LIKE ?
       WHERE e.company_id = ? AND e.status != 'terminated' AND e.id IN (${marks})
       GROUP BY e.id ORDER BY e.first_name`,
      `${month}%`,
      companyId,
      ...scope
    );
    const m = maps();
    const enriched = rows.map((r) => {
      const monthly = (r.salary || 0) / 12;
      const lopDays = (r.absent_days || 0) + Math.max(0, (r.leave_days || 0) - 1);
      const lop = Math.round((monthly / 30) * lopDays);
      const otPay = Math.round(((monthly / 22 / 8) * 2 * (r.ot || 0)) / 60);
      return {
        ...r,
        full_name: `${r.first_name} ${r.last_name || ''}`.trim(),
        department: m.depts[r.department_id]?.name,
        gross: Math.round(monthly),
        lop,
        otPay,
        net: Math.round(monthly - lop + otPay)
      };
    });
    return {
      month,
      rows: enriched,
      totals: {
        gross: enriched.reduce((s, r) => s + r.gross, 0),
        lop: enriched.reduce((s, r) => s + r.lop, 0),
        overtime: enriched.reduce((s, r) => s + r.otPay, 0),
        net: enriched.reduce((s, r) => s + r.net, 0),
        headcount: enriched.length,
        avgDaysWorked: enriched.length ? Number((enriched.reduce((s, r) => s + r.days_worked, 0) / enriched.length).toFixed(1)) : 0
      }
    };
  });

  // --- performance ---------------------------------------------------------
  router.get('/api/reports/performance', (ctx) => {
    requireReport(ctx);
    const scope = scopeFor(ctx.actor, ctx.query);
    const marks = scope.map(() => '?').join(',');
    const ratings = all(
      `SELECT e.id, e.first_name, e.last_name, e.designation, e.department_id, AVG(r.rating) AS rating, COUNT(r.id) AS reviews
       FROM employees e LEFT JOIN reviews r ON r.employee_id = e.id AND r.rating IS NOT NULL
       WHERE e.id IN (${marks}) GROUP BY e.id ORDER BY rating DESC LIMIT 20`,
      ...scope
    ).map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim(), rating: r.rating ? Number(Number(r.rating).toFixed(2)) : null }));
    const goals = all(
      `SELECT status, COUNT(*) AS count, AVG(progress) AS avg_progress FROM goals WHERE employee_id IN (${marks}) GROUP BY status`,
      ...scope
    );
    const byDepartment = all(
      `SELECT d.name, d.color, AVG(r.rating) AS rating, COUNT(r.id) AS reviews FROM reviews r
       JOIN employees e ON e.id = r.employee_id JOIN departments d ON d.id = e.department_id
       WHERE r.rating IS NOT NULL AND e.id IN (${marks}) GROUP BY d.id ORDER BY rating DESC`,
      ...scope
    );
    const skills = all(
      `SELECT e.skills FROM employees e WHERE e.id IN (${marks})`,
      ...scope
    ).flatMap((r) => {
      try {
        return JSON.parse(r.skills || '[]');
      } catch {
        return [];
      }
    });
    const skillCount = {};
    for (const s of skills) skillCount[s] = (skillCount[s] || 0) + 1;
    return {
      topPerformers: ratings.filter((r) => r.rating).slice(0, 10),
      needsAttention: ratings.filter((r) => r.rating && r.rating < 3.4).slice(-5),
      goals: goals.map((g) => ({ ...g, avg_progress: Math.round(g.avg_progress || 0) })),
      byDepartment: byDepartment.map((d) => ({ ...d, rating: Number(Number(d.rating).toFixed(2)) })),
      skills: Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count })),
      avgRating: Number((one(`SELECT AVG(rating) FROM reviews WHERE rating IS NOT NULL AND employee_id IN (${marks})`, ...scope) || 0).toFixed(2)),
      goalCompletion: Math.round(one(`SELECT AVG(progress) FROM goals WHERE employee_id IN (${marks})`, ...scope) || 0)
    };
  });

  // --- helpdesk ------------------------------------------------------------
  router.get('/api/reports/helpdesk', (ctx) => {
    requireReport(ctx);
    const companyId = ctx.actor.company_id;
    return {
      byStatus: all('SELECT status, COUNT(*) AS count FROM tickets WHERE company_id = ? GROUP BY status', companyId),
      byCategory: all('SELECT category, COUNT(*) AS count, AVG(rating) AS rating FROM tickets WHERE company_id = ? GROUP BY category ORDER BY count DESC', companyId),
      byPriority: all('SELECT priority, COUNT(*) AS count FROM tickets WHERE company_id = ? GROUP BY priority', companyId),
      byMonth: all(`SELECT substr(created_at,1,7) AS month, COUNT(*) AS count FROM tickets WHERE company_id = ? GROUP BY month ORDER BY month DESC LIMIT 12`, companyId),
      totals: {
        open: one(`SELECT COUNT(*) FROM tickets WHERE company_id = ? AND status IN ('open','in_progress','escalated')`, companyId),
        resolved: one(`SELECT COUNT(*) FROM tickets WHERE company_id = ? AND status IN ('resolved','closed')`, companyId),
        avgRating: Number((one(`SELECT AVG(rating) FROM tickets WHERE company_id = ? AND rating IS NOT NULL`, companyId) || 0).toFixed(2)),
        avgResolutionHours: Number(
          (one(`SELECT AVG((julianday(resolved_at)-julianday(created_at))*24) FROM tickets WHERE company_id = ? AND resolved_at IS NOT NULL`, companyId) || 0).toFixed(1)
        )
      }
    };
  });

  // --- engagement ----------------------------------------------------------
  router.get('/api/reports/engagement', (ctx) => {
    requireReport(ctx);
    const companyId = ctx.actor.company_id;
    return {
      posts: all(`SELECT substr(created_at,1,7) AS month, COUNT(*) AS posts FROM posts WHERE company_id = ? GROUP BY month ORDER BY month DESC LIMIT 12`, companyId),
      kudos: all(`SELECT substr(created_at,1,7) AS month, COUNT(*) AS kudos, COALESCE(SUM(points),0) AS points FROM kudos WHERE company_id = ? GROUP BY month ORDER BY month DESC LIMIT 12`, companyId),
      values: all('SELECT value, COUNT(*) AS count FROM kudos WHERE company_id = ? GROUP BY value ORDER BY count DESC', companyId),
      participation: {
        posters: one('SELECT COUNT(DISTINCT employee_id) FROM posts WHERE company_id = ?', companyId),
        kudoGivers: one('SELECT COUNT(DISTINCT from_employee_id) FROM kudos WHERE company_id = ?', companyId),
        kudoReceivers: one('SELECT COUNT(DISTINCT to_employee_id) FROM kudos WHERE company_id = ?', companyId),
        headcount: one(`SELECT COUNT(*) FROM employees WHERE company_id = ? AND status != 'terminated'`, companyId)
      }
    };
  });

  // --- workforce / shift analytics ----------------------------------------
  router.get('/api/reports/workforce', (ctx) => {
    requireReport(ctx);
    const companyId = ctx.actor.company_id;
    const from = ctx.query.from || addDays(today(), -29);
    const to = ctx.query.to || today();
    return {
      shifts: all(
        `SELECT s.name, s.color, s.start_time, s.end_time, s.work_hours, COUNT(e.id) AS employees
         FROM shifts s LEFT JOIN employees e ON e.shift_id = s.id AND e.status != 'terminated'
         WHERE s.company_id = ? GROUP BY s.id ORDER BY employees DESC`,
        companyId
      ),
      coverage: dateRange(from, to).map((d) => ({
        date: d,
        scheduled: one(`SELECT COUNT(*) FROM roster WHERE date = ? AND kind = 'work' AND company_id = ?`, d, companyId) || 0,
        onLeave: one(`SELECT COUNT(*) FROM leave_requests WHERE status='approved' AND start_date <= ? AND end_date >= ? AND company_id = ?`, d, d, companyId) || 0
      })),
      overtime: all(
        `SELECT e.id, e.first_name, e.last_name, SUM(o.minutes) AS minutes, COUNT(*) AS requests FROM overtime_requests o JOIN employees e ON e.id = o.employee_id
         WHERE o.company_id = ? AND o.status = 'approved' GROUP BY e.id ORDER BY minutes DESC LIMIT 10`,
        companyId
      ).map((r) => ({ ...r, full_name: `${r.first_name} ${r.last_name || ''}`.trim(), hours: Number((r.minutes / 60).toFixed(1)) })),
      swaps: {
        pending: one(`SELECT COUNT(*) FROM swap_requests WHERE company_id = ? AND status='pending'`, companyId),
        approved: one(`SELECT COUNT(*) FROM swap_requests WHERE company_id = ? AND status='approved'`, companyId)
      },
      utilisation: {
        scheduledHours: Math.round(one(`SELECT COALESCE(SUM(work_minutes),0) FROM attendance WHERE company_id = ? AND date BETWEEN ? AND ?`, companyId, from, to) / 60),
        capacityHours: Math.round((one(`SELECT COUNT(*) FROM roster WHERE company_id = ? AND date BETWEEN ? AND ? AND kind='work'`, companyId, from, to) || 0) * 8),
        otHours: Math.round(one(`SELECT COALESCE(SUM(ot_minutes),0) FROM attendance WHERE company_id = ? AND date BETWEEN ? AND ?`, companyId, from, to) / 60)
      }
    };
  });

  // --- CSV export ----------------------------------------------------------
  router.get('/api/reports/export', (ctx) => {
    requireReport(ctx);
    const kind = ctx.query.kind || 'attendance';
    const from = ctx.query.from || addDays(today(), -29);
    const to = ctx.query.to || today();
    const scope = scopeFor(ctx.actor, ctx.query);
    const marks = scope.map(() => '?').join(',');
    let rows = [];
    if (kind === 'attendance') {
      rows = all(
        `SELECT e.emp_code, e.first_name, e.last_name, e.designation, a.date, a.status, a.first_in, a.last_out, a.work_minutes, a.late_minutes
         FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.date BETWEEN ? AND ? AND a.employee_id IN (${marks}) ORDER BY a.date`,
        from,
        to,
        ...scope
      );
    } else if (kind === 'employees') {
      rows = all(
        `SELECT emp_code, first_name, last_name, email, phone, designation, role, department_id, location_id, join_date, status, work_mode
         FROM employees WHERE company_id = ? AND id IN (${marks}) ORDER BY first_name`,
        ctx.actor.company_id,
        ...scope
      );
    } else if (kind === 'leave') {
      rows = all(
        `SELECT e.emp_code, e.first_name, e.last_name, lt.name AS leave_type, lr.start_date, lr.end_date, lr.days, lr.status, lr.reason
         FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.start_date BETWEEN ? AND ? AND lr.employee_id IN (${marks}) ORDER BY lr.start_date`,
        from,
        to,
        ...scope
      );
    }
    audit(ctx, 'report.export', 'report', null, `Exported ${kind} report (${rows.length} rows)`);
    return { kind, from, to, count: rows.length, rows };
  });
}

function requireReport(ctx) {
  if (!can(ctx.actor, 'report.team') && !can(ctx.actor, 'report.company')) {
    const err = new Error('You do not have access to reports');
    err.status = 403;
    throw err;
  }
}
