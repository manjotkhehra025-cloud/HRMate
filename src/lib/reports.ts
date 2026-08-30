import db from "./db";
import { getFactoryConfig } from "./geo";
import { istTimestamp } from "./attendance";
import { istParts } from "./utils";
import { isWeeklyOff, parseWeeklyOff } from "./staff";

export type DayStatus = "present" | "half" | "absent" | "weekly_off" | "future" | "empty";

export function dayStatus(
  date: string,
  rec: { punch_in_at: number | null; punch_out_at: number | null } | null,
  today: string,
  weeklyOff = 6
): DayStatus {
  if (date > today) return "future";
  if (rec?.punch_in_at && rec?.punch_out_at) {
    const hours = (rec.punch_out_at - rec.punch_in_at) / 3600000;
    return hours < 4.5 ? "half" : "present";
  }
  if (rec?.punch_in_at) return date === today ? "present" : "half";
  if (isWeeklyOff(date, weeklyOff)) return "weekly_off";
  if (date === today) return "empty";
  return "absent";
}

export function monthDates(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

export function workedLabel(inAt: number | null, outAt: number | null): string {
  if (!inAt || !outAt || outAt <= inAt) return "—";
  const mins = Math.round((outAt - inAt) / 60000);
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${h}h ${mm}m`;
}

export function isLate(date: string, punchIn: number | null, workStart: string): boolean {
  if (!punchIn) return false;
  try {
    return punchIn > istTimestamp(date, workStart);
  } catch {
    return false;
  }
}

export function monthReport(month: string) {
  const factory = getFactoryConfig();
  const today = istParts().dateKey;
  const dates = monthDates(month);
  const users = db
    .prepare(
      `SELECT id, name, department, staff_type, color, weekly_off FROM users WHERE active = 1 AND role != 'super_admin' ORDER BY name`
    )
    .all() as any[];

  const att = db
    .prepare(`SELECT * FROM attendance WHERE date LIKE ?`)
    .all(`${month}%`) as any[];
  const byUser: Record<string, Record<string, any>> = {};
  for (const r of att) {
    byUser[r.user_id] = byUser[r.user_id] || {};
    byUser[r.user_id][r.date] = r;
  }

  const leaveDays = db
    .prepare(
      `SELECT user_id, SUM(days) AS total FROM leave_requests
       WHERE status = 'approved' AND start_date LIKE ?
       GROUP BY user_id`
    )
    .all(`${month}%`) as { user_id: string; total: number }[];
  const leaveMap: Record<string, number> = {};
  for (const l of leaveDays) leaveMap[l.user_id] = l.total;

  const perEmployee = users.map((u) => {
    let present = 0;
    let late = 0;
    let half = 0;
    let absent = 0;
    const series: number[] = [];
    const off = parseWeeklyOff(u.weekly_off, 6);
    for (const d of dates) {
      const st = dayStatus(d, byUser[u.id]?.[d] || null, today, off);
      series.push(st === "present" || st === "half" ? 1 : 0);
      if (st === "present") present++;
      else if (st === "half") half++;
      else if (st === "absent") absent++;
      if (isLate(d, byUser[u.id]?.[d]?.punch_in_at || null, factory.workStart)) late++;
    }
    const working = dates.filter((d) => d <= today && !isWeeklyOff(d, off)).length || 1;
    const rate = Math.round(((present + half * 0.5) / working) * 1000) / 10;
    return {
      id: u.id,
      name: u.name,
      department: u.department || "—",
      staff_type: u.staff_type || "official",
      present,
      late,
      half,
      absent,
      rate,
      leave_days: leaveMap[u.id] || 0,
    };
  });

  const deptMap: Record<string, { present: number; working: number }> = {};
  for (const e of perEmployee) {
    const k = e.department || "—";
    deptMap[k] = deptMap[k] || { present: 0, working: 0 };
    deptMap[k].present += e.present;
    deptMap[k].working += e.present + e.absent + e.half;
  }
  const byDepartment = Object.entries(deptMap).map(([name, v]) => ({
    name,
    rate: v.working ? Math.round((v.present / v.working) * 1000) / 10 : 0,
  }));

  const totals = perEmployee.reduce(
    (a, e) => ({
      present: a.present + e.present,
      late: a.late + e.late,
      half: a.half + e.half,
      absent: a.absent + e.absent,
    }),
    { present: 0, late: 0, half: 0, absent: 0 }
  );
  const workingDays = dates.filter((d) => d <= today && !isWeeklyOff(d, 6)).length;
  const possible = Math.max(1, workingDays * Math.max(1, perEmployee.length));
  const pct = Math.round(((totals.present + totals.half * 0.5) / possible) * 1000) / 10;

  const daily = dates.map((d) => {
    let c = 0;
    for (const u of users) {
      const st = dayStatus(d, byUser[u.id]?.[d] || null, today, parseWeeklyOff(u.weekly_off, 6));
      if (st === "present" || st === "half") c++;
    }
    return { date: d, present: c };
  });

  const onTimeRate =
    totals.present + totals.half > 0
      ? Math.round(((totals.present + totals.half - totals.late) / (totals.present + totals.half)) * 100)
      : 100;
  const avgLate = perEmployee.length
    ? Math.round(perEmployee.reduce((s, e) => s + e.late, 0) / perEmployee.length)
    : 0;

  return {
    month,
    factory: factory.name,
    workingDays,
    pct,
    totals,
    daily,
    byDepartment,
    perEmployee,
    insights: {
      avgLateMin: avgLate,
      onTimeRate,
      leaveDays: perEmployee.reduce((s, e) => s + e.leave_days, 0),
    },
  };
}
