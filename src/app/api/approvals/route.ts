import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "approvals.view")) {
    return error("You don't have permission to view approvals", 403);
  }

  const leaves = db
    .prepare(
      `SELECT lr.*, lt.name AS leave_type_name, lt.color AS leave_type_color,
              u.name AS user_name, u.color AS user_color, u.department AS user_department
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       JOIN users u ON u.id = lr.user_id
       WHERE lr.status = 'pending'
       ORDER BY lr.created_at DESC`
    )
    .all();

  const manual = db
    .prepare(
      `SELECT mp.*, u.name AS user_name, u.color AS user_color, u.department AS user_department
       FROM manual_punch_requests mp JOIN users u ON u.id = mp.user_id
       WHERE mp.status = 'pending'
       ORDER BY mp.created_at DESC`
    )
    .all();

  return json({ leaves, manual });
}
