import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json, dateKey } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const canTeam = hasPermission(user.id, "attendance.team") || hasPermission(user.id, "leaves.team");
  if (!canTeam) return error("You don't have permission to view the team", 403);

  const today = dateKey();
  const users = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.department, u.designation, u.color, u.active,
        u.weekly_off, u.staff_type,
        (SELECT punch_in_at FROM attendance a WHERE a.user_id = u.id AND a.date = ?) AS today_in,
        (SELECT punch_out_at FROM attendance a WHERE a.user_id = u.id AND a.date = ?) AS today_out
       FROM users u WHERE u.active = 1 ORDER BY u.name`
    )
    .all(today, today);

  const leaves = db
    .prepare(
      `SELECT lr.*, lt.name AS leave_type_name, lt.color AS leave_type_color, u.name AS user_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       JOIN users u ON u.id = lr.user_id
       WHERE lr.status = 'approved' AND lr.end_date >= ?
       ORDER BY lr.start_date`
    )
    .all(today);

  return json({ users, leaves });
}
