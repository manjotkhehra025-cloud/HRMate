import { NextRequest } from 'next/server';
import { handle, ok, requireMobileUser } from '../../_lib/mobileAuth';
import { assignCodes, matchLeaveType } from '../../_lib/leaveCodes';
import { listLeaveTypes } from '../../_lib/leaveTypes';
import db from '@/lib/db';
import { balancesForUser } from '@/lib/leave';

export const dynamic = 'force-dynamic';

// GET /api/v1/mobile/leaves/balance  (Bearer)
// → { ok:true, available: number, pending: number,
//     balances:[{ type:"CL"|"SL"|"EL"|…, name, total, used, available }] }
// `available` = sum of all types (the Home tile shows it); Phase 3 uses `balances` per type.
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const types = assignCodes(await listLeaveTypes());

  const rawBalances = balancesForUser(user.id);
  const balances = rawBalances.map((b: any) => {
    const t = matchLeaveType(String(b.id || b.leave_type_id || b.name || ''), types);
    const code = t ? t.code : String(b.type || '').toUpperCase();

    return {
      type: code,
      name: t ? t.name : b.name,
      total: Number(b.days_per_year || b.accrued_days || 0),
      used: Number(b.used || 0),
      available: Math.max(0, Number(b.balance || 0)),
    };
  });

  const available = balances.reduce((acc, b) => acc + b.available, 0);

  const pendingRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM leave_requests WHERE user_id = ? AND status = 'pending'")
    .get(user.id) as any;
  const pending = pendingRow?.cnt || 0;

  return ok({
    available,
    pending,
    balances,
  });
});
