import db from "./db";
import { notify } from "./notify";
import { istParts, formatDate } from "./utils";
import { addCalendarDays, addWorkingDays, isWeeklyOff, parseWeeklyOff } from "./staff";

const MORNING_KEY = "job_morning_date";
const POLICY_KEY = "absent_policy_start";

function getSetting(key: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value || "";
}

function setSetting(key: string, value: string) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

function afterMorning(hour: number, minute: number) {
  return hour > 6 || (hour === 6 && minute >= 30);
}

function morningWindow(hour: number) {
  return hour >= 6 && hour < 10;
}

function hasPunchIn(userId: string, date: string) {
  const row = db
    .prepare("SELECT punch_in_at FROM attendance WHERE user_id = ? AND date = ?")
    .get(userId, date) as { punch_in_at: number | null } | undefined;
  return !!row?.punch_in_at;
}

function leaveOn(userId: string, date: string): "approved" | "pending" | null {
  const row = db
    .prepare(
      `SELECT status FROM leave_requests
       WHERE user_id = ? AND start_date <= ? AND end_date >= ? AND status IN ('approved', 'pending')
       ORDER BY CASE status WHEN 'approved' THEN 0 ELSE 1 END
       LIMIT 1`
    )
    .get(userId, date, date) as { status: string } | undefined;
  if (row?.status === "approved") return "approved";
  if (row?.status === "pending") return "pending";
  return null;
}

function upsertMissed(userId: string, date: string, deadline: string) {
  db.prepare(
    `INSERT INTO missed_days (user_id, date, deadline, notified_at, auto_absent_at)
     VALUES (?, ?, ?, 0, 0)
     ON CONFLICT(user_id, date) DO NOTHING`
  ).run(userId, date, deadline);
}

type StaffRow = { id: string; name: string; weekly_off: number; role: string };

function staff(): StaffRow[] {
  return db
    .prepare(
      `SELECT id, name, weekly_off, role FROM users WHERE active = 1 AND role != 'super_admin'`
    )
    .all() as StaffRow[];
}

function sendMorningNudge(today: string) {
  if (getSetting(MORNING_KEY) === today) return;
  const people = staff();
  for (const u of people) {
    const off = parseWeeklyOff(u.weekly_off, 6);
    if (isWeeklyOff(today, off)) continue;
    if (hasPunchIn(u.id, today)) continue;
    if (leaveOn(u.id, today) === "approved") continue;
    notify(u.id, "Time to punch in", "Good morning. Shift starts soon — punch in when you reach the factory.", {
      type: "info",
      link: "/attendance",
    });
  }
  setSetting(MORNING_KEY, today);
}

function processMissedDays(today: string) {
  let start = getSetting(POLICY_KEY);
  if (!start) {
    setSetting(POLICY_KEY, today);
    start = today;
  }
  const lookback = addCalendarDays(today, -14);
  const from = start > lookback ? start : lookback;
  const people = staff();

  for (const u of people) {
    const off = parseWeeklyOff(u.weekly_off, 6);
    let d = from;
    while (d < today) {
      if (!isWeeklyOff(d, off) && !hasPunchIn(u.id, d)) {
        const cover = leaveOn(u.id, d);
        const deadline = addWorkingDays(d, 2, off);
        const row = db
          .prepare("SELECT notified_at, auto_absent_at, deadline FROM missed_days WHERE user_id = ? AND date = ?")
          .get(u.id, d) as { notified_at: number; auto_absent_at: number; deadline: string } | undefined;

        if (cover === "approved") {
          d = addCalendarDays(d, 1);
          continue;
        }

        if (today <= deadline) {
          if (!row) upsertMissed(u.id, d, deadline);
          const cur = db
            .prepare("SELECT notified_at FROM missed_days WHERE user_id = ? AND date = ?")
            .get(u.id, d) as { notified_at: number } | undefined;
          if (cur && !cur.notified_at) {
            notify(
              u.id,
              "Apply leave in 2 days",
              `You did not punch in on ${formatDate(d)}. Apply leave within 2 working days (by ${formatDate(deadline)}) or you will be marked absent. Your weekly off is not counted.`,
              { type: "warning", link: "/leaves" }
            );
            db.prepare("UPDATE missed_days SET notified_at = ?, deadline = ? WHERE user_id = ? AND date = ?").run(
              Date.now(),
              deadline,
              u.id,
              d
            );
          }
        } else if (cover !== "pending") {
          if (!row) upsertMissed(u.id, d, deadline);
          const cur = db
            .prepare("SELECT auto_absent_at FROM missed_days WHERE user_id = ? AND date = ?")
            .get(u.id, d) as { auto_absent_at: number } | undefined;
          if (cur && !cur.auto_absent_at) {
            db.prepare("UPDATE missed_days SET auto_absent_at = ?, deadline = ? WHERE user_id = ? AND date = ?").run(
              Date.now(),
              deadline,
              u.id,
              d
            );
            notify(
              u.id,
              "Marked absent",
              `You were marked absent for ${formatDate(d)} because leave was not applied in 2 working days.`,
              { type: "warning", link: "/attendance" }
            );
          }
        }
      }
      d = addCalendarDays(d, 1);
    }
  }
}

export function listGraceDays(userId: string, weeklyOff: number, today = istParts().dateKey) {
  const out: { date: string; deadline: string }[] = [];
  let d = addCalendarDays(today, -8);
  const off = parseWeeklyOff(weeklyOff, 6);
  while (d < today) {
    if (!isWeeklyOff(d, off) && !hasPunchIn(userId, d)) {
      const cover = leaveOn(userId, d);
      const deadline = addWorkingDays(d, 2, off);
      if (!cover && today <= deadline) out.push({ date: d, deadline });
    }
    d = addCalendarDays(d, 1);
  }
  return out;
}

export function runDailyJobs(now = new Date()) {
  const parts = istParts(now);
  if (!afterMorning(parts.hour, parts.minute)) return { skipped: true, reason: "before 06:30 IST" };

  if (morningWindow(parts.hour)) {
    sendMorningNudge(parts.dateKey);
  }
  processMissedDays(parts.dateKey);
  return { ok: true, date: parts.dateKey };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startScheduler() {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    try {
      runDailyJobs();
    } catch (e) {
      console.error("[hrmate jobs]", e);
    } finally {
      running = false;
    }
  };
  tick();
  timer = setInterval(tick, 60_000);
}
