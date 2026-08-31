import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { businessDays, istParts } from "@/lib/utils";
import { balancesForUser, usedInPeriod } from "@/lib/leave";
import { approverFallback, getApprover, listApproverOptions, notifyLeaveApprovers } from "@/lib/workflow";
import { parseWeeklyOff } from "@/lib/staff";
import { listGraceDays } from "@/lib/jobs";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const requests = db
    .prepare(
      `SELECT lr.*, lt.name AS leave_type_name, lt.color AS leave_type_color,
              a.name AS approver_name
       FROM leave_requests lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       LEFT JOIN users a ON a.id = lr.approver_id
       WHERE lr.user_id = ? ORDER BY lr.created_at DESC`
    )
    .all(user.id);

  const balance = balancesForUser(user.id);
  const types =
    user.staff_type === "yellow_card"
      ? balance
      : (db.prepare("SELECT * FROM leave_types ORDER BY sort").all() as any[]);

  const openMissed = listGraceDays(user.id, parseWeeklyOff(user.weekly_off, 6));
  const approvers = listApproverOptions(user.id);

  return json({
    requests,
    types,
    balance,
    openMissed,
    approvers,
    approver_fallback: approverFallback(user.id),
  });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "leaves.apply")) {
    return error("You don't have permission to apply for leave", 403);
  }

  const { leave_type_id, start_date, end_date, reason, approver_id } = await req.json();
  if (!leave_type_id || !start_date || !end_date || !reason) {
    return error("All fields are required");
  }
  const approver = getApprover(String(approver_id || ""), user.id);
  if (!approver) return error("Pick who should approve this request");
  if (end_date < start_date) return error("End date must be after start date");

  const type = db.prepare("SELECT * FROM leave_types WHERE id = ?").get(leave_type_id) as any;
  if (!type) return error("Invalid leave type");

  const isYellowCard = user.staff_type === "yellow_card";

  // Yellow card rule: only Earned Leave (15/year, 1.25/month accrual)
  if (isYellowCard) {
    const isEarned = type.id === "lt_earned" || type.name.toLowerCase().includes("earned");
    if (!isEarned) {
      return error("Yellow card staff are only eligible for Earned Leave (EL).");
    }
  } else if (type.id === "lt_comp") {
    // Comp off only for official staff
  }

  const days = businessDays(start_date, end_date, parseWeeklyOff(user.weekly_off, 6));
  if (days <= 0) return error("Selected range has no working days");

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

  if (isYellowCard) {
    // 1.25 days per month accrual
    const currentMonthNum = parseInt(istParts().month, 10) || 1;
    const accrued = Math.round(currentMonthNum * 1.25 * 100) / 100;
    const totalAccrued = accrued + extra;
    const used = usedInPeriod(user.id, leave_type_id, "year", start_date);
    if (used + days > totalAccrued) {
      const remaining = Math.max(0, Math.round((totalAccrued - used) * 100) / 100);
      return error(
        `Insufficient EL balance. You have ${remaining} day(s) accrued to date (1.25 days/month of 15 days/year).`
      );
    }
  } else {
    const allowance = type.days_per_year + extra;
    const used = usedInPeriod(user.id, leave_type_id, reset, start_date);
    if (used + days > allowance) {
      const unit = reset === "month" ? "this month" : "this year";
      return error(`Insufficient balance ${unit}. You have ${allowance - used} day(s) remaining.`);
    }
  }

  db.prepare(
    `INSERT INTO leave_requests (id, user_id, leave_type_id, start_date, end_date, days, reason, created_at, approver_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(randomId("lr_"), user.id, leave_type_id, start_date, end_date, days, reason, Date.now(), approver.id);

  notifyLeaveApprovers(
    { id: user.id, name: user.name, role: user.role, department: user.department },
    `${days} day(s) of ${type.name} (${start_date} to ${end_date})`,
    approver.id
  );

  return json({ ok: true, days, approver_name: approver.name });
}
