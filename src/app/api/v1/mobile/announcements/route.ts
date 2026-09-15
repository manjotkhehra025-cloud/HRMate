import { NextRequest } from 'next/server';
import { handle, ok, requireMobileUser } from '../../_lib/mobileAuth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/mobile/announcements (Bearer)
// → { ok:true, items:[{ id, title, body, at: ISO, pinned: boolean }] }
export const GET = handle(async (req: NextRequest) => {
  await requireMobileUser(req);

  try {
    const posts = db
      .prepare(`
        SELECT p.id, p.content, p.created_at, u.name AS author_name
        FROM wall_posts p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC
        LIMIT 20
      `)
      .all() as any[];

    const items = posts.map((p) => ({
      id: String(p.id),
      title: p.author_name ? `Post by ${p.author_name}` : 'Notice',
      body: String(p.content || ''),
      at: new Date(p.created_at).toISOString(),
      pinned: false,
    }));

    return ok({ items });
  } catch {
    return ok({ items: [] });
  }
});
