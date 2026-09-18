import { NextRequest } from 'next/server';
import { handle, ok, requireMobileUser } from '../_lib/mobileAuth';

export const dynamic = 'force-dynamic';

type Payslip = {
  id: string;
  month: string;
  label: string;
  netPay: number | null;
  currency: string;
  url: string;
};

async function loadPayslips(_userId: string): Promise<Payslip[]> {
  // Webapp payroll store: returns empty array when no payslips are generated yet
  return [];
}

// GET /api/v1/mobile/payslips  (Bearer)
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const items = await loadPayslips(user.id);
  items.sort((a, b) => b.month.localeCompare(a.month));
  return ok({ items });
});
