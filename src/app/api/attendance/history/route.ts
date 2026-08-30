import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM

  const records = db
    .prepare(
      `SELECT a.*, s.name AS shift_name, s.start_time AS shift_start, s.hours AS shift_hours
       FROM attendance a
       LEFT JOIN shifts s ON s.id = a.shift_id
       WHERE a.user_id = ? AND a.date LIKE ? ORDER BY a.date DESC`
    )
    .all(user.id, `${month}%`);

  const manualRequests = db
    .prepare(
      `SELECT * FROM manual_punch_requests WHERE user_id = ? AND date LIKE ? ORDER BY created_at DESC`
    )
    .all(user.id, `${month}%`);

  return json({ records, manualRequests, month });
}
