import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyMany, notifyUser } from "@/lib/notify";
import { dateKey } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const reminderType = body.type || "punch_in"; // 'punch_in' | 'punch_out' | 'test'
    const today = dateKey();

    if (reminderType === "test") {
      notifyUser(
        user.id,
        "⏰ Attendance Reminder Test",
        "This is a test notification for HRMate attendance punches. Notifications are working properly!",
        { type: "attendance", link: "/attendance" }
      );
      return NextResponse.json({ ok: true, sent: 1 });
    }

    // Find users who have NOT punched in today
    if (reminderType === "punch_in") {
      const activeUsers = db.prepare(`SELECT id, name FROM users WHERE active = 1`).all() as { id: string; name: string }[];
      const punchedToday = db.prepare(`SELECT user_id FROM attendance WHERE date = ? AND punch_in_at IS NOT NULL`).all(today) as { user_id: string }[];
      const punchedSet = new Set(punchedToday.map((p) => p.user_id));

      const unpunchedIds = activeUsers.filter((u) => !punchedSet.has(u.id)).map((u) => u.id);

      if (unpunchedIds.length > 0) {
        notifyMany(
          unpunchedIds,
          "⏰ Don't forget to Punch In!",
          "Good morning! Please record your attendance punch-in for today on HRMate.",
          { type: "attendance", link: "/attendance" }
        );
      }
      return NextResponse.json({ ok: true, sent: unpunchedIds.length });
    }

    // Find users who punched in but haven't punched out
    if (reminderType === "punch_out") {
      const punchedInOnly = db
        .prepare(
          `SELECT user_id FROM attendance
           WHERE date = ? AND punch_in_at IS NOT NULL AND punch_out_at IS NULL`
        )
        .all(today) as { user_id: string }[];

      const userIds = punchedInOnly.map((u) => u.user_id);

      if (userIds.length > 0) {
        notifyMany(
          userIds,
          "⏰ Shift End: Punch Out Reminder",
          "Your shift has ended for today. Remember to punch out on HRMate before leaving!",
          { type: "attendance", link: "/attendance" }
        );
      }
      return NextResponse.json({ ok: true, sent: userIds.length });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
