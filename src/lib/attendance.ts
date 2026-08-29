import db from "./db";
import { randomId } from "./crypto";

/** Parse a calendar date + HH:MM as IST (Asia/Kolkata). */
export function istTimestamp(date: string, time: string): number {
  const t = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const ts = new Date(`${date}T${t}+05:30`).getTime();
  if (!Number.isFinite(ts)) {
    throw new Error("Invalid date or time");
  }
  return ts;
}

/**
 * Apply an approved manual punch. Always overwrites the day's punch_in /
 * punch_out so a forgotten GPS punch can be corrected to the real times.
 */
export function applyApprovedManualPunch(row: {
  user_id: string;
  date: string;
  type: string;
  time: string;
}) {
  const ts = istTimestamp(row.date, row.time);
  const note = "Manual (approved)";
  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(row.user_id, row.date) as any;

  if (!record) {
    if (row.type === "punch_in") {
      db.prepare(
        `INSERT INTO attendance (id, user_id, date, punch_in_at, punch_in_geofence, notes)
         VALUES (?, ?, ?, ?, 0, ?)`
      ).run(randomId("a_"), row.user_id, row.date, ts, note);
    } else {
      db.prepare(
        `INSERT INTO attendance (id, user_id, date, punch_out_at, punch_out_geofence, notes)
         VALUES (?, ?, ?, ?, 0, ?)`
      ).run(randomId("a_"), row.user_id, row.date, ts, note);
    }
    return;
  }

  if (row.type === "punch_in") {
    db.prepare(
      `UPDATE attendance SET punch_in_at = ?, punch_in_geofence = 0, notes = ? WHERE id = ?`
    ).run(ts, note, record.id);
  } else {
    db.prepare(
      `UPDATE attendance SET punch_out_at = ?, punch_out_geofence = 0, notes = ? WHERE id = ?`
    ).run(ts, note, record.id);
  }
}
