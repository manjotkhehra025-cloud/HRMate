import { NextRequest } from 'next/server';
import { fail, handle, ok, requireMobileUser } from '../_lib/mobileAuth';
import { listLeaveTypes, matchLeaveType, publicType, LeaveType } from '../_lib/leaveTypes';
import db from '@/lib/db';
import { randomId } from '@/lib/crypto';
import { businessDays, istParts } from '@/lib/utils';
import { usedInPeriod } from '@/lib/leave';
import { canActOnLeave, getApprover, notifyLeaveApprovers } from '@/lib/workflow';
import { parseWeeklyOff, isApproverDesignation } from '@/lib/staff';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function formatMobileLeave(r: any, types: LeaveType[]) {
  const pub = publicType(r.leave_type_id || r.type || r.leave_type_name || '', types);
  const typeName = pub.typeName || r.leave_type_name || 'Leave';
  const typeCode = pub.type;

  let decidedBy = null;
  if (r.reviewed_by) {
    const reviewer = db.prepare('SELECT id, name FROM users WHERE id = ?').get(r.reviewed_by) as any;
    if (reviewer) {
      decidedBy = { id: reviewer.id, name: reviewer.name };
    }
  }

  const emp = db.prepare('SELECT id, emp_code, name FROM users WHERE id = ?').get(r.user_id) as any;

  return {
    id: r.id,
    type: typeCode,
    typeName: typeName,
    from: r.start_date,
    to: r.end_date,
    days: Number(r.days || 1),
    halfDay: Number(r.days) === 0.5,
    reason: r.reason || '',
    status: (r.status || 'pending').toLowerCase(),
    appliedAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    decidedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    decidedBy,
    decisionNote: r.reviewed_note || null,
    employee: {
      id: emp ? emp.id : r.user_id,
      code: emp ? emp.emp_code || emp.id : r.user_id,
      name: emp ? emp.name : 'Unknown',
    },
  };
}

async function canApproveLeaves(userId: string): Promise<boolean> {
  const u = db.prepare('SELECT role, designation FROM users WHERE id = ?').get(userId) as any;
  if (!u) return false;
  if (u.role === 'super_admin' || u.role === 'admin' || u.role === 'manager') return true;
  if (isApproverDesignation(u.designation)) return true;
  return hasPermission(userId, 'approvals.manage');
}

async function listMyLeaves(userId: string, status?: string): Promise<unknown[]> {
  const types = await listLeaveTypes();
  let query = `
    SELECT lr.*, lt.name AS leave_type_name
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.user_id = ?
  `;
  const params: any[] = [userId];
  if (status) {
    query += ` AND LOWER(lr.status) = LOWER(?)`;
    params.push(status);
  }
  query += ` ORDER BY lr.created_at DESC LIMIT 50`;

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => formatMobileLeave(r, types));
}

async function listTeamLeaves(approverId: string, status?: string): Promise<unknown[]> {
  const types = await listLeaveTypes();
  const actor = db.prepare('SELECT id, role, manager_scope FROM users WHERE id = ?').get(approverId) as any;
  if (!actor) return [];

  let query = `
    SELECT lr.*, lt.name AS leave_type_name
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
  `;
  const params: any[] = [];
  if (status) {
    query += ` WHERE LOWER(lr.status) = LOWER(?)`;
    params.push(status);
  }
  query += ` ORDER BY lr.created_at DESC LIMIT 100`;

  const rows = db.prepare(query).all(...params) as any[];
  const visible = rows.filter((r) => {
    if (r.user_id === approverId) return false;
    if (actor.role === 'super_admin' || actor.role === 'admin') return true;
    if (r.approver_id === approverId) return true;
    if (r.status === 'pending') return canActOnLeave(actor, r);
    return r.reviewed_by === approverId;
  });

  return visible.map((r) => formatMobileLeave(r, types));
}

type NewLeave = { userId: string; type: string; from: string; to: string; halfDay: boolean; reason: string };

