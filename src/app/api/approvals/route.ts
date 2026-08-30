import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { canActOnLeave, canActOnManual } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "approvals.view")) {
    return error("You don't have permission to view approvals", 403);
  }

  const actor = { id: user.id, role: user.role, manager_scope: user.manager_scope };

  const leaves = (
    db
      .prepare(
        `SELECT lr.*, lt.name AS leave_type_name, lt.color AS leave_type_color,
              u.name AS user_name, u.color AS user_color, u.department AS user_department,
              u.staff_type AS user_staff_type
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       JOIN users u ON u.id = lr.user_id
       WHERE lr.status = 'pending'
       ORDER BY lr.created_at DESC`
      )
      .all() as any[]
  ).filter((l) => canActOnLeave(actor, l));

  const manual = (
    db
      .prepare(
        `SELECT mp.*, u.name AS user_name, u.color AS user_color, u.department AS user_department,
              u.staff_type AS user_staff_type, u.avatar AS user_avatar
       FROM manual_punch_requests mp JOIN users u ON u.id = mp.user_id
       WHERE mp.status = 'pending'
       ORDER BY mp.created_at DESC`
      )
      .all() as any[]
  ).filter((m) => canActOnManual(actor, m));

  const changes =
    user.role === "super_admin"
      ? (db
          .prepare(
            `SELECT cr.*, u.name AS requester_name, u.color AS requester_color
             FROM change_requests cr JOIN users u ON u.id = cr.requested_by
             WHERE cr.status = 'pending' ORDER BY cr.created_at DESC`
          )
          .all() as any[])
      : [];

  return json({
    leaves,
    manual,
    changes: changes.map((c) => ({ ...c, payload: safeParse(c.payload) })),
  });
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
