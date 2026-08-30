import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { departmentScope } from "@/lib/staff";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "approvals.view")) {
    return error("You don't have permission to view approvals", 403);
  }

  const leaves = db
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
    .all() as any[];

  const manual = db
    .prepare(
      `SELECT mp.*, u.name AS user_name, u.color AS user_color, u.department AS user_department,
              u.staff_type AS user_staff_type, u.avatar AS user_avatar
       FROM manual_punch_requests mp JOIN users u ON u.id = mp.user_id
       WHERE mp.status = 'pending'
       ORDER BY mp.created_at DESC`
    )
    .all() as any[];

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

  const filteredManual = manual.filter((m) => {
    const stage = m.stage || "final";
    if (user.role === "super_admin") return true;
    if (m.user_staff_type === "yellow_card") {
      if (stage !== "manager") return false;
      return user.role === "manager" && user.manager_scope === departmentScope(m.user_department);
    }
    return user.role === "admin";
  });

  return json({
    leaves: user.role === "manager" ? [] : leaves,
    manual: filteredManual,
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