async function createLeave(l: NewLeave): Promise<{ ok: boolean; status?: number; code?: string; error?: string; leave?: unknown }> {
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(l.userId) as any;
  if (!userRow) return { ok: false, status: 404, code: 'VALIDATION', error: 'User not found.' };

  const lt = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(l.type) as any;
  if (!lt) {
    return { ok: false, status: 400, code: 'VALIDATION', error: 'Invalid leave type.' };
  }

  const isYellowCard = userRow.staff_type === 'yellow_card';
  if (isYellowCard) {
    const isEarned = lt.id === 'lt_earned' || lt.name.toLowerCase().includes('earned');
    if (!isEarned) {
      return { ok: false, status: 400, code: 'VALIDATION', error: 'Yellow card staff are only eligible for Earned Leave (EL).' };
    }
  }

  // Check date overlap
  const overlap = db
    .prepare(
      `SELECT id FROM leave_requests
       WHERE user_id = ? AND status IN ('pending', 'approved')
       AND end_date >= ? AND start_date <= ?`
    )
    .get(l.userId, l.from, l.to) as any;

  if (overlap) {
    return {
      ok: false,
      status: 409,
      code: 'CONFLICT',
      error: 'You already have a leave request overlapping these dates.',
    };
  }

  const days = l.halfDay ? 0.5 : businessDays(l.from, l.to, parseWeeklyOff(userRow.weekly_off, 6));
  if (days <= 0) {
    return { ok: false, status: 400, code: 'VALIDATION', error: 'Selected range has no working days.' };
  }

  const reset = lt.reset_period === 'month' ? 'month' : 'year';
  if (reset === 'month' && l.from.slice(0, 7) !== l.to.slice(0, 7)) {
    return { ok: false, status: 400, code: 'VALIDATION', error: 'Short leave must start and end in the same month.' };
  }

  const extra =
    (
      db
        .prepare('SELECT extra_days FROM leave_balances WHERE user_id = ? AND leave_type_id = ?')
        .get(l.userId, lt.id) as { extra_days: number } | undefined
    )?.extra_days || 0;

  if (isYellowCard) {
    const currentMonthNum = parseInt(istParts().month, 10) || 1;
    const accrued = Math.round(currentMonthNum * 1.25 * 100) / 100;
    const totalAccrued = accrued + extra;
    const used = usedInPeriod(l.userId, lt.id, 'year', l.from);
    if (used + days > totalAccrued) {
      const remaining = Math.max(0, Math.round((totalAccrued - used) * 100) / 100);
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION',
        error: `Insufficient EL balance. You have ${remaining} day(s) remaining (1.25 days/month accrual).`,
      };
    }
  } else {
    const allowance = lt.days_per_year + extra;
    const used = usedInPeriod(l.userId, lt.id, reset, l.from);
    if (used + days > allowance) {
      const remaining = Math.max(0, allowance - used);
      return {
        ok: false,
        status: 400,
        code: 'VALIDATION',
        error: `Insufficient leave balance. You have ${remaining} day(s) remaining.`,
      };
    }
  }

  const approver = getApprover('', l.userId);
  const approverId = approver ? approver.id : null;
  const leaveId = randomId('lr_');
  const now = Date.now();

  db.prepare(
    `INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, days, reason, created_at, approver_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(leaveId, l.userId, lt.id, l.from, l.to, days, l.reason, now, approverId);

  notifyLeaveApprovers(
    { id: userRow.id, name: userRow.name, role: userRow.role, department: userRow.department },
    `${days} day(s) of ${lt.name} (${l.from} to ${l.to})`,
    approverId
  );

  const newRow = db
    .prepare(
      `SELECT lr.*, lt.name AS leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.id = ?`
    )
    .get(leaveId) as any;

  const types = await listLeaveTypes();
  return { ok: true, leave: formatMobileLeave(newRow, types) };
}

// GET /api/v1/mobile/leaves?status=&scope=  (Bearer)
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const scope = req.nextUrl.searchParams.get('scope') || 'mine';
  const status = req.nextUrl.searchParams.get('status') || undefined;

  if (scope === 'team') {
    if (!(await canApproveLeaves(user.id))) return fail(403, 'FORBIDDEN', 'You cannot approve leaves.');
    return ok({ items: await listTeamLeaves(user.id, status) });
  }
  return ok({ items: await listMyLeaves(user.id, status) });
});

// POST /api/v1/mobile/leaves {type, from, to, halfDay, reason}  (Bearer)
export const POST = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const b = await req.json().catch(() => ({}));
  const type = String(b.type || '').trim();
  const from = String(b.from || '');
  const to = String(b.to || from);
  const reason = String(b.reason || '').trim();
  const halfDay = b.halfDay === true;
  const day = /^\d{4}-\d{2}-\d{2}$/;

  if (!type || !day.test(from) || !day.test(to)) {
    return fail(400, 'VALIDATION', 'Leave type and dates are required.');
  }
  if (to < from) {
    return fail(400, 'VALIDATION', 'End date is before start date.');
  }
  if (halfDay && from !== to) {
    return fail(400, 'VALIDATION', 'Half day is only for a single day.');
  }
  if (!reason) {
    return fail(400, 'VALIDATION', 'Please enter a reason.');
  }

  const types = await listLeaveTypes();
  const lt = matchLeaveType(type, types); // "EL" | "EARNED" | "Earned Leave (EL)" → the webapp type
  if (!lt) {
    return fail(400, 'VALIDATION', `Unknown leave type "${type}". Known: ${types.map((t) => t.key).join(', ')}`);
  }

  const r = await createLeave({ userId: user.id, type: lt.key, from, to, halfDay, reason });
  if (!r.ok) {
    return fail(r.status || 400, r.code || 'VALIDATION', r.error || 'Leave request was not accepted.');
  }
  return ok({ leave: r.leave });
});
