import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { listShifts } from "@/lib/shifts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function guard() {
  const user = requireUser();
  if (!user) return { user: null, res: unauthorized() };
  if (!hasPermission(user.id, "admin.settings")) {
    return { user: null, res: error("You don't have permission to manage shifts", 403) };
  }
  return { user, res: null };
}

function normalize(body: any) {
  const name = String(body.name || "").trim();
  const start_time = String(body.start_time || "").trim();
  const hours = parseFloat(body.hours);
  const auto_pick =
    body.auto_pick === "morning" || body.auto_pick === "evening" ? body.auto_pick : "none";
  const sort = Number.isFinite(Number(body.sort)) ? Number(body.sort) : 0;
  if (!name) return { error: "Shift name is required" };
  if (!/^\d{2}:\d{2}$/.test(start_time)) return { error: "Start time must be HH:MM" };
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return { error: "Hours must be between 1 and 24" };
  }
  return { name, start_time, hours, auto_pick, sort };
}

export async function GET() {
  const g = guard();
  if (g.res) return g.res;
  return json({ shifts: listShifts() });
}

export async function POST(req: NextRequest) {
  const g = guard();
  if (g.res) return g.res;
  const parsed = normalize(await req.json());
  if (!("name" in parsed)) return error((parsed as { error: string }).error);
  const id = randomId("sh_");
  const max = db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM shifts").get() as { m: number };
  db.prepare(
    `INSERT INTO shifts (id, name, start_time, hours, auto_pick, sort) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, parsed.name, parsed.start_time, parsed.hours, parsed.auto_pick, parsed.sort || max.m + 1);
  return json({ ok: true, shifts: listShifts() });
}

export async function PUT(req: NextRequest) {
  const g = guard();
  if (g.res) return g.res;
  const body = await req.json();
  if (!body.id) return error("Shift id is required");
  const existing = db.prepare("SELECT id FROM shifts WHERE id = ?").get(body.id);
  if (!existing) return error("Shift not found", 404);
  const parsed = normalize(body);
  if (!("name" in parsed)) return error((parsed as any).error);
  db.prepare(
    `UPDATE shifts SET name = ?, start_time = ?, hours = ?, auto_pick = ?, sort = ? WHERE id = ?`
  ).run(parsed.name, parsed.start_time, parsed.hours, parsed.auto_pick, parsed.sort, body.id);
  return json({ ok: true, shifts: listShifts() });
}

export async function DELETE(req: NextRequest) {
  const g = guard();
  if (g.res) return g.res;
  const { id } = await req.json();
  if (!id) return error("Shift id is required");
  db.prepare("DELETE FROM shifts WHERE id = ?").run(id);
  return json({ ok: true, shifts: listShifts() });
}
