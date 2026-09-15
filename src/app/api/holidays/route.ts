import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { randomId } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const upcomingOnly = searchParams.get("upcoming") === "1";
    const type = searchParams.get("type"); // 'public_holiday' | 'festival_observance' | 'all'

    let query = `SELECT * FROM holidays WHERE 1=1`;
    const params: any[] = [];

    if (year) {
      query += ` AND strftime('%Y', date) = ?`;
      params.push(year);
    }

    if (type && type !== "all") {
      if (type === "off") {
        query += ` AND is_off = 1`;
      } else if (type === "festival") {
        query += ` AND is_off = 0`;
      } else {
        query += ` AND type = ?`;
        params.push(type);
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];

    if (upcomingOnly) {
      query += ` AND date >= ?`;
      params.push(todayStr);
    }

    query += ` ORDER BY date ASC`;

    const rows = db.prepare(query).all(...params) as any[];

    // Calculate days remaining and day name for each event
    const enriched = rows.map((h) => {
      const eventDate = new Date(h.date + "T00:00:00");
      const today = new Date(todayStr + "T00:00:00");
      const diffTime = eventDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = dayNames[eventDate.getDay()];

      return {
        ...h,
        days_left: diffDays,
        is_past: diffDays < 0,
        is_today: diffDays === 0,
        day_of_week: dayOfWeek,
      };
    });

    return NextResponse.json({ ok: true, holidays: enriched });
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

    const canManage = user.role === "super_admin" || hasPermission(user.id, "leaves.manage" as any) || user.role === "admin";
    if (!canManage) {
      return NextResponse.json({ ok: false, error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { title, date, type, is_off, description, color } = body;

    if (!title || !date) {
      return NextResponse.json({ ok: false, error: "Title and Date are required" }, { status: 400 });
    }

    const id = randomId("hol_");
    const now = Date.now();

    db.prepare(
      `INSERT INTO holidays (id, title, date, type, is_off, description, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      title.trim(),
      date.trim(),
      type || (is_off ? "public_holiday" : "festival_observance"),
      is_off ? 1 : 0,
      description ? description.trim() : "",
      color || (is_off ? "#EF4444" : "#10B981"),
      now
    );

    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const canManage = user.role === "super_admin" || hasPermission(user.id, "leaves.manage" as any) || user.role === "admin";
    if (!canManage) {
      return NextResponse.json({ ok: false, error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, date, type, is_off, description, color } = body;

    if (!id || !title || !date) {
      return NextResponse.json({ ok: false, error: "ID, Title, and Date are required" }, { status: 400 });
    }

    db.prepare(
      `UPDATE holidays
       SET title = ?, date = ?, type = ?, is_off = ?, description = ?, color = ?
       WHERE id = ?`
    ).run(
      title.trim(),
      date.trim(),
      type || (is_off ? "public_holiday" : "festival_observance"),
      is_off ? 1 : 0,
      description ? description.trim() : "",
      color || (is_off ? "#EF4444" : "#10B981"),
      id
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const canManage = user.role === "super_admin" || hasPermission(user.id, "leaves.manage" as any) || user.role === "admin";
    if (!canManage) {
      return NextResponse.json({ ok: false, error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Holiday ID is required" }, { status: 400 });
    }

    db.prepare(`DELETE FROM holidays WHERE id = ?`).run(id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
