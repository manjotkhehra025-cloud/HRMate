import { requireUser, unauthorized, json } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const user = requireUser();
  if (!user) return unauthorized();
  return json({ ok: true });
}
