import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { notify } from "@/lib/notify";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = requireUser();
  if (!user) return unauthorized();

  const { content } = await req.json();
  if (!content || !content.trim()) return error("Comment is required");

  const post = db.prepare("SELECT * FROM wall_posts WHERE id = ?").get(params.id) as any;
  if (!post) return error("Post not found", 404);

  const id = randomId("c_");
  db.prepare(
    "INSERT INTO wall_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, params.id, user.id, content.trim(), Date.now());

  if (post.user_id !== user.id) {
    notify(
      post.user_id,
      "New comment",
      `${user.name} commented on your post`,
      { type: "info", link: "/wall" }
    );
  }

  return json({ ok: true, id });
}
