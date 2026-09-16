import { NextRequest } from 'next/server';
import { fail, handle, ok, requireMobileUser } from '../../_lib/mobileAuth';
import db from '@/lib/db';
import { dateKey } from '@/lib/api';

export const dynamic = 'force-dynamic';

// GET /api/v1/mobile/attendance/history?from=YYYY-MM-DD&to=YYYY-MM-DD  (Bearer, max 62 days)
// → { ok:true, days:[{ date:"YYYY-MM-DD", status:"present"|"absent"|"leave"|"holiday"|"weekoff"|"half",
//                      firstIn, lastOut, workedMinutes,
//                      punches:[{ id, type:"in"|"out", at: ISO, method, distanceM, insideGeofence }] }] }
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const from = req.nextUrl.searchParams.get('from') || '';
  const to = req.nextUrl.searchParams.get('to') || from;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return fail(400, 'VALIDATION', 'from/to must be YYYY-MM-DD.');
  }

  // Load user info for weekly_off
  const userRow = db.prepare('SELECT weekly_off FROM users WHERE id = ?').get(user.id) as any;
  const weeklyOffDay = userRow?.weekly_off ?? 6; // default Saturday/Sunday

  // Load attendance records in range
  const records = db
    .prepare(
      `SELECT * FROM attendance
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`
    )
    .all(user.id, from, to) as any[];
  const recordMap = new Map<string, any>();
  for (const r of records) recordMap.set(r.date, r);

  // Load holidays in range
  const holidays = db
    .prepare(
      `SELECT date, title, is_off FROM holidays
       WHERE date >= ? AND date <= ? AND is_off = 1`
    )
    .all(from, to) as any[];
  const holidayMap = new Map<string, string>();
  for (const h of holidays) holidayMap.set(h.date, h.title);

  // Load leaves in range
  const leaves = db
    .prepare(
      `SELECT start_date, end_date FROM leave_requests
       WHERE user_id = ? AND status = 'approved'
       AND end_date >= ? AND start_date <= ?`
    )
    .all(user.id, from, to) as any[];

  function isLeave(dateStr: string): boolean {
    return leaves.some((l) => dateStr >= l.start_date && dateStr <= l.end_date);
  }

  const todayStr = dateKey();
  const now = Date.now();

  // Generate days array from 'from' to 'to'
  const days: any[] = [];
  const curr = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');

  // Guard against excessive range (> 62 days)
  const maxDays = 62;
  let count = 0;

  while (curr <= end && count < maxDays) {
    count++;
    const dStr = curr.toISOString().slice(0, 10);
    const dayOfWeek = curr.getUTCDay(); // 0 = Sunday, 6 = Saturday

    const rec = recordMap.get(dStr);
    const punches: any[] = [];
    let firstIn: string | null = null;
    let lastOut: string | null = null;
    let workedMinutes = 0;
    let status = 'none';

    if (rec && rec.punch_in_at) {
      firstIn = new Date(rec.punch_in_at).toISOString();
      punches.push({
        id: rec.id,
        type: 'in',
        at: firstIn,
        method: 'biometric',
        distanceM: 0,
        insideGeofence: !!rec.punch_in_geofence,
      });

      if (rec.punch_out_at) {
        lastOut = new Date(rec.punch_out_at).toISOString();
        punches.push({
          id: `${rec.id}_out`,
          type: 'out',
          at: lastOut,
          method: 'biometric',
          distanceM: 0,
          insideGeofence: !!rec.punch_out_geofence,
        });
        workedMinutes = Math.max(0, Math.floor((rec.punch_out_at - rec.punch_in_at) / 60000));
      } else if (dStr === todayStr) {
        workedMinutes = Math.max(0, Math.floor((now - rec.punch_in_at) / 60000));
      }

      if (workedMinutes >= 240 && workedMinutes < 420) {
        status = 'half';
      } else {
        status = 'present';
      }
    } else {
      if (isLeave(dStr)) {
        status = 'leave';
      } else if (holidayMap.has(dStr)) {
        status = 'holiday';
      } else if (dayOfWeek === weeklyOffDay) {
        status = 'weekoff';
      } else if (dStr <= todayStr) {
        status = 'absent';
      } else {
        status = 'none';
      }
    }

    days.push({
      date: dStr,
      status,
      firstIn,
      lastOut,
      workedMinutes,
      punches,
    });

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return ok({ days });
});
