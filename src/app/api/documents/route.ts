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
    const targetUserId = searchParams.get("userId") || user.id;

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    if (!isAdmin && targetUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const docs = db
      .prepare(
        `SELECT d.*, u.name as user_name
         FROM employee_documents d
         JOIN users u ON d.user_id = u.id
         WHERE d.user_id = ?
         ORDER BY d.created_at DESC`
      )
      .all(targetUserId) as any[];

    const profile = db.prepare(`SELECT * FROM users WHERE id = ?`).get(targetUserId) as any;

    return NextResponse.json({ ok: true, docs, profile, isAdmin });
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
    const { title, doc_type, doc_number, file_url, targetUserId } = body;

    const uid = targetUserId && (user.role === "super_admin" || user.role === "admin") ? targetUserId : user.id;

    if (!title || !doc_type) {
      return NextResponse.json({ ok: false, error: "Title and Document Type are required" }, { status: 400 });
    }

    const id = randomId("doc_");
    const now = Date.now();

    db.prepare(
      `INSERT INTO employee_documents 
       (id, user_id, title, doc_type, doc_number, file_url, uploaded_by, verified, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      id,
      uid,
      title.trim(),
      doc_type,
      doc_number ? doc_number.trim() : "",
      file_url || "",
      user.id,
      now
    );

    return NextResponse.json({ ok: true, id });
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "ID is required" }, { status: 400 });

    const doc = db.prepare(`SELECT * FROM employee_documents WHERE id = ?`).get(id) as any;
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    if (!isAdmin && doc.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    db.prepare(`DELETE FROM employee_documents WHERE id = ?`).run(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
