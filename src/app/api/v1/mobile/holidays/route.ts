import { NextRequest } from 'next/server';
import { fail, handle, ok, requireMobileUser } from '../_lib/mobileAuth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/mobile/holidays?year=YYYY  (Bearer; default = current year)
// → { ok:true, year:2026, items:[{ date:"YYYY-MM-DD", name, type:"public"|"restricted"|"optional"|null, optional:boolean }] }
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const y = req.nextUrl.searchParams.get('year') || String(new Date().getFullYear());
  if (!/^\d{4}$/.test(y)) return fail(400, 'VALIDATION', 'year must be YYYY.');

  const rows = db
    .prepare(
      `SELECT date, title, is_off FROM holidays
       WHERE substr(date, 1, 4) = ?
       ORDER BY date ASC`
    )
    .all(y) as any[];

  const items = rows.map((r) => ({
    date: r.date,
    name: r.title,
    type: r.is_off === 1 ? 'public' : 'optional',
    optional: r.is_off !== 1,
  }));

  items.sort((a, b) => a.date.localeCompare(b.date));
  return ok({ year: Number(y), items });
});
