// Shared for the three team routes. Wire the TODOs to the webapp's EXISTING team/reporting-line logic.
//
// Team member shape (team/today.members[], team/members.items[], team/members/:id/day.member):
// { id, code, name, department, designation, avatarUrl,
//   status:"present"|"absent"|"leave"|"holiday"|"weekoff"|"half"|"notyet",
//   firstIn:ISO|null, lastOut:ISO|null, workedMinutes, late:boolean, leaveType:"EL"|null }
//
// STATUS RULE for a day with NO punch (same rule as the webapp dashboard):
//   leave → "leave"; holiday → "holiday"; weekly off → "weekoff";
//   date < today → "absent";
//   date == today → "absent" ONLY once the member's shift end (+ grace) has passed, else "notyet"
//   (at 01:00 nobody on the 07:00 day shift is "absent" yet — they are "notyet");
//   date > today → "notyet".
// SHIFT RULE: shift = the member's ASSIGNED shift (users.shift_id); if none, the webapp's default
// shift. Never pick a shift from the CURRENT clock time (pickShiftForNow(now)) — that labels every
// day-shift worker "Night Shift" when the manager looks at night. Only a real punch time may be
// used to auto-detect a shift, and only for that punched day.
import { MobileError } from '../_lib/mobileAuth';
import { assignCodes, publicType } from '../_lib/leaveCodes';
import { listLeaveTypes } from '../_lib/leaveTypes';
import db from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { departmentScope, isApproverDesignation, parseWeeklyOff } from '@/lib/staff';
import { pickShiftForNow } from '@/lib/shifts';
import { getFactoryConfig } from '@/lib/geo';
import { istTimestamp } from '@/lib/attendance';

export type MemberRow = {
  id: string;
  code: string;
  name: string;
  department: string;
  designation: string | null;
  avatarUrl: string | null;
  status: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  late: boolean;
  leaveType: string | null;
};

export function getEmployeeCode(u: any): string {
  if (u.emp_code && u.emp_code.trim() && !u.emp_code.startsWith('u_')) {
    return u.emp_code.trim().toUpperCase();
  }
  if (u.code && u.code.trim() && !u.code.startsWith('u_')) {
    return u.code.trim().toUpperCase();
  }
  if (u.email && u.email.includes('@')) {
    const prefix = u.email.split('@')[0].trim();
    if (prefix && !prefix.toLowerCase().includes('admin')) {
      return prefix.toUpperCase();
    }
  } else if (u.email && u.email.trim() && !u.email.toLowerCase().includes('admin')) {
    return u.email.trim().toUpperCase();
  }
  return u.emp_code || '';
}

// Who may see a team: the SAME rule the webapp uses for its Team / attendance dashboard
// (manager of a department / reporting line, HR, admin, super_admin). Everyone else → 403 FORBIDDEN.
export async function canViewTeam(userId: string): Promise<boolean> {
  const u = db.prepare('SELECT id, role, designation FROM users WHERE id = ?').get(userId) as any;
  if (!u) return false;
  if (u.role === 'super_admin' || u.role === 'admin' || u.role === 'manager' || u.role === 'hr') return true;
  if (isApproverDesignation(u.designation)) return true;
  return hasPermission(userId, 'attendance.team') || hasPermission(userId, 'leaves.team') || hasPermission(userId, 'approvals.manage');
}

export async function requireTeamAccess(userId: string): Promise<void> {
  const allowed = await canViewTeam(userId);
  if (!allowed) throw new MobileError(403, 'FORBIDDEN', 'You do not manage a team.');
}

// The people this user manages (webapp reporting line / department rule). For super_admin / HR
// this is everyone active. Never include the caller themself. Exclude system / service accounts
// (e.g. the seeded "Super Admin" login) and inactive / exited employees — only real staff who are
// expected to punch. `code` MUST be the employee code (e.g. WKH00418), never the internal user id.
export async function teamMemberIds(userId: string): Promise<string[]> {
  const actor = db.prepare('SELECT id, role, manager_scope FROM users WHERE id = ?').get(userId) as any;
  if (!actor) return [];

  const isAll = actor.role === 'super_admin' || actor.role === 'admin' || actor.role === 'hr' || !actor.manager_scope;

  // Exclude inactive employees, system/service accounts (role = 'super_admin', name = 'Super Admin', emp_code = 'NS000001'), and caller
  const rows = db.prepare(`
    SELECT id, department, role, name, emp_code
    FROM users 
    WHERE active = 1 
      AND id != ?
      AND role != 'super_admin'
      AND name != 'Super Admin'
      AND emp_code != 'NS000001'
    ORDER BY name
  `).all(userId) as any[];

  if (isAll) {
    return rows.map((r) => r.id);
  }

  const visible = rows.filter((r) => departmentScope(r.department) === actor.manager_scope);
  return visible.map((r) => r.id);
}

