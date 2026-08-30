import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { departmentScope, parseWeeklyOff } from "@/lib/staff";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const userId = String(body.user_id || "");
  const weekly_off = parseWeeklyOff(body.weekly_off, -1);
  if (!userId) return error("User id required");
  if (weekly_off < 0) return error("Weekly off must be Sunday–Saturday");

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  if (!target) return error("User not found", 404);

  const canAdmin = hasPermission(user.id, "admin.users") || user.role === "super_admin";
  if (!canAdmin) {
    if (user.role !== "manager") return error("You don't have permission to change weekly off", 403);
    if (target.role === "super_admin") return error("You can't change Super Admin weekly off", 403);
    if (user.manager_scope !== departmentScope(target.department)) {
      return error("You can only change weekly off for your departments", 403);
    }
  }

  db.prepare("UPDATE users SET weekly_off = ? WHERE id = ?").run(weekly_off, userId);
  return json({ ok: true, weekly_off });
}
