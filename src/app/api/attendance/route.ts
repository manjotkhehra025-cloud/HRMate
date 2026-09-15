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
  let record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;

  let shift = null;
  if (record?.shift_id) {
    shift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(record.shift_id) as any;
  }

  // If already punched in but no shift recorded, auto-assign based on punch in timestamp
  if (!shift && record?.punch_in_at) {
    shift = pickShiftForNow(record.punch_in_at, user.id);
    if (shift) {
      db.prepare("UPDATE attendance SET shift_id = ? WHERE id = ?").run(shift.id, record.id);
    }
  }

  // If not yet punched today, preview expected shift based on current time (IST)
  if (!shift) {
    shift = pickShiftForNow(Date.now(), user.id);
  }

  if (!shift) {
    shift = db.prepare("SELECT * FROM shifts ORDER BY sort LIMIT 1").get() as any;
  }

  return json({
    today: record || null,
    factory: getFactoryConfig(),
    date: today,
    shift: shift || { name: "General Day Shift", hours: 9, start_time: "08:00" },
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

  let activeShift = null;

  if (!record) {
    // ⚡ Intelligent Auto Shift Detection on Punch In
    activeShift = pickShiftForNow(now, user.id);
    const shiftId = activeShift?.id || null;

    db.prepare(
      `INSERT INTO attendance (id, user_id, date, punch_in_at, punch_in_lat, punch_in_lng, punch_in_geofence, shift_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(randomId("a_"), user.id, today, now, lat, lng, shiftId);
    creditCompOffIfWorked(user.id, today);
  } else if (!record.punch_out_at) {
    db.prepare(
      `UPDATE attendance SET punch_out_at = ?, punch_out_lat = ?, punch_out_lng = ?, punch_out_geofence = 1
       WHERE id = ?`
    ).run(now, lat, lng, record.id);

    if (record.shift_id) {
      activeShift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(record.shift_id) as any;
    }
  } else {
    return error("You've already punched in and out today.");
  }

  record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today);

  if (!activeShift && record?.shift_id) {
    activeShift = db.prepare("SELECT * FROM shifts WHERE id = ?").get(record.shift_id) as any;
  }
  if (!activeShift) {
    activeShift = pickShiftForNow(record?.punch_in_at || now, user.id);
  }

  return json({
    ok: true,
    record,
    shift: activeShift || { name: "General Day Shift", hours: 9, start_time: "08:00" },
    geo,
  });
}
