import { NextRequest } from 'next/server';
import { handle, ok, requireMobileUser } from '../../_lib/mobileAuth';
import db from '@/lib/db';
import { getFactoryConfig } from '@/lib/geo';
import { pickShiftForNow } from '@/lib/shifts';
import { dateKey } from '@/lib/api';

export const dynamic = 'force-dynamic';

function calculateShiftEnd(startTime: string, hours: number): string {
  const [h, m] = (startTime || '08:00').split(':').map(Number);
  const totalMins = (h * 60 + (m || 0)) + Math.round((hours || 8) * 60);
  const endH = Math.floor((totalMins / 60) % 24);
  const endM = Math.floor(totalMins % 60);
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// GET /api/v1/mobile/attendance/today (Bearer)
// Response contract (ARCHITECTURE.md §5):
// {
//   ok: true,
//   status: "in" | "out" | "none",
//   firstIn: ISO string | null,
//   lastOut: ISO string | null,
//   workedMinutes: number,
//   shift: { name, start: "09:00", end: "18:00" } | null,
//   onLeave: boolean, holiday: boolean, holidayName: string | null,
//   geofence: { lat, lng, radiusM }
// }
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const today = dateKey();
  const now = Date.now();

  const record = db
    .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
    .get(user.id, today) as any;

  // Determine status
  let status: 'in' | 'out' | 'none' = 'none';
  let firstIn: string | null = null;
  let lastOut: string | null = null;
  let workedMinutes = 0;

  if (record && record.punch_in_at) {
    firstIn = new Date(record.punch_in_at).toISOString();
    if (record.punch_out_at) {
      status = 'out';
      lastOut = new Date(record.punch_out_at).toISOString();
      workedMinutes = Math.max(0, Math.floor((record.punch_out_at - record.punch_in_at) / 60000));
    } else {
      status = 'in';
      workedMinutes = Math.max(0, Math.floor((now - record.punch_in_at) / 60000));
    }
  }

  // Determine shift
  let activeShift: any = null;
  if (record?.shift_id) {
    activeShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(record.shift_id) as any;
  }
  if (!activeShift && record?.punch_in_at) {
    activeShift = pickShiftForNow(record.punch_in_at, user.id);
  }
  if (!activeShift) {
    activeShift = pickShiftForNow(now, user.id);
  }
  if (!activeShift) {
    activeShift = db.prepare('SELECT * FROM shifts ORDER BY sort LIMIT 1').get() as any;
  }

  const shift = activeShift
    ? {
        name: activeShift.name || 'General Day Shift',
        start: activeShift.start_time || '08:00',
        end: calculateShiftEnd(activeShift.start_time || '08:00', activeShift.hours || 9),
      }
    : null;

  // Check onLeave
  const leaveRow = db
    .prepare(
      "SELECT id FROM leave_requests WHERE user_id = ? AND status = 'approved' AND ? >= start_date AND ? <= end_date"
    )
    .get(user.id, today, today) as any;
  const onLeave = !!leaveRow;

  // Check holiday
  const holRow = db
    .prepare('SELECT title FROM holidays WHERE date = ? AND is_off = 1')
    .get(today) as any;
  const holiday = !!holRow;
  const holidayName = holRow ? holRow.title : null;

  // Geofence config
  const cfg = getFactoryConfig();
  const geofence = {
    lat: cfg.lat,
    lng: cfg.lng,
    radiusM: cfg.radius,
  };

  return ok({
    status,
    firstIn,
    lastOut,
    workedMinutes,
    shift,
    onLeave,
    holiday,
    holidayName,
    geofence,
  });
});
