import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { applyChangeRequest, submitChange } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "leaves.adjust") && user.role !== "super_admin") {
    return error("You don't have permission to adjust leave balances", 403);
  }
  const users = db
    .prepare(
      `SELECT id, name, department, staff_type, role FROM users WHERE active = 1 ORDER BY name`
    )
    .all();
  const types = db.prepare("SELECT * FROM leave_types ORDER BY sort").all();
  const extras = db.prepare("SELECT * FROM leave_balances").all() as {
    user_id: string;
    leave_type_id: string;
    extra_days: number;
  }[];
  return json({ users, types, extras });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "leaves.adjust") && user.role !== "super_admin") {
    return error("You don't have permission to adjust leave balances", 403);
  }
  const { user_id, leave_type_id, delta, reason } = await req.json();
  if (!user_id || !leave_type_id || !Number.isFinite(Number(delta))) {
    return error("Employee, leave type and days are required");
  }
  const payload = {
    user_id,
    leave_type_id,
    delta: Number(delta),
    reason: String(reason || "").trim(),
  };
  if (user.role === "super_admin") {
    applyChangeRequest("leave_balance", payload);
    return json({ ok: true, applied: true });
  }
  submitChange("leave_balance", payload, user.id);
  return json({ ok: true, pending: true });
}
