import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { notifyMany } from "@/lib/notify";
import { businessDays } from "@/lib/utils";
import { balancesForUser, usedInPeriod } from "@/lib/leave";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const requests = db
    .prepare(
      `SELECT lr.*, lt.name AS leave_type_name, lt.color AS leave_type_color
       FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.user_id = ? ORDER BY lr.created_at DESC`
    )
    .all(user.id);

  const types = db.prepare("SELECT * FROM leave_types ORDER BY sort").all();
  const balance = balancesForUser(user.id);

  return json({ requests, types, balance });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "leaves.apply")) {
    return error("You don't have permission to apply for leave", 403);
  }

  const { leave_type_id, start_date, end_date, reason } = await req.json();
  if (!leave_type_id || !start_date || !end_date || !reason) {
    return error("All fields are required");
  }
  if (end_date < start_date) return error("End date must be after start date");

  const days = businessDays(start_date, end_date);
  if (days <= 0) return error("Selected range has no working days");

  const type = db.prepare("SELECT * FROM leave_types WHERE id = ?").get(leave_type_id) as any;
  if (!type) return error("Invalid leave type");

  const reset = type.reset_period === "month" ? "month" : "year";
  if (reset === "month" && start_date.slice(0, 7) !== end_date.slice(0, 7)) {
    return error("Short leave must start and end in the same month");
  }

  const extra =
    (
      db
        .prepare("SELECT extra_days FROM leave_balances WHERE user_id = ? AND leave_type_id = ?")
        .get(user.id, leave_type_id) as { extra_days: number } | undefined
    )?.extra_days || 0;
  const allowance = type.days_per_year + extra;
  const used = usedInPeriod(user.id, leave_type_id, reset, start_date);
  if (used + days > allowance) {
    const unit = reset === "month" ? "this month" : "this year";
    return error(`Insufficient balance ${unit}. You have ${allowance - used} day(s) remaining.`);
  }

  db.prepare(
    `INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, days, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(randomId("lr_"), user.id, leave_type_id, start_date, end_date, days, reason, Date.now());

  const approvers = db
    .prepare("SELECT id FROM users WHERE role IN ('super_admin','admin','manager') AND active = 1")
    .all() as { id: string }[];
  notifyMany(
    approvers.map((a) => a.id),
    "Leave request",
    `${user.name} requested ${days} day(s) of ${type.name} (${start_date} to ${end_date})`,
    { type: "approval", link: "/approvals" }
  );

  return json({ ok: true, days });
}
