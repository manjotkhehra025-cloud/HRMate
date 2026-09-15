import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate"); // YYYY-MM-DD
    const endDate = searchParams.get("endDate");     // YYYY-MM-DD
    const department = searchParams.get("department");

    let query = `
      SELECT sr.*, u.name as user_name, u.department, u.designation, u.color, u.avatar,
             s.name as shift_name, s.start_time, s.hours
      FROM shift_rosters sr
      JOIN users u ON sr.user_id = u.id
      JOIN shifts s ON sr.shift_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ` AND sr.date >= ? AND sr.date <= ?`;
      params.push(startDate, endDate);
    }
    if (department && department !== "all") {
      query += ` AND u.department = ?`;
      params.push(department);
    }

    query += ` ORDER BY sr.date ASC, u.name ASC`;

    const rosters = db.prepare(query).all(...params) as any[];
    const shifts = db.prepare(`SELECT * FROM shifts ORDER BY sort ASC`).all() as any[];
    const users = db.prepare(`SELECT id, name, department, designation, color, avatar, shift_id FROM users WHERE active = 1 ORDER BY name ASC`).all() as any[];

    return NextResponse.json({
      ok: true,
      rosters,
      shifts,
      users,
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

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Only Admins/Supervisors can assign shift rosters" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, shiftId, date } = body;

    if (!userId || !shiftId || !date) {
      return NextResponse.json({ ok: false, error: "Missing required parameters" }, { status: 400 });
    }

    const id = randomId("rst_");
    const now = Date.now();

    db.prepare(
      `INSERT INTO shift_rosters (id, user_id, shift_id, date, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET shift_id = excluded.shift_id`
    ).run(id, userId, shiftId, date, user.id, now);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
