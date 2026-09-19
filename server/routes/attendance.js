import { all, get, insert, one, run, update } from '../lib/db.js';
import { addDays, badRequest, dateRange, haversine, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { departmentTreeIds, employeeLabel, scopeClause, scopeIdsOrDefault, visibleEmployeeIds } from '../lib/scope.js';
import { attendanceRollup, employeeCard, maps, statusTone } from './_shared.js';

function shiftWindow(shift, dateISO) {
  if (!shift) return null;
  const [sh, sm] = (shift.start_time || '09:00').split(':').map(Number);
  const [eh, em] = (shift.end_time || '18:00').split(':').map(Number);
  const start = new Date(dateISO + 'T00:00:00Z');
  start.setUTCHours(sh, sm, 0, 0);
  const end = new Date(dateISO + 'T00:00:00Z');
  end.setUTCHours(eh, em, 0, 0);
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function nearestLocation(companyId, lat, lng) {
  const locations = all('SELECT * FROM locations WHERE company_id = ? AND type != ? ORDER BY name', companyId, 'remote');
  let best = null;
  for (const l of locations) {
    if (l.latitude === null || l.longitude === null) continue;
    const distance = haversine(lat, lng, l.latitude, l.longitude);
    if (!best || distance < best.distance) best = { ...l, distance: Number(distance.toFixed(1)) };
  }
  return best;
}

export function register(router) {
  // --- my day --------------------------------------------------------------
  router.get('/api/attendance/today', (ctx) => {
    const date = ctx.query.date || today();
    const m = maps();
    const emp = ctx.actor;
    const rosterRow = get('SELECT * FROM roster WHERE employee_id = ? AND date = ?', emp.id, date);
    const att = get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', emp.id, date);
    const shift = (rosterRow?.shift_id || emp.shift_id) ? get('SELECT * FROM shifts WHERE id = ?', rosterRow?.shift_id || emp.shift_id) : null;
    const location = emp.location_id ? get('SELECT * FROM locations WHERE id = ?', emp.location_id) : null;
    const punches = att ? all('SELECT * FROM punches WHERE attendance_id = ? ORDER BY at', att.id) : [];
    const holiday = get('SELECT * FROM holidays WHERE date = ? AND company_id = ?', date, emp.company_id);
    const window = shift ? shiftWindow(shift, date) : null;
    const nowMinutes = (Date.now() - new Date(date + 'T00:00:00Z').getTime()) / 60000;
    const worked = att?.first_in ? Math.max(0, Math.round((att.last_out ? new Date(att.last_out).getTime() : Date.now()) - new Date(att.first_in).getTime()) / 60000) : 0;
    const onLeave = get(
      `SELECT lr.*, lt.name AS leave_name, lt.color, lt.icon FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.employee_id = ? AND lr.status = 'approved' AND ? BETWEEN lr.start_date AND lr.end_date`,
      emp.id,
      date
    );
    return {
      date,
      attendance: att ? { ...att, punches, tone: statusTone(att.status) } : null,
      shift,
      scheduled: rosterRow?.kind === 'work',
      rosterKind: rosterRow?.kind || (shift ? 'work' : 'off'),
      holiday,
      onLeave,
      location,
      geofenceRadius: location?.radius_m || 250,
      workedMinutes: worked,
      expectedMinutes: window ? Math.round((window.end - window.start) / 60000) - (shift?.break_minutes || 0) : 480,
      progress: window ? Math.min(1, Math.max(0, (nowMinutes - (window.start - new Date(date + 'T00:00:00Z')) / 60000) / ((window.end - window.start) / 60000))) : 0,
      punchState: att?.last_out ? 'completed' : att?.first_in ? 'working' : 'not_punched',
      weekPreview: dateRange(addDays(date, -3), addDays(date, 3)).map((d) => {
        const a = get('SELECT date, status, first_in, last_out, work_minutes FROM attendance WHERE employee_id = ? AND date = ?', emp.id, d);
        return a || { date: d, status: 'none' };
      })
    };
  });

  // --- punch ---------------------------------------------------------------
  router.post('/api/attendance/punch', (ctx) => {
    const {
      type = 'in',
      latitude = null,
      longitude = null,
      accuracy = null,
      method = 'manual',
      score = null,
      note = null,
      deviceId = null
    } = ctx.body;
    const date = ctx.query.date || today();
    const emp = ctx.actor;
    const location = emp.location_id ? get('SELECT * FROM locations WHERE id = ?', emp.location_id) : null;
    const company = get('SELECT * FROM companies WHERE id = ?', emp.company_id);
    const att = get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', emp.id, date);

    if (type === 'out' && !att?.first_in) throw badRequest('You have not punched in today');
    if (type === 'in' && att?.first_in) throw badRequest('You already punched in today');

    // --- geofence evaluation ------------------------------------------------
    let geofenceOk = 1;
    let distance = null;
    let resolvedLocId = location?.id || null;
    if (latitude !== null && longitude !== null) {
      const nearest = nearestLocation(emp.company_id, latitude, longitude);
      if (nearest) {
        distance = nearest.distance;
        resolvedLocId = nearest.id;
        geofenceOk = distance <= (nearest.radius_m || company?.punch_radius_m || 250) ? 1 : 0;
      } else {
        geofenceOk = 0;
      }
      // remote/WFH employees and remote-punch policy allow out-of-fence punches
      if (!geofenceOk && (company?.allow_remote_punch || emp.work_mode === 'remote') && method !== 'biometric') {
        geofenceOk = 0; // recorded, but flagged; punch still accepted with a note
      }
    }
    if (['face', 'fingerprint'].includes(method) && !(score >= 0.85)) throw badRequest('Biometric verification failed — try again');

    const now = nowIso();
    const shift = get('SELECT * FROM shifts WHERE id = ?', att?.shift_id || emp.shift_id);
    let lateMinutes = 0;
    let status = 'present';

    if (type === 'in') {
      const window = shift ? shiftWindow(shift, date) : null;
      if (window) {
        const diff = Math.round((new Date(now).getTime() - window.start.getTime()) / 60000);
        lateMinutes = Math.max(0, diff - (shift.grace_min || 10));
      }
      status = lateMinutes > (company?.late_grace_min || 15) ? 'late' : 'present';
      const id = insert('attendance', {
        company_id: emp.company_id,
        employee_id: emp.id,
        date,
        shift_id: shift?.id || null,
        first_in: now,
        status,
        in_method: method,
        in_lat: latitude,
        in_lng: longitude,
        in_accuracy: accuracy,
        in_location_id: resolvedLocId,
        geofence_ok: geofenceOk,
        notes: note
      });
      insert('punches', {
        company_id: emp.company_id,
        employee_id: emp.id,
        attendance_id: id,
        type: 'in',
        at: now,
        method,
        lat: latitude,
        lng: longitude,
        accuracy,
        distance_m: distance,
        geofence_ok: geofenceOk,
        device_id: deviceId,
        face_score: method === 'face' ? score : null,
        fingerprint_score: method === 'fingerprint' ? score : null,
        ip: ctx.ip,
        note
      });
      if (deviceId) run('UPDATE devices SET last_seen_at = ?, last_lat = ?, last_lng = ? WHERE id = ?', now, latitude, longitude, deviceId);
      audit(ctx, 'attendance.punch_in', 'attendance', id, `Punched in at ${now.slice(11, 16)} via ${method}`, { meta: { distance, geofenceOk } });
      if (emp.manager_id) {
        push(emp.manager_id, {
          type: 'attendance',
          title: 'Team punch-in',
          body: `${employeeLabel(emp)} punched in${lateMinutes ? ` (${lateMinutes} min late)` : ''}.`,
          icon: '🕘',
          link: '#/attendance'
        });
      }
      return {
        ok: true,
        attendance: get('SELECT * FROM attendance WHERE id = ?', id),
        geofence: { ok: !!geofenceOk, distance, radius: location?.radius_m || 250, location: location?.name },
        lateMinutes,
        message: geofenceOk ? 'Punched in successfully' : 'Punched in outside the geofence — flagged for review'
      };
    }

    // punch out ---------------------------------------------------------------
    const worked = Math.round((Date.now() - new Date(att.first_in).getTime()) / 60000);
    const expected = shift ? (shift.work_hours || 8) * 60 : 480;
    const otMinutes = Math.max(0, worked - (shift?.break_minutes || 0) - expected);
    const outStatus = worked < expected * 0.55 ? 'half_day' : att.status === 'late' ? 'late' : 'present';
    update('attendance', att.id, {
      last_out: now,
      work_minutes: worked,
      ot_minutes: otMinutes,
      break_minutes: shift?.break_minutes || 0,
      status: outStatus,
      out_method: method,
      out_lat: latitude,
      out_lng: longitude,
      out_accuracy: accuracy,
      out_location_id: resolvedLocId,
      geofence_ok: geofenceOk ? att.geofence_ok : 0
    });
    insert('punches', {
      company_id: emp.company_id,
      employee_id: emp.id,
      attendance_id: att.id,
      type: 'out',
      at: now,
      method,
      lat: latitude,
      lng: longitude,
      accuracy,
      distance_m: distance,
      geofence_ok: geofenceOk,
      device_id: deviceId,
      face_score: method === 'face' ? score : null,
      fingerprint_score: method === 'fingerprint' ? score : null,
      ip: ctx.ip,
      note
    });
    audit(ctx, 'attendance.punch_out', 'attendance', att.id, `Punched out after ${worked} min via ${method}`);
    if (otMinutes > 30) {
      const oid = insert('overtime_requests', {
        company_id: emp.company_id,
        employee_id: emp.id,
        date,
        minutes: otMinutes,
        reason: 'Auto-generated from punch-out',
        status: 'pending',
        approver_id: emp.manager_id
      });
      insert('approvals', {
        company_id: emp.company_id,
        type: 'overtime',
        ref_id: oid,
        requester_id: emp.id,
        approver_id: emp.manager_id,
        summary: `Overtime · ${otMinutes} min · ${date}`,
        status: 'pending'
      });
    }
    return {
      ok: true,
      attendance: get('SELECT * FROM attendance WHERE id = ?', att.id),
      workedMinutes: worked,
      otMinutes,
      geofence: { ok: !!geofenceOk, distance, radius: location?.radius_m || 250, location: location?.name },
      message: 'Punched out successfully'
    };
  });

  // --- geofence probe (used by the punch screen) ---------------------------
  router.get('/api/geofence/check', (ctx) => {
    const lat = Number(ctx.query.latitude);
    const lng = Number(ctx.query.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest('latitude and longitude are required');
    const nearest = nearestLocation(ctx.actor.company_id, lat, lng);
    const company = get('SELECT * FROM companies WHERE id = ?', ctx.actor.company_id);
    const radius = nearest?.radius_m || company?.punch_radius_m || 250;
    return {
      ok: nearest ? nearest.distance <= radius : false,
      distance: nearest?.distance ?? null,
      radius,
      location: nearest ? { id: nearest.id, name: nearest.name, address: nearest.address, city: nearest.city, latitude: nearest.latitude, longitude: nearest.longitude } : null,
      allowRemote: !!company?.allow_remote_punch
    };
  });

  // --- my history ----------------------------------------------------------
  router.get('/api/attendance/my', (ctx) => {
    const from = ctx.query.from || addDays(today(), -29);
    const to = ctx.query.to || today();
    const rows = all(
      `SELECT a.*, s.name AS shift_name, s.start_time, s.end_time, s.color AS shift_color
       FROM attendance a LEFT JOIN shifts s ON s.id = a.shift_id
       WHERE a.employee_id = ? AND a.date BETWEEN ? AND ? ORDER BY a.date DESC`,
      ctx.actor.id,
      from,
      to
    );
    const rollup = attendanceRollup([ctx.actor.id], from, to);
    const days = dateRange(from, to).length;
    const worked = rows.filter((r) => ['present', 'late', 'wfh', 'half_day'].includes(r.status)).length;
    return {
      rows: rows.map((r) => ({ ...r, tone: statusTone(r.status) })),
      rollup,
      summary: {
        days,
        worked,
        attendanceRate: worked ? Number(((worked / Math.max(1, days - rollup.holiday - rollup.weekOff)) * 100).toFixed(1)) : 0,
        avgHours: worked ? Number((rows.reduce((s, r) => s + (r.work_minutes || 0), 0) / worked / 60).toFixed(1)) : 0,
        lateCount: rollup.late,
        otHours: Number((rollup.otMinutes / 60).toFixed(1)),
        leaveDays: rollup.leave + rollup.half * 0.5
      }
    };
  });

  // --- team / company attendance board -------------------------------------
  router.get('/api/attendance/team', (ctx) => {
    const date = ctx.query.date || today();
    const m = maps();
    const scope = visibleEmployeeIds(ctx.actor);
    let ids = scope === null ? all("SELECT id FROM employees WHERE company_id = ? AND status != 'terminated'", ctx.actor.company_id).map((r) => r.id) : scope;
    if (ctx.query.department) {
      const deptIds = departmentTreeIds(Number(ctx.query.department));
      const marks = deptIds.map(() => '?').join(',');
      ids = ids.filter((id) => deptIds.includes(get('SELECT department_id FROM employees WHERE id = ?', id)?.department_id));
      void marks;
    }
    if (ctx.query.manager) {
      const mid = Number(ctx.query.manager);
      ids = ids.filter((id) => get('SELECT manager_id FROM employees WHERE id = ?', id)?.manager_id === mid);
    }
    const marks = ids.length ? ids.map(() => '?').join(',') : 'NULL';
    const attRows = all(`SELECT * FROM attendance WHERE date = ? AND employee_id IN (${marks})`, date, ...ids);
    const attByEmp = Object.fromEntries(attRows.map((a) => [a.employee_id, a]));
    const people = ids.length
      ? all(`SELECT * FROM employees WHERE id IN (${marks}) ORDER BY first_name`, ...ids)
      : [];
    let rows = people.map((e) => {
      const a = attByEmp[e.id];
      const roster = get('SELECT kind FROM roster WHERE employee_id = ? AND date = ?', e.id, date);
      return {
        ...employeeCard(e, m),
        status: a?.status || (roster?.kind === 'work' ? 'not_punched' : 'off'),
        first_in: a?.first_in || null,
        last_out: a?.last_out || null,
        work_minutes: a?.work_minutes || 0,
        late_minutes: a?.late_minutes || 0,
        in_method: a?.in_method || null,
        geofence_ok: a?.geofence_ok,
        tone: statusTone(a?.status || (roster?.kind === 'work' ? 'missed_punch' : 'week_off'))
      };
    });
    if (ctx.query.status) rows = rows.filter((r) => r.status === ctx.query.status);
    if (ctx.query.search) {
      const s = ctx.query.search.toLowerCase();
      rows = rows.filter((r) => r.full_name.toLowerCase().includes(s) || (r.designation || '').toLowerCase().includes(s));
    }
    const rollup = attendanceRollup(ids, date, date);
    return {
      date,
      rows,
      rollup,
      totals: {
        headcount: rows.length,
        present: rows.filter((r) => ['present', 'late', 'wfh'].includes(r.status)).length,
        onLeave: rows.filter((r) => r.status === 'on_leave').length,
        absent: rows.filter((r) => ['absent', 'missed_punch'].includes(r.status)).length,
        off: rows.filter((r) => ['off', 'week_off', 'holiday'].includes(r.status)).length,
        notPunched: rows.filter((r) => r.status === 'not_punched').length
      }
    };
  });

  // --- live workforce (who is on the clock right now) ----------------------
  router.get('/api/attendance/live', (ctx) => {
    const m = maps();
    const scope = scopeIdsOrDefault(ctx.actor);
    if (!scope.length) return { rows: [], totals: {} };
    const marks = scope.map(() => '?').join(',');
    const rows = all(
      `SELECT a.*, e.first_name, e.last_name, e.designation, e.avatar_color, e.avatar_emoji, e.department_id, s.name AS shift_name
       FROM attendance a JOIN employees e ON e.id = a.employee_id LEFT JOIN shifts s ON s.id = a.shift_id
       WHERE a.date = ? AND a.first_in IS NOT NULL AND a.last_out IS NULL AND a.employee_id IN (${marks})
       ORDER BY a.first_in`,
      today(),
      ...scope
    );
    const now = Date.now();
    return {
      rows: rows.map((r) => ({
        ...r,
        full_name: `${r.first_name} ${r.last_name || ''}`.trim(),
        workedMinutes: Math.round((now - new Date(r.first_in).getTime()) / 60000),
        department: m.depts[r.department_id]?.name
      })),
      totals: {
        onClock: rows.length,
        avgHours: rows.length ? Number((rows.reduce((s, r) => s + (now - new Date(r.first_in).getTime()) / 3600000, 0) / rows.length).toFixed(1)) : 0,
        longest: rows.length ? Math.round((now - new Date(rows[0].first_in).getTime()) / 60000) : 0
      }
    };
  });

  // --- history for a person (managers/HR) ----------------------------------
  router.get('/api/attendance/employee/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const from = ctx.query.from || addDays(today(), -29);
    const to = ctx.query.to || today();
    const rows = all(
      'SELECT * FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC',
      id,
      from,
      to
    );
    return { rows: rows.map((r) => ({ ...r, tone: statusTone(r.status) })), rollup: attendanceRollup([id], from, to) };
  });

  // --- regularization / manual edit ----------------------------------------
  router.post('/api/attendance/regularize', (ctx) => {
    const { date, reason, first_in, last_out } = ctx.body;
    if (!date) throw badRequest('date is required');
    const employeeId = Number(ctx.body.employee_id) || ctx.actor.id;
    if (employeeId !== ctx.actor.id) requirePerm(ctx, 'attendance.regularize');
    let att = get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', employeeId, date);
    const payload = {
      status: ctx.body.status || 'present',
      notes: reason || 'Regularised by employee',
      regularized: 1,
      first_in: first_in || att?.first_in || new Date(date + 'T09:05:00Z').toISOString(),
      last_out: last_out || att?.last_out || new Date(date + 'T18:10:00Z').toISOString()
    };
    if (!payload.first_in || !payload.last_out) throw badRequest('Both in and out times are required');
    payload.work_minutes = Math.round((new Date(payload.last_out).getTime() - new Date(payload.first_in).getTime()) / 60000);
    if (att) {
      update('attendance', att.id, payload);
    } else {
      att = { id: insert('attendance', { company_id: ctx.actor.company_id, employee_id: employeeId, date, ...payload }) };
    }
    audit(ctx, 'attendance.regularize', 'attendance', att.id, `Regularised attendance for ${date}`, { meta: { reason } });
    const oid = insert('approvals', {
      company_id: ctx.actor.company_id,
      type: 'regularization',
      ref_id: att.id,
      requester_id: employeeId,
      approver_id: get('SELECT manager_id FROM employees WHERE id = ?', employeeId)?.manager_id,
      summary: `Attendance regularisation · ${date}`,
      status: 'pending'
    });
    return { ok: true, approvalId: oid, attendance: get('SELECT * FROM attendance WHERE id = ?', att.id) };
  });

  router.patch('/api/attendance/:id', (ctx) => {
    requirePerm(ctx, 'attendance.edit_any');
    const id = Number(ctx.params.id);
    const allowed = ['status', 'first_in', 'last_out', 'work_minutes', 'notes', 'shift_id', 'regularized'];
    const patch = {};
    for (const f of allowed) if (ctx.body[f] !== undefined) patch[f] = ctx.body[f];
    if (patch.first_in && patch.last_out) {
      patch.work_minutes = Math.round((new Date(patch.last_out).getTime() - new Date(patch.first_in).getTime()) / 60000);
    }
    update('attendance', id, patch);
    audit(ctx, 'attendance.edit', 'attendance', id, 'Attendance record edited by HR', { severity: 'warning', meta: Object.keys(patch) });
    return { ok: true, attendance: get('SELECT * FROM attendance WHERE id = ?', id) };
  });

  // --- monthly grid --------------------------------------------------------
  router.get('/api/attendance/monthly', (ctx) => {
    const month = ctx.query.month || today().slice(0, 7);
    const scope = scopeIdsOrDefault(ctx.actor);
    const marks = scope.length ? scope.map(() => '?').join(',') : 'NULL';
    const rows = all(
      `SELECT employee_id, date, status, work_minutes, late_minutes FROM attendance
       WHERE date LIKE ? AND employee_id IN (${marks})`,
      `${month}%`,
      ...scope
    );
    const employees = scope.length ? all(`SELECT id, first_name, last_name, department_id FROM employees WHERE id IN (${marks})`, ...scope) : [];
    return {
      month,
      dates: dateRange(`${month}-01`, `${month}-28`),
      employees: employees.map((e) => {
        const mine = rows.filter((r) => r.employee_id === e.id);
        return {
          id: e.id,
          name: `${e.first_name} ${e.last_name || ''}`.trim(),
          days: mine.map((r) => ({ date: r.date, status: r.status, tone: statusTone(r.status), minutes: r.work_minutes, late: r.late_minutes }))
        };
      })
    };
  });
}
