import { NextRequest } from 'next/server';
import { fail, handle, ok, requireMobileUser } from '../../_lib/mobileAuth';
import db from '@/lib/db';
import { getFactoryConfig } from '@/lib/geo';
import { pickShiftForNow } from '@/lib/shifts';
import { creditCompOffIfWorked } from '@/lib/weekly-off';
import { dateKey } from '@/lib/api';
import { randomId } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000,
    r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1),
    dLng = r(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/v1/mobile/attendance/punch (Bearer)
// body: { type:"in"|"out", lat, lng, accuracyM, mocked, method:"biometric"|"password", deviceId, clientTime }
// 200 → { ok:true, punch:{ id, type, at: ISO, method, distanceM, insideGeofence }, message? }
// 409 GEOFENCE → { ok:false, code:"GEOFENCE", error:"…", distanceM, radiusM }
// 409 CONFLICT → already punched in / not punched in / duplicate within 60 s
// 400 VALIDATION → bad body / mocked location rejected
export const POST = handle(async (req: NextRequest) => {
  const { user } = await requireMobileUser(req);
  const b = await req.json().catch(() => ({}));
  const type = b.type === 'in' || b.type === 'out' ? b.type : null;
  const lat = Number(b.lat);
  const lng = Number(b.lng);

  if (!type || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(400, 'VALIDATION', 'Punch type and location are required.');
  }
  if (b.mocked === true) {
    return fail(400, 'VALIDATION', 'Mock location detected. Turn off fake-GPS apps and try again.');
  }

  const cfg = getFactoryConfig();
  const fence = { lat: cfg.lat, lng: cfg.lng, radiusM: cfg.radius };
  const distanceM = haversineM(lat, lng, fence.lat, fence.lng);
  const allowance = Math.min(Number(b.accuracyM) || 0, 30);

  if (distanceM > fence.radiusM + allowance) {
    return fail(409, 'GEOFENCE', `You are ${Math.round(distanceM)} m from the site.`, {
      distanceM: Math.round(distanceM),
      radiusM: fence.radiusM,
    });
  }

  const today = dateKey();
  const now = Date.now();
  let record = db
    .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
    .get(user.id, today) as any;

  if (type === 'in') {
    if (record && record.punch_in_at) {
      return fail(409, 'CONFLICT', 'You have already punched in today.');
    }

    const activeShift = pickShiftForNow(now, user.id);
    const shiftId = activeShift?.id || null;
    const punchId = randomId('a_');

    db.prepare(
      `INSERT INTO attendance (id, user_id, date, punch_in_at, punch_in_lat, punch_in_lng, punch_in_geofence, shift_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(punchId, user.id, today, now, lat, lng, shiftId);

    creditCompOffIfWorked(user.id, today);

    return ok({
      punch: {
        id: punchId,
        type: 'in',
        at: new Date(now).toISOString(),
        method: String(b.method || 'biometric'),
        distanceM: Math.round(distanceM),
        insideGeofence: true,
      },
      message: 'Punched in successfully.',
    });
  } else {
    // type === 'out'
    if (!record || !record.punch_in_at) {
      return fail(409, 'CONFLICT', 'You must punch in first before punching out.');
    }
    if (record.punch_out_at) {
      return fail(409, 'CONFLICT', "You've already punched in and out today.");
    }

    db.prepare(
      `UPDATE attendance SET punch_out_at = ?, punch_out_lat = ?, punch_out_lng = ?, punch_out_geofence = 1
       WHERE id = ?`
    ).run(now, lat, lng, record.id);

    return ok({
      punch: {
        id: `${record.id}_out`,
        type: 'out',
        at: new Date(now).toISOString(),
        method: String(b.method || 'biometric'),
        distanceM: Math.round(distanceM),
        insideGeofence: true,
      },
      message: 'Punched out successfully.',
    });
  }
});
