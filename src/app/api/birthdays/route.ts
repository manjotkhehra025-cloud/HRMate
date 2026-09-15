import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTodayBirthdays, getUpcomingBirthdays, checkAndNotifyBirthdays } from "@/lib/birthdays";
import { notifyUser } from "@/lib/notify";
import { db } from "@/lib/db";
import { randomId } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Trigger daily birthday notification broadcast
    try {
      checkAndNotifyBirthdays();
    } catch (e) {
      console.error("Birthday notification error", e);
    }

    const todayBirthdays = getTodayBirthdays();
    const upcomingBirthdays = getUpcomingBirthdays(30);

    return NextResponse.json({
      ok: true,
      today: todayBirthdays,
      upcoming: upcomingBirthdays,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, message } = body;

    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: "Target User ID is required" }, { status: 400 });
    }

    const target = db.prepare(`SELECT name FROM users WHERE id = ?`).get(targetUserId) as { name: string } | undefined;
    if (!target) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const greeting = message ? message.trim() : `🎉 Wishing you a very Happy Birthday from ${user.name}! 🎂 Have a fantastic year ahead!`;

    // 1. Send direct in-app notification & push
    notifyUser(
      targetUserId,
      `🎂 Birthday Wish from ${user.name}!`,
      greeting,
      { type: "birthday", link: "/wall" }
    );

    // 2. Post celebration wish on Social Wall
    try {
      const postId = randomId("wp_");
      db.prepare(
        `INSERT INTO wall_posts (id, user_id, content, likes_count, comments_count, created_at)
         VALUES (?, ?, ?, 1, 0, ?)`
      ).run(
        postId,
        user.id,
        `🎉 Happy Birthday ${target.name}! 🎂🎈\n\n${greeting}`,
        Date.now()
      );
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
