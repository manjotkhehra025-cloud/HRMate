import { NextRequest } from 'next/server';
import { fail, handle, ok, requireMobileUser } from '../../../_lib/mobileAuth';
import { assignCodes, publicType, CodedLeaveType } from '../../../_lib/leaveCodes';
import { listLeaveTypes } from '../../../_lib/leaveTypes';
import db from '@/lib/db';
import { canActOnLeave } from '@/lib/workflow';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

function formatMobileLeave(r: any, types: CodedLeaveType[]) {
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

// POST /api/v1/mobile/leaves/:id/approve (Bearer, manager/HR/admin)
export const POST = handle(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const { user } = await requireMobileUser(req);
  const leaveId = ctx.params.id;

  const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId) as any;
  if (!row) return fail(404, 'VALIDATION', 'Leave request not found.');
  if (row.status !== 'pending') return fail(409, 'CONFLICT', `Leave request is already ${row.status}.`);

  const actor = db.prepare('SELECT id, role, manager_scope FROM users WHERE id = ?').get(user.id) as any;
  if (!canActOnLeave(actor, row) && actor.role !== 'super_admin' && actor.role !== 'admin') {
    return fail(403, 'FORBIDDEN', 'You do not have permission to approve this leave.');
  }

  const now = Date.now();
  db.prepare('UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
    'approved',
    user.id,
    now,
    leaveId
  );

  const lt = db.prepare('SELECT name FROM leave_types WHERE id = ?').get(row.leave_type_id) as any;
  notify(
    row.user_id,
    'Leave approved',
    `Your ${lt?.name || 'Leave'} request (${row.start_date} to ${row.end_date}) was approved.`,
    { type: 'success', link: '/leaves' }
  );

  const updated = db
    .prepare(
      `SELECT lr.*, lt.name AS leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.id = ?`
    )
    .get(leaveId) as any;

  const types = assignCodes(await listLeaveTypes());
  return ok({ leave: formatMobileLeave(updated, types) });
});
