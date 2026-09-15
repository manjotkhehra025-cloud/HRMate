import { db } from "./db";
import { istParts } from "./utils";
import { notifyAll } from "./notify";

export interface BirthdayUser {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  color: string;
  avatar?: string;
  dob: string; // YYYY-MM-DD, DD Month YYYY, etc.
  days_left: number;
  is_today: boolean;
  turning_age?: number;
  formatted_dob: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FULL_MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parses any date-of-birth string into numeric components.
 */
export function parseDob(dobStr: string): { birthYear: number; month: number; day: number; formatted: string } | null {
  if (!dobStr || typeof dobStr !== "string") return null;
  const str = dobStr.trim();
  if (!str) return null;

  let birthYear = 0;
  let month = 0;
  let day = 0;

  // 1. Text Month matching: "03 March 1974", "3 Mar 1974", "March 3, 1974"
  const textWords = str.split(/[\s,]+/);
  if (textWords.length >= 2) {
    for (const w of textWords) {
      const lower = w.toLowerCase().replace(/[^a-z]/g, "");
      if (FULL_MONTH_MAP[lower]) {
        month = FULL_MONTH_MAP[lower];
      } else {
        const num = parseInt(w.replace(/\D/g, ""), 10);
        if (num > 31 && num <= 2100) {
          birthYear = num;
        } else if (num >= 1 && num <= 31 && !day) {
          day = num;
        }
      }
    }
  }

  // 2. Delimited matching: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, MM-DD
  if (!month || !day) {
    const parts = str.split(/[-/.]/).map((p) => p.trim());
    if (parts.length === 3) {
      const n0 = parseInt(parts[0], 10);
      const n1 = parseInt(parts[1], 10);
      const n2 = parseInt(parts[2], 10);
      if (n0 > 1000) {
        // YYYY-MM-DD
        birthYear = n0;
        month = n1;
        day = n2;
      } else if (n2 > 1000) {
        // DD-MM-YYYY
        birthYear = n2;
        month = n1;
        day = n0;
      } else {
        month = n0;
        day = n1;
        birthYear = n2;
      }
    } else if (parts.length === 2) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    }
  }

  // 3. Fallback to standard Date parser
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      birthYear = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const formatted = `${day} ${MONTH_NAMES[month - 1]}`;
  return { birthYear, month, day, formatted };
}

/**
 * Returns list of active users whose birthday is today (IST).
 */
export function getTodayBirthdays(): BirthdayUser[] {
  const parts = istParts();
  const yearNum = parseInt(parts.year, 10);
  const currentMonth = parseInt(parts.month, 10);
  const currentDay = parseInt(parts.day, 10);

  const users = db
    .prepare(
      `SELECT id, name, email, department, designation, color, avatar, dob
       FROM users
       WHERE active = 1 AND dob IS NOT NULL AND dob != ''`
    )
    .all() as any[];

  const results: BirthdayUser[] = [];

  for (const u of users) {
    const parsed = parseDob(u.dob);
    if (!parsed) continue;

    if (parsed.month === currentMonth && parsed.day === currentDay) {
      const turningAge = parsed.birthYear > 1900 ? yearNum - parsed.birthYear : undefined;

      results.push({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department || "General",
        designation: u.designation || "Staff",
        color: u.color || "#1E6FE0",
        avatar: u.avatar || "",
        dob: u.dob,
        days_left: 0,
        is_today: true,
        turning_age: turningAge,
        formatted_dob: parsed.formatted,
      });
    }
  }

  return results;
}

/**
 * Returns list of upcoming birthdays within `daysAhead` days (default 30 days).
 */
export function getUpcomingBirthdays(daysAhead = 30): BirthdayUser[] {
  const parts = istParts();
  const yearNum = parseInt(parts.year, 10);
  const monthNum = parseInt(parts.month, 10);
  const dayNum = parseInt(parts.day, 10);
  const today = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));

  const users = db
    .prepare(
      `SELECT id, name, email, department, designation, color, avatar, dob
       FROM users
       WHERE active = 1 AND dob IS NOT NULL AND dob != ''`
    )
    .all() as any[];

  const list: BirthdayUser[] = [];

  for (const u of users) {
    const parsed = parseDob(u.dob);
    if (!parsed) continue;

    const { month, day, birthYear } = parsed;

    // Birthday this year
    let nextBday = new Date(Date.UTC(yearNum, month - 1, day));
    // If already passed this year, check next year
    if (nextBday.getTime() < today.getTime()) {
      nextBday = new Date(Date.UTC(yearNum + 1, month - 1, day));
    }

    const diffTime = nextBday.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= daysAhead) {
      const turningAge = birthYear > 1900 ? nextBday.getUTCFullYear() - birthYear : undefined;

      list.push({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department || "General",
        designation: u.designation || "Staff",
        color: u.color || "#1E6FE0",
        avatar: u.avatar || "",
        dob: u.dob,
        days_left: diffDays,
        is_today: diffDays === 0,
        turning_age: turningAge,
        formatted_dob: parsed.formatted,
      });
    }
  }

  // Sort closest first
  list.sort((a, b) => a.days_left - b.days_left);
  return list;
}

/**
 * Sends notifications to all employees for today's birthdays (debounced per day).
 */
export function checkAndNotifyBirthdays(): void {
  const parts = istParts();
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const settingKey = `bday_notified_${dateKey}`;

  const existing = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(settingKey) as any;
  if (existing) return;

  const birthdays = getTodayBirthdays();
  if (birthdays.length === 0) return;

  for (const b of birthdays) {
    notifyAll(
      `🎂 Happy Birthday, ${b.name}!`,
      `Today is ${b.name}'s birthday (${b.department} · ${b.designation}). Let's wish them a wonderful day! 🎉`,
      {
        type: "birthday",
        link: "/calendar",
      }
    );
  }

  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(settingKey, "1");
}
