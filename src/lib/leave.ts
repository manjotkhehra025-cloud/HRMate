import db from "@/lib/db";
import { istParts } from "@/lib/utils";

export function leavePeriodKey(resetPeriod: string, date?: string) {
  const reset = resetPeriod === "month" ? "month" : "year";
  if (reset === "month") return (date || istParts().dateKey).slice(0, 7);
  return (date || istParts().dateKey).slice(0, 4);
}

export function usedInPeriod(
  userId: string,
  typeId: string,
  resetPeriod: string,
  date?: string,
  statuses: string[] = ["approved", "pending"]
) {
  const key = leavePeriodKey(resetPeriod, date);
  const n = resetPeriod === "month" ? 7 : 4;
  const placeholders = statuses.map(() => "?").join(",");
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(days),0) AS total FROM leave_requests
       WHERE user_id = ? AND leave_type_id = ? AND status IN (${placeholders})
       AND substr(start_date, 1, ?) = ?`
    )
    .get(userId, typeId, ...statuses, n, key) as { total: number };
  return row.total || 0;
}

export function balancesForUser(userId: string) {
  const user = db
    .prepare("SELECT id, staff_type, created_at FROM users WHERE id = ?")
    .get(userId) as { id: string; staff_type?: string; created_at?: number } | undefined;

  const isYellowCard = user?.staff_type === "yellow_card";
  const types = db.prepare("SELECT * FROM leave_types ORDER BY sort").all() as any[];
  const extras = db
    .prepare("SELECT leave_type_id, extra_days FROM leave_balances WHERE user_id = ?")
    .all(userId) as { leave_type_id: string; extra_days: number }[];
  const extraMap: Record<string, number> = {};
  for (const e of extras) extraMap[e.leave_type_id] = e.extra_days;

  if (isYellowCard) {
    // Yellow card employees only get Earned Leave (EL): 15 days/year, 1.25 per month accrual
    const elType = types.find(
      (t) => t.id === "lt_earned" || t.name.toLowerCase().includes("earned")
    ) || {
      id: "lt_earned",
      name: "Earned Leave (EL)",
      color: "#16B878",
      days_per_year: 15,
      reset_period: "year",
    };

    const currentMonthNum = parseInt(istParts().month, 10) || 1; // 1 to 12
    const totalYearDays = 15;
    const accruedDays = Math.round(currentMonthNum * 1.25 * 100) / 100;
    const extra = extraMap[elType.id] || 0;
    const used = usedInPeriod(userId, elType.id, "year");
    const totalAccrued = accruedDays + extra;

    return [
      {
        ...elType,
        id: elType.id || "lt_earned",
        name: "Earned Leave (EL)",
        color: elType.color || "#16B878",
        reset_period: "year",
        extra,
        used,
        days_per_year: totalYearDays,
        accrued_days: totalAccrued,
        accrual_rate: "1.25/month",
        period_label: "1.25/month (15/year)",
        balance: Math.max(0, Math.round((totalAccrued - used) * 100) / 100),
      },
    ];
  }

  return types.map((t) => {
    const reset = t.reset_period === "month" ? "month" : "year";
    const extra = extraMap[t.id] || 0;
    const used = usedInPeriod(userId, t.id, reset);
    const allowance = (t.days_per_year || 0) + extra;
    return {
      ...t,
      reset_period: reset,
      extra,
      used,
      days_per_year: allowance,
      period_label: reset === "month" ? "month" : "year",
      balance: allowance - used,
    };
  });
}
