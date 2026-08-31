import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { applyChangeRequest, submitChange } from "@/lib/workflow";
import { balancesForUser } from "@/lib/leave";

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
  const body = await req.json();
  const user_id = body.user_id || user.id;
  const { leave_type_id, reason } = body;

  if (!user_id || !leave_type_id) {
    return error("Employee and leave type are required");
  }

  const target = db.prepare("SELECT staff_type FROM users WHERE id = ?").get(user_id) as { staff_type?: string } | undefined;
  const lt = db.prepare("SELECT id, name FROM leave_types WHERE id = ?").get(leave_type_id) as { id: string; name: string } | undefined;

  if (target?.staff_type === "yellow_card") {
    const isEarned = lt?.id === "lt_earned" || lt?.name?.toLowerCase().includes("earned");
    if (!isEarned) {
      return error("Yellow card staff is only eligible for Earned Leave (EL). Other leave types cannot be assigned.");
    }
  }

  let delta = 0;
  if (body.set_balance !== undefined && Number.isFinite(Number(body.set_balance))) {
    const currentBalances = balancesForUser(user_id);
    const curr = currentBalances.find((b) => b.id === leave_type_id);
    const currentVal = curr ? curr.balance : 0;
    delta = Math.round((Number(body.set_balance) - currentVal) * 100) / 100;
  } else if (body.delta !== undefined && Number.isFinite(Number(body.delta))) {
    delta = Number(body.delta);
  } else {
    return error("Adjustment days (delta) or new balance (set_balance) is required");
  }

  const payload = {
    user_id,
    leave_type_id,
    delta: Number(delta),
    reason: String(reason || "Direct balance adjustment by Super Admin").trim(),
  };

  if (user.role === "super_admin") {
    applyChangeRequest("leave_balance", payload);
    return json({ ok: true, applied: true, delta });
  }
  submitChange("leave_balance", payload, user.id);
  return json({ ok: true, pending: true, delta });
}
