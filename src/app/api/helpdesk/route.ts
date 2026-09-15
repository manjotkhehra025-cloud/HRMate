import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { notifyAll, notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.role === "super_admin" || user.role === "admin";

    let query = `
      SELECT t.*,
             CASE WHEN t.is_anonymous = 1 THEN 'Anonymous Staff Member' ELSE u.name END as author_name,
             CASE WHEN t.is_anonymous = 1 THEN 'Confidential' ELSE u.department END as author_dept,
             CASE WHEN t.is_anonymous = 1 THEN '' ELSE u.avatar END as author_avatar
      FROM helpdesk_tickets t
      JOIN users u ON t.user_id = u.id
    `;
    const params: any[] = [];

    if (!isAdmin) {
      query += ` WHERE t.user_id = ?`;
      params.push(user.id);
    }
    query += ` ORDER BY t.created_at DESC`;

    const tickets = db.prepare(query).all(...params) as any[];

    return NextResponse.json({ ok: true, tickets, isAdmin });
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
    const { title, description, category, priority, is_anonymous } = body;

    if (!title || !description || !category) {
      return NextResponse.json({ ok: false, error: "Title, Category and Description are required" }, { status: 400 });
    }

    const id = randomId("tkt_");
    const now = Date.now();

    db.prepare(
      `INSERT INTO helpdesk_tickets 
       (id, user_id, is_anonymous, category, title, description, priority, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      id,
      user.id,
      is_anonymous ? 1 : 0,
      category,
      title.trim(),
      description.trim(),
      priority || "medium",
      now
    );

    // Notify Super Admin of new ticket
    const admins = db.prepare(`SELECT id FROM users WHERE role = 'super_admin' OR role = 'admin'`).all() as any[];
    for (const a of admins) {
      notifyUser(
        a.id,
        `🛠️ New Helpdesk Ticket: ${title}`,
        `${is_anonymous ? "An employee (Anonymous)" : user.name} submitted a ${priority || "medium"} priority ticket in ${category}.`,
        { type: "helpdesk", link: "/helpdesk" }
      );
    }

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

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Only Admins can resolve tickets" }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, resolution_note } = body;

    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "Ticket ID and status required" }, { status: 400 });
    }

    const now = Date.now();
    db.prepare(
      `UPDATE helpdesk_tickets 
       SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ?
       WHERE id = ?`
    ).run(
      status,
      resolution_note ? resolution_note.trim() : "",
      user.id,
      now,
      id
    );

    const ticket = db.prepare(`SELECT * FROM helpdesk_tickets WHERE id = ?`).get(id) as any;
    if (ticket && !ticket.is_anonymous) {
      notifyUser(
        ticket.user_id,
        `Ticket ${status.toUpperCase()}: ${ticket.title}`,
        resolution_note ? `Note: ${resolution_note}` : "Your helpdesk ticket status has been updated.",
        { type: "helpdesk", link: "/helpdesk" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