function calculateShiftEnd(startTime: string, hours: number): string {
  const [h, m] = (startTime || '08:00').split(':').map(Number);
  const totalMins = (h * 60 + (m || 0)) + Math.round((hours || 8) * 60);
  const endH = Math.floor((totalMins / 60) % 24);
  const endM = Math.floor(totalMins % 60);
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// Attendance of one member for one day, using the same computation as attendance/today + history.
export async function memberDay(
  memberId: string,
  date: string
): Promise<MemberRow & { punches: unknown[]; shift: { name: string; start: string; end: string } | null }> {
  const user = db
    .prepare('SELECT id, email, emp_code, name, department, designation, avatar, weekly_off, shift_id FROM users WHERE id = ?')
    .get(memberId) as any;

  if (!user) {
    throw new MobileError(404, 'NOT_FOUND', `User ${memberId} not found`);
  }

  const todayStr = isoToday();
  const now = Date.now();

  const record = db
    .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
    .get(memberId, date) as any;

  const leaveRow = db
    .prepare(
      `SELECT lr.*, lt.name AS leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.user_id = ? AND lr.status = 'approved' AND ? >= lr.start_date AND ? <= lr.end_date`
    )
    .get(memberId, date, date) as any;

  const holidayRow = db
    .prepare('SELECT title FROM holidays WHERE date = ? AND is_off = 1')
    .get(date) as any;

  // Determine Shift:
  // Punch time may auto-detect shift for this day only; otherwise ASSIGNED shift (users.shift_id -> shifts row); if none, webapp default shift.
  let activeShift: any = null;
  if (record?.shift_id) {
    activeShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(record.shift_id) as any;
  }
  if (!activeShift && record?.punch_in_at) {
    activeShift = pickShiftForNow(record.punch_in_at, memberId);
  }
  if (!activeShift && user.shift_id && user.shift_id !== 'auto' && user.shift_id !== 'none') {
    activeShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(user.shift_id) as any;
  }
  if (!activeShift) {
    activeShift = db.prepare("SELECT * FROM shifts WHERE id = 'sh_general_day' OR id = 'sh_general'").get() as any
      || db.prepare("SELECT * FROM shifts WHERE auto_pick = 'morning'").get() as any
      || db.prepare("SELECT * FROM shifts ORDER BY sort ASC LIMIT 1").get() as any
      || { name: 'General Day Shift', start_time: '08:00', hours: 9 };
  }

  const shiftHours = activeShift?.hours || 9;
  const shift = activeShift
    ? {
        name: activeShift.name || 'General Day Shift',
        start: activeShift.start_time || '08:00',
        end: calculateShiftEnd(activeShift.start_time || '08:00', shiftHours),
      }
    : null;

  const punches: any[] = [];
  let firstIn: string | null = null;
  let lastOut: string | null = null;
  let workedMinutes = 0;
  let late = false;
  let status = 'notyet';
  let leaveType: string | null = null;

  if (leaveRow) {
    const types = assignCodes(await listLeaveTypes());
    leaveType = publicType(leaveRow.leave_type_id || leaveRow.leave_type_name || '', types).type;
  }

  const factory = getFactoryConfig();
  const shiftStart = shift?.start || factory.workStart || '09:00';

  if (record && record.punch_in_at) {
    firstIn = new Date(record.punch_in_at).toISOString();
    punches.push({
      id: record.id,
      type: 'in',
      at: firstIn,
      method: 'biometric',
      distanceM: 0,
      insideGeofence: !!record.punch_in_geofence,
    });

    try {
      const shiftStartTs = istTimestamp(date, shiftStart);
      if (record.punch_in_at > shiftStartTs) {
        late = true;
      }
    } catch {
      // Ignore timestamp parsing errors
    }

    if (record.punch_out_at) {
      lastOut = new Date(record.punch_out_at).toISOString();
      punches.push({
        id: `${record.id}_out`,
        type: 'out',
        at: lastOut,
        method: 'biometric',
        distanceM: 0,
        insideGeofence: !!record.punch_out_geofence,
      });
      workedMinutes = Math.max(0, Math.floor((record.punch_out_at - record.punch_in_at) / 60000));
    } else if (date === todayStr) {
      workedMinutes = Math.max(0, Math.floor((now - record.punch_in_at) / 60000));
    }

    if (workedMinutes >= 240 && workedMinutes < 420 && record.punch_out_at) {
      status = 'half';
    } else {
      status = 'present';
    }
  } else {
    // No punch
    if (leaveRow) {
      status = 'leave';
    } else if (holidayRow) {
      status = 'holiday';
    } else {
      const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
      const weeklyOff = parseWeeklyOff(user.weekly_off, 6);
      if (dayOfWeek === weeklyOff) {
        status = 'weekoff';
      } else if (date < todayStr) {
        status = 'absent';
      } else if (date > todayStr) {
        status = 'notyet';
      } else {
        // date === todayStr: absent ONLY once member's shift end (+ grace) has passed, otherwise notyet
        let shiftEndPassed = false;
        try {
          const shiftStartTs = istTimestamp(date, shiftStart);
          const shiftEndTs = shiftStartTs + (shiftHours * 3600 * 1000) + (15 * 60 * 1000); // 15 mins grace
          shiftEndPassed = now > shiftEndTs;
        } catch {
          shiftEndPassed = false;
        }

        if (shiftEndPassed) {
          status = 'absent';
        } else {
          status = 'notyet';
        }
      }
    }
  }

  const memberRow: MemberRow = {
    id: user.id,
    code: getEmployeeCode(user),
    name: user.name,
    department: user.department || 'General',
    designation: user.designation || null,
    avatarUrl: user.avatar ? `/api/avatar/${user.id}` : null,
    status,
    firstIn,
    lastOut,
    workedMinutes,
    late,
    leaveType,
  };

  return {
    ...memberRow,
    punches,
    shift,
  };
}

export function isoToday(): string {
  // Site-local date (Asia/Kolkata), not UTC — a punch at 01:00 IST belongs to that IST day.
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
