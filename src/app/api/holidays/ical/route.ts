import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const rows = db.prepare(`SELECT * FROM holidays ORDER BY date ASC`).all() as any[];

    // Build RFC 5545 iCalendar content
    let ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//HRMate//Factory Holidays & Festivals Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:HRMate Holidays & Festivals",
      "X-WR-TIMEZONE:Asia/Kolkata",
    ];

    for (const h of rows) {
      const dateNoHyphen = h.date.replace(/-/g, "");
      // Next day for all-day DTEND
      const nextDay = new Date(h.date + "T00:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split("T")[0].replace(/-/g, "");

      const statusTag = h.is_off ? "[OFF - Holiday]" : "[Festival / Working]";
      const summary = `${statusTag} ${h.title}`;
      const desc = h.description
        ? `${h.description}\\nStatus: ${h.is_off ? "Factory Closed / Paid Holiday" : "Working Day Celebration"}`
        : `Status: ${h.is_off ? "Factory Closed / Paid Holiday" : "Working Day Celebration"}`;

      ics.push("BEGIN:VEVENT");
      ics.push(`UID:${h.id}@hrmate.gdfoods`);
      ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
      ics.push(`DTSTART;VALUE=DATE:${dateNoHyphen}`);
      ics.push(`DTEND;VALUE=DATE:${nextDayStr}`);
      ics.push(`SUMMARY:${summary}`);
      ics.push(`DESCRIPTION:${desc}`);
      ics.push(`STATUS:CONFIRMED`);
      ics.push("END:VEVENT");
    }

    ics.push("END:VCALENDAR");

    const content = ics.join("\r\n");

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="hrmate-holidays.ics"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
