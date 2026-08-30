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
  const types = db.prepare("SELECT * FROM leave_types ORDER BY sort").all() as any[];
  const extras = db
    .prepare("SELECT leave_type_id, extra_days FROM leave_balances WHERE user_id = ?")
    .all(userId) as { leave_type_id: string; extra_days: number }[];
  const extraMap: Record<string, number> = {};
  for (const e of extras) extraMap[e.leave_type_id] = e.extra_days;

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
