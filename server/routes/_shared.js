import { all, get, one } from '../lib/db.js';
import { roleMeta } from '../lib/rbac.js';
import { safeParse } from '../lib/auth.js';
import { visibleEmployeeIds } from '../lib/scope.js';

export const DEPT_MAP = () => Object.fromEntries(all('SELECT id, name, code, color, icon, parent_id FROM departments').map((d) => [d.id, d]));
export const LOC_MAP = () => Object.fromEntries(all('SELECT id, name, city, latitude, longitude, radius_m, type FROM locations').map((l) => [l.id, l]));
export const SHIFT_MAP = () => Object.fromEntries(all('SELECT * FROM shifts').map((s) => [s.id, s]));
export const LEAVE_TYPE_MAP = () => Object.fromEntries(all('SELECT * FROM leave_types').map((l) => [l.id, l]));

export function empMap(ids) {
  if (!ids) return {};
  const list = ids.length ? ids : all('SELECT id FROM employees').map((r) => r.id);
  const marks = list.map(() => '?').join(',');
  return Object.fromEntries(
    all(
      `SELECT id, first_name, last_name, email, role, designation, avatar_color, avatar_emoji, department_id, emp_code, phone, status FROM employees WHERE id IN (${marks})`,
      ...list
    ).map((e) => [e.id, e])
  );
}

export function personRef(e) {
  if (!e) return null;
  return {
    id: e.id,
    name: `${e.first_name} ${e.last_name || ''}`.trim(),
    designation: e.designation,
    role: e.role,
    role_label: roleMeta(e.role).label,
    email: e.email,
    avatar_color: e.avatar_color,
    avatar_emoji: e.avatar_emoji,
    emp_code: e.emp_code,
    phone: e.phone,
    department_id: e.department_id
  };
}

export function employeeCard(e, maps = {}) {
  const dept = maps.depts?.[e.department_id];
  const loc = maps.locs?.[e.location_id];
  const shift = maps.shifts?.[e.shift_id];
  return {
    id: e.id,
    emp_code: e.emp_code,
    first_name: e.first_name,
    last_name: e.last_name,
    full_name: `${e.first_name} ${e.last_name || ''}`.trim(),
    email: e.email,
    phone: e.phone,
    role: e.role,
    role_label: roleMeta(e.role).label,
    designation: e.designation,
    department_id: e.department_id,
    department: dept?.name || null,
    department_color: dept?.color || null,
    location: loc?.name || null,
    city: e.city,
    shift: shift ? { id: shift.id, name: shift.name, start: shift.start_time, end: shift.end_time, color: shift.color } : null,
    manager_id: e.manager_id,
    status: e.status,
    join_date: e.join_date,
    work_mode: e.work_mode,
    avatar_color: e.avatar_color,
    avatar_emoji: e.avatar_emoji,
    employment_type: e.employment_type,
    skills: safeParse(e.skills, [])
  };
}

export function serializeEmployee(e, maps = {}) {
  const card = employeeCard(e, maps);
  const dept = maps.depts?.[e.department_id];
  return {
    ...card,
    date_of_birth: e.date_of_birth,
    gender: e.gender,
    address: e.address,
    emergency_contact: e.emergency_contact,
    emergency_phone: e.emergency_phone,
    bio: e.bio,
    bank_account: e.bank_account,
    tax_id: e.tax_id,
    probation_end: e.probation_end,
    notice_period_days: e.notice_period_days,
    salary: e.salary,
    currency: e.currency,
    exit_date: e.exit_date,
    department_code: dept?.code,
    department_icon: dept?.icon,
    locale: e.locale,
    theme: e.theme,
    biometric_enabled: !!e.biometric_enabled,
    has_pin: !!e.pin_hash,
    face_enrolled: !!e.face_template,
    fingerprint_enrolled: !!e.fingerprint_template,
    last_seen_at: e.last_seen_at,
    created_at: e.created_at
  };
}

export function maps() {
  return { depts: DEPT_MAP(), locs: LOC_MAP(), shifts: SHIFT_MAP(), leaveTypes: LEAVE_TYPE_MAP() };
}

export function paginate(query, fallbackLimit = 25) {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || fallbackLimit));
  const offset = Math.max(0, Number(query.offset) || 0);
  const page = Math.max(1, Number(query.page) || 1);
  return { limit, offset: query.page ? (page - 1) * limit : offset };
}

export function withPagination(query, rows, total) {
  const limit = Number(query.limit) || 25;
  const page = Number(query.page) || 1;
  return {
    rows,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit))
  };
}

/** Balance summary for one employee across leave types. */
export function balancesFor(employeeId, year) {
  return all(
    `SELECT b.*, lt.name AS leave_name, lt.code AS leave_code, lt.color AS leave_color, lt.icon AS leave_icon, lt.paid
     FROM leave_balances b JOIN leave_types lt ON lt.id = b.leave_type_id
     WHERE b.employee_id = ? AND b.year = ? ORDER BY lt.name`,
    employeeId,
    year
  ).map((b) => ({
    ...b,
    available: Number((b.entitled - b.used - b.pending).toFixed(2))
  }));
}

/** Attendance rollups used by dashboards and reports. */
export function attendanceRollup(employeeIds, from, to) {
  if (!employeeIds?.length) return { present: 0, absent: 0, leave: 0, late: 0, half: 0, wfh: 0, worked: 0 };
  const marks = employeeIds.map(() => '?').join(',');
  const row = get(
    `SELECT
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
       SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) AS on_leave,
       SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) AS half_day,
       SUM(CASE WHEN status = 'wfh' THEN 1 ELSE 0 END) AS wfh,
       SUM(CASE WHEN status = 'holiday' THEN 1 ELSE 0 END) AS holiday,
       SUM(CASE WHEN status = 'week_off' THEN 1 ELSE 0 END) AS week_off,
       SUM(COALESCE(work_minutes,0)) AS worked_minutes,
       SUM(COALESCE(ot_minutes,0)) AS ot_minutes
     FROM attendance WHERE employee_id IN (${marks}) AND date BETWEEN ? AND ?`,
    ...employeeIds,
    from,
    to
  );
  return {
    present: row.present || 0,
    late: row.late || 0,
    absent: row.absent || 0,
    leave: row.on_leave || 0,
    half: row.half_day || 0,
    wfh: row.wfh || 0,
    holiday: row.holiday || 0,
    weekOff: row.week_off || 0,
    workedMinutes: row.worked_minutes || 0,
    otMinutes: row.ot_minutes || 0
  };
}

export { scopeIdsOrDefault } from '../lib/scope.js';

export function statusTone(status) {
  return (
    {
      present: 'emerald',
      late: 'amber',
      absent: 'rose',
      on_leave: 'sky',
      half_day: 'orange',
      wfh: 'violet',
      holiday: 'slate',
      week_off: 'slate',
      missed_punch: 'rose'
    }[status] || 'slate'
  );
}

export { one, all, get };
