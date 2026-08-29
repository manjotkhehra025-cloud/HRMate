import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json, dateKey } from "@/lib/api";
import { isWithinGeofence, getFactoryConfig } from "@/lib/geo";
import { hasPermission } from "@/lib/permissions";
import { pickShiftForNow } from "@/lib/shifts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const today = dateKey();
  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;

  return json({
    today: record || null,
    factory: getFactoryConfig(),
    date: today,
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
