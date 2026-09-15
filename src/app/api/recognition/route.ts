import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { notifyAll } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const awards = db
      .prepare(
        `SELECT a.*, u.name as user_name, u.department, u.designation, u.color, u.avatar,
                admin.name as awarded_by_name
         FROM worker_awards a
         JOIN users u ON a.user_id = u.id
         JOIN users admin ON a.awarded_by = admin.id
         ORDER BY a.created_at DESC`
      )
      .all() as any[];

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    const users = db.prepare(`SELECT id, name, department, designation, color, avatar FROM users WHERE active = 1 ORDER BY name ASC`).all() as any[];

    return NextResponse.json({ ok: true, awards, users, isAdmin });
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

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Only Admins can award recognition" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, award_type, period, title, citation } = body;

    if (!userId || !award_type || !title || !citation) {
      return NextResponse.json({ ok: false, error: "All fields are required" }, { status: 400 });
    }

    const id = randomId("awd_");
    const now = Date.now();
    const awardPeriod = period || "September 2026";

    db.prepare(
      `INSERT INTO worker_awards (id, user_id, award_type, period, title, citation, awarded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      award_type,
      awardPeriod,
      title.trim(),
      citation.trim(),
      user.id,
      now
    );

    const awardee = db.prepare(`SELECT name, department FROM users WHERE id = ?`).get(userId) as any;

    // Broadcast celebration to all employees & post on social wall
    if (awardee) {
      notifyAll(
        `🌟 Congratulations ${awardee.name}!`,
        `${awardee.name} (${awardee.department}) has been recognized as "${title}" for ${awardPeriod}! 🏆`,
        { type: "award", link: "/recognition" }
      );

      try {
        const postId = randomId("wp_");
        db.prepare(
          `INSERT INTO wall_posts (id, user_id, content, likes_count, comments_count, created_at)
           VALUES (?, ?, ?, 5, 0, ?)`
        ).run(
          postId,
          user.id,
          `🏆 WORKER RECOGNITION AWARD 🌟\n\nCongratulations to **${awardee.name}** (${awardee.department}) for being awarded **${title}** for ${awardPeriod}!\n\n"${citation}"\n\n👏 Let's celebrate their outstanding contribution to GD Foods!`,
          now
        );
      } catch {}
    }

    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
