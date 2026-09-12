import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json, dateKey } from "@/lib/api";
import { isWithinGeofence, getFactoryConfig } from "@/lib/geo";
import { hasPermission } from "@/lib/permissions";
import { pickShiftForNow } from "@/lib/shifts";
import { creditCompOffIfWorked } from "@/lib/weekly-off";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const today = dateKey();
  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;

  const userRow = db.prepare("SELECT shift_id FROM users WHERE id = ?").get(user.id) as any;
  let shift = null;
  if (record?.shift_id) {
    shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(record.shift_id) as any;
  }
  if (!shift && userRow?.shift_id) {
    shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(userRow.shift_id) as any;
  }
  if (!shift) {
    shift = pickShiftForNow() || (db.prepare("SELECT * FROM shifts ORDER BY sort LIMIT 1").get() as any);
  }

  return json({
    today: record || null,
    factory: getFactoryConfig(),
    date: today,
    shift: shift || { name: "General Shift", hours: 8, start_time: "09:00" },
  });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "attendance.punch")) {
    return error("You don't have permission to punch attendance", 403);
  }

  const body = await req.json();
  const lat = parseFloat(body.lat);
  const lng = parseFloat(body.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return error("GPS location is required. Please allow location access.", 400);
  }

  const geo = isWithinGeofence(lat, lng);
  if (!geo.within) {
    return error(
      `You are ${geo.distance}m away from the factory. You must be within the geofence to punch.`,
      403
    );
  }

  const today = dateKey();
  const now = Date.now();
  let record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;

  if (!record) {
    const shift = pickShiftForNow(now);
    db.prepare(
      `INSERT INTO attendance (id, user_id, date, punch_in_at, punch_in_lat, punch_in_lng, punch_in_geofence, shift_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(randomId("a_"), user.id, today, now, lat, lng, shift?.id || null);
    creditCompOffIfWorked(user.id, today);
  } else if (!record.punch_out_at) {
    db.prepare(
      `UPDATE attendance SET punch_out_at = ?, punch_out_lat = ?, punch_out_lng = ?, punch_out_geofence = 1
       WHERE id = ?`
    ).run(now, lat, lng, record.id);
  } else {
    return error("You've already punched in and out today.");
  }

  record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today);

  return json({ ok: true, record, geo });
}
