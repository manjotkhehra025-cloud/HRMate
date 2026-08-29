import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const posts = db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.color AS author_color, u.designation AS author_designation,
        (SELECT COUNT(*) FROM wall_likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM wall_comments c WHERE c.post_id = p.id) AS comment_count,
        EXISTS(SELECT 1 FROM wall_likes l2 WHERE l2.post_id = p.id AND l2.user_id = ?) AS liked_by_me
       FROM wall_posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    )
    .all(user.id);

  const comments = db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.color AS author_color
       FROM wall_comments c JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at ASC`
    )
    .all();

  return json({ posts, comments });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "wall.post")) {
    return error("You don't have permission to post", 403);
  }

  const { content } = await req.json();
  if (!content || !content.trim()) return error("Post content is required");

  const id = randomId("p_");
  db.prepare(
    "INSERT INTO wall_posts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, user.id, content.trim(), Date.now());

  return json({ ok: true, id });
}
