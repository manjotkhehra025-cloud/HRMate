import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, json } from "@/lib/api";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const notifications = db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(user.id);
  const unread = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { c: number };

  return json({ notifications, unread: unread.c });
}

export async function POST() {
  const user = requireUser();
  if (!user) return unauthorized();
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  return json({ ok: true });
}
