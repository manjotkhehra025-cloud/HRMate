import { NextRequest } from "next/server";
import { requireUser, unauthorized, json } from "@/lib/api";
import { getUserPrefs, setUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();
  return json({ prefs: getUserPrefs(user.id) });
}

export async function PUT(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  const body = await req.json();
  const prefs = setUserPrefs(user.id, {
    language: body.language,
    appearance: body.appearance,
    text_size: body.text_size,
    notify_enabled:
      body.notify_enabled === undefined ? undefined : body.notify_enabled ? 1 : 0,
  });
  return json({ ok: true, prefs });
}
