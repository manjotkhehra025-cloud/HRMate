import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json, dateKey } from "@/lib/api";
import { balancesForUser } from "@/lib/leave";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const viewer = requireUser();
  if (!viewer) return unauthorized();

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("id");

  if (!targetId) {
    return error("Member ID is required", 400);
  }

  const isSuperAdmin = viewer.role === "super_admin";
  const isAdmin = isSuperAdmin || viewer.role === "admin";
  const isSelf = viewer.id === targetId;

  // 1. Fetch user profile
  const user = db
    .prepare(
      `SELECT id, email, name, role, department, designation, phone, color, active,
              weekly_off, staff_type, avatar, created_at
       FROM users WHERE id = ?`
    )
    .get(targetId) as any;

  if (!user) {
    return error("Member not found", 404);
  }

  const today = dateKey();
  const currentMonthKey = today.slice(0, 7); // YYYY-MM

  // 2. Today's Punch
  const todayAtt = db
    .prepare(
      `SELECT punch_in_at, punch_out_at, punch_in_geofence, shift_id
       FROM attendance 
       WHERE user_id = ? AND date = ?`
    )
    .get(targetId, today) as any;

  // 3. Current Month Attendance Stats
  const monthPunches = db
    .prepare(
      `SELECT COUNT(*) as total_days,
              SUM(CASE WHEN punch_in_geofence = 1 THEN 1 ELSE 0 END) as verified_days,
              SUM(CASE WHEN punch_out_at IS NOT NULL THEN (punch_out_at - punch_in_at) ELSE 0 END) as total_duration_ms
       FROM attendance
       WHERE user_id = ? AND substr(date, 1, 7) = ?`
    )
    .get(targetId, currentMonthKey) as any;

  const totalDays = monthPunches?.total_days || 0;
  const verifiedDays = monthPunches?.verified_days || 0;
  const onTimeRate = totalDays > 0 ? Math.round((verifiedDays / totalDays) * 100) : 100;

  // 4. Leave Balances
  const balances = balancesForUser(targetId);

  // 5. Recent Leave History (last 5 records)
  const recentLeaves = db
    .prepare(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.days, lr.status, lr.reason,
              lt.name as leave_type_name, lt.color as leave_type_color
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.user_id = ?
       ORDER BY lr.created_at DESC
       LIMIT 5`
    )
    .all(targetId) as any[];

  // 6. KRA summary for official staff
  let kraSummary = null;
  if (user.staff_type === "official") {
    const kras = db
      .prepare(
        `SELECT COUNT(*) as total_kras,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_kras,
                AVG(manager_score) as avg_manager_score,
                AVG(self_score) as avg_self_score
         FROM user_kras
         WHERE user_id = ? AND period LIKE '2026%'`
      )
      .get(targetId) as any;

    if (kras && kras.total_kras > 0) {
      kraSummary = {
        total: kras.total_kras,
        approved: kras.approved_kras,
        score: kras.avg_manager_score ? Math.round(kras.avg_manager_score * 10) / 10 : null,
      };
    }
  }

  return json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      department: user.department || "General",
      designation: user.designation || "",
      staff_type: user.staff_type || "official",
      weekly_off: user.weekly_off ?? 6,
      avatar: user.avatar,
      color: user.color,
    },
    todayAttendance: {
      in: todayAtt?.punch_in_at || null,
      out: todayAtt?.punch_out_at || null,
      geofenced: todayAtt?.punch_in_geofence === 1,
      isPresent: !!(todayAtt?.punch_in_at && !todayAtt?.punch_out_at),
      isCompleted: !!(todayAtt?.punch_in_at && todayAtt?.punch_out_at),
    },
    monthStats: {
      totalDays,
      onTimeRate,
      totalHours: Math.round(((monthPunches?.total_duration_ms || 0) / (1000 * 60 * 60)) * 10) / 10,
    },
    balances,
    recentLeaves,
    kraSummary,
    viewerPermissions: {
      isSuperAdmin,
      isAdmin,
      isSelf,
      canViewLeaves: isAdmin || isSelf || hasPermission(viewer.id, "leaves.view"),
      canAdjustLeaves: isSuperAdmin || hasPermission(viewer.id, "leaves.adjust"),
    },
  });
}
