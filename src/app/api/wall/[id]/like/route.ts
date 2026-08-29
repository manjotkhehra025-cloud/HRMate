import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, json } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = requireUser();
  if (!user) return unauthorized();

  const existing = db
    .prepare("SELECT 1 FROM wall_likes WHERE post_id = ? AND user_id = ?")
    .get(params.id, user.id);

  if (existing) {
    db.prepare("DELETE FROM wall_likes WHERE post_id = ? AND user_id = ?").run(
      params.id,
      user.id
    );
  } else {
    db.prepare("INSERT INTO wall_likes (post_id, user_id) VALUES (?, ?)").run(
      params.id,
      user.id
    );
  }

  const count = db
    .prepare("SELECT COUNT(*) AS c FROM wall_likes WHERE post_id = ?")
    .get(params.id) as { c: number };

  return json({ liked: !existing, count: count.c });
}
