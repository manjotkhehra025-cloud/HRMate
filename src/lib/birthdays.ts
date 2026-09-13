import { db } from "./db";
import { istParts } from "./utils";
import { notifyAll, notifyUser } from "./notify";

export interface BirthdayUser {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  color: string;
  avatar?: string;
  dob: string; // YYYY-MM-DD or MM-DD
  days_left: number;
  is_today: boolean;
  turning_age?: number;
  formatted_dob: string;
}

/**
 * Returns list of active users whose birthday is today (IST).
 */
export function getTodayBirthdays(): BirthdayUser[] {
  const parts = istParts();
  const yearNum = parseInt(parts.year, 10);
  const currentMonth = String(parts.month).padStart(2, "0");
  const currentDay = String(parts.day).padStart(2, "0");
  const currentMMDD = `${currentMonth}-${currentDay}`;

  const users = db
    .prepare(
      `SELECT id, name, email, department, designation, color, avatar, dob
       FROM users
       WHERE active = 1 AND dob IS NOT NULL AND dob != ''`
    )
    .all() as any[];

  const results: BirthdayUser[] = [];

  for (const u of users) {
    const dobStr = u.dob.trim();
    if (!dobStr) continue;

    // Handle YYYY-MM-DD or MM-DD
    const dobParts = dobStr.split("-");
    let month = "";
    let day = "";
    let birthYear = 0;

    if (dobParts.length === 3) {
      birthYear = parseInt(dobParts[0], 10);
      month = dobParts[1].padStart(2, "0");
      day = dobParts[2].padStart(2, "0");
    } else if (dobParts.length === 2) {
      month = dobParts[0].padStart(2, "0");
      day = dobParts[1].padStart(2, "0");
    }

    if (`${month}-${day}` === currentMMDD) {
      const turningAge = birthYear > 1900 ? yearNum - birthYear : undefined;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formatted = `${parseInt(day, 10)} ${monthNames[parseInt(month, 10) - 1]}`;

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
        formatted_dob: formatted,
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
    const dobStr = u.dob.trim();
    if (!dobStr) continue;

    const dobParts = dobStr.split("-");
    let month = 0;
    let day = 0;
    let birthYear = 0;

    if (dobParts.length === 3) {
      birthYear = parseInt(dobParts[0], 10);
      month = parseInt(dobParts[1], 10);
      day = parseInt(dobParts[2], 10);
    } else if (dobParts.length === 2) {
      month = parseInt(dobParts[0], 10);
      day = parseInt(dobParts[1], 10);
    }

    if (!month || !day) continue;

    // Birthday this year
    let nextBday = new Date(Date.UTC(yearNum, month - 1, day));
    // If already passed this year, check next year
    if (nextBday.getTime() < today.getTime()) {
      nextBday = new Date(Date.UTC(yearNum + 1, month - 1, day));
    }

    const diffTime = nextBday.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= daysAhead) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formatted = `${day} ${monthNames[month - 1]}`;
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
        formatted_dob: formatted,
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

  // Check if already notified today
  const existing = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(settingKey) as any;
  if (existing) return;

  const birthdays = getTodayBirthdays();
  if (birthdays.length === 0) return;

  for (const b of birthdays) {
    // Notify all other employees
    notifyAll(
      `🎂 Happy Birthday, ${b.name}!`,
      `Today is ${b.name}'s birthday (${b.department} · ${b.designation}). Let's wish them a wonderful day! 🎉`,
      {
        type: "birthday",
        link: "/calendar",
      }
    );
  }

  // Mark as notified today
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(settingKey, "1");
}
