import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getTodayBirthdays, getUpcomingBirthdays } from "@/lib/birthdays";

export const dynamic = "force-dynamic";

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: "holiday_off" | "festival_working" | "birthday";
  is_off: boolean;
  description?: string;
  color: string;
  avatar?: string;
  department?: string;
  designation?: string;
  days_left: number;
  is_today: boolean;
  day_of_week: string;
}

export async function GET(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get("year") || String(new Date().getFullYear());
    const monthStr = searchParams.get("month"); // 1 - 12 (optional)

    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date(todayStr + "T00:00:00");
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const events: UnifiedCalendarEvent[] = [];

    // 1. Fetch Holidays & Festivals from db
    let holQuery = `SELECT * FROM holidays WHERE strftime('%Y', date) = ?`;
    const holParams: any[] = [yearStr];
    if (monthStr) {
      const padMonth = String(monthStr).padStart(2, "0");
      holQuery += ` AND strftime('%m', date) = ?`;
      holParams.push(padMonth);
    }
    holQuery += ` ORDER BY date ASC`;

    const holidays = db.prepare(holQuery).all(...holParams) as any[];

    for (const h of holidays) {
      const eventDate = new Date(h.date + "T00:00:00");
      const diffTime = eventDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      events.push({
        id: h.id,
        title: h.title,
        date: h.date,
        category: h.is_off ? "holiday_off" : "festival_working",
        is_off: !!h.is_off,
        description: h.description || "",
        color: h.color || (h.is_off ? "#EF4444" : "#10B981"),
        days_left: diffDays,
        is_today: diffDays === 0,
        day_of_week: dayNames[eventDate.getDay()],
      });
    }

    // 2. Fetch Employee Birthdays for the requested year & month
    const usersWithDob = db
      .prepare(
        `SELECT id, name, email, department, designation, color, avatar, dob
         FROM users
         WHERE active = 1 AND dob IS NOT NULL AND dob != ''`
      )
      .all() as any[];

    const yearNum = parseInt(yearStr, 10);

    for (const u of usersWithDob) {
      const dobParts = u.dob.trim().split("-");
      let m = 0;
      let d = 0;
      if (dobParts.length === 3) {
        m = parseInt(dobParts[1], 10);
        d = parseInt(dobParts[2], 10);
      } else if (dobParts.length === 2) {
        m = parseInt(dobParts[0], 10);
        d = parseInt(dobParts[1], 10);
      }

      if (!m || !d) continue;

      if (monthStr && m !== parseInt(monthStr, 10)) continue;

      const eventDateStr = `${yearNum}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const eventDate = new Date(eventDateStr + "T00:00:00");
      const diffTime = eventDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      events.push({
        id: `bday_${u.id}_${yearNum}`,
        title: `🎂 ${u.name}'s Birthday`,
        date: eventDateStr,
        category: "birthday",
        is_off: false,
        description: `${u.department} · ${u.designation}`,
        color: "#EC4899",
        avatar: u.avatar,
        department: u.department,
        designation: u.designation,
        days_left: diffDays,
        is_today: diffDays === 0,
        day_of_week: dayNames[eventDate.getDay()],
      });
    }

    // Sort all events chronologically
    events.sort((a, b) => a.date.localeCompare(b.date));

    const todayBirthdays = getTodayBirthdays();
    const upcomingBirthdays = getUpcomingBirthdays(30);

    return NextResponse.json({
      ok: true,
      events,
      todayBirthdays,
      upcomingBirthdays,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
