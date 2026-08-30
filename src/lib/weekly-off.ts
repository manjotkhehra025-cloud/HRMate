import db from "./db";
import { notify } from "./notify";
import { isWeeklyOff } from "./staff";

/** Official staff who punch on their weekly off earn 1 compensatory off. Yellow card never does. */
export function creditCompOffIfWorked(userId: string, date: string) {
  const user = db
    .prepare("SELECT id, staff_type, weekly_off FROM users WHERE id = ?")
    .get(userId) as { id: string; staff_type: string; weekly_off: number } | undefined;
  if (!user || user.staff_type === "yellow_card") return false;
  if (!isWeeklyOff(date, user.weekly_off)) return false;

  const att = db
    .prepare(
      `SELECT id, punch_in_at, comp_off_credited FROM attendance WHERE user_id = ? AND date = ?`
    )
    .get(userId, date) as { id: string; punch_in_at: number | null; comp_off_credited: number } | undefined;
  if (!att?.punch_in_at || att.comp_off_credited) return false;

  const type = db.prepare("SELECT id FROM leave_types WHERE id = 'lt_comp'").get() as { id: string } | undefined;
  if (!type) return false;

  const tx = db.transaction(() => {
    db.prepare("UPDATE attendance SET comp_off_credited = 1 WHERE id = ?").run(att.id);
    db.prepare(
      `INSERT INTO leave_balances (user_id, leave_type_id, extra_days) VALUES (?, 'lt_comp', 1)
       ON CONFLICT(user_id, leave_type_id) DO UPDATE SET extra_days = leave_balances.extra_days + 1`
    ).run(userId);
  });
  tx();

  notify(userId, "Compensatory off earned", `You worked on your weekly off (${date}) and earned 1 Comp off.`, {
    type: "success",
    link: "/leaves",
  });
  return true;
}
