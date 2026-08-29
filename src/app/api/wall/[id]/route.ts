import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = requireUser();
  if (!user) return unauthorized();

  const post = db.prepare("SELECT * FROM wall_posts WHERE id = ?").get(params.id) as any;
  if (!post) return error("Post not found", 404);

  const isOwner = post.user_id === user.id;
  const canModerate = hasPermission(user.id, "wall.moderate");
  if (!isOwner && !canModerate) {
    return error("You can't delete this post", 403);
  }

  db.prepare("DELETE FROM wall_likes WHERE post_id = ?").run(params.id);
  db.prepare("DELETE FROM wall_comments WHERE post_id = ?").run(params.id);
  db.prepare("DELETE FROM wall_posts WHERE id = ?").run(params.id);

  return json({ ok: true });
}
