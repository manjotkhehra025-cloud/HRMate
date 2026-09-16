import { NextRequest } from 'next/server';
import { handle, ok, requireMobileUser } from '../../_lib/mobileAuth';
import { listLeaveTypes, shortCode } from '../../_lib/leaveTypes';
import db from '@/lib/db';
import { balancesForUser } from '@/lib/leave';

export const dynamic = 'force-dynamic';

// GET /api/v1/mobile/leaves/balance  (Bearer)
// → { ok:true, available: number, pending: number,
//     balances:[{ type:"CL"|"SL"|"EL"|…, name, total, used, available }] }
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const types = await listLeaveTypes();

  const rawBalances = balancesForUser(user.id);
  const balances = rawBalances.map((b: any) => {
    const t = types.find(
      (x) =>
        x.key === b.id ||
        x.key === b.leave_type_id ||
        shortCode(x) === b.id ||
        shortCode(x) === b.type ||
        x.name.toLowerCase() === (b.name || '').toLowerCase()
    );
    const code = t ? shortCode(t) : shortCode({ key: b.id, name: b.name });

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
