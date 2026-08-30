import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { applyChangeRequest, submitChange } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function guard() {
  const user = requireUser();
  if (!user) return { user: null as any, res: unauthorized() };
  if (!hasPermission(user.id, "admin.settings") && !hasPermission(user.id, "leaves.adjust")) {
    return { user: null as any, res: error("You don't have permission to manage leave types", 403) };
  }
  return { user, res: null };
}

function list() {
  return db.prepare("SELECT * FROM leave_types ORDER BY sort").all();
}

export async function GET() {
  const g = guard();
  if (g.res) return g.res;
  return json({ leaveTypes: list() });
}

export async function POST(req: NextRequest) {
  const g = guard();
  if (g.res) return g.res;
  const body = await req.json();
  const name = String(body.name || "").trim();
  const days = parseInt(body.days_per_year, 10);
  const color = String(body.color || "#1E6FE0");
  if (!name) return error("Leave type name is required");
  if (!Number.isFinite(days) || days < 0 || days > 365) {
    return error("Days per year must be 0–365");
  }
  const payload = { action: "create", name, days_per_year: days, color };
  if (g.user.role !== "super_admin") {
    submitChange("leave_type", payload, g.user.id);
    return json({ ok: true, pending: true, leaveTypes: list() });
  }
  applyChangeRequest("leave_type", payload);
  return json({ ok: true, leaveTypes: list() });
}

export async function PUT(req: NextRequest) {
  const g = guard();
  if (g.res) return g.res;
  const body = await req.json();
  if (!body.id) return error("Leave type id is required");
  const existing = db.prepare("SELECT * FROM leave_types WHERE id = ?").get(body.id) as any;
  if (!existing) return error("Leave type not found", 404);
  const name = String(body.name ?? existing.name).trim();
  const days = Number.isFinite(Number(body.days_per_year))
    ? parseInt(body.days_per_year, 10)
    : existing.days_per_year;
  const color = String(body.color ?? existing.color);
  if (!name) return error("Leave type name is required");
  if (days < 0 || days > 365) return error("Days per year must be 0–365");
  const payload = { action: "update", id: body.id, name, days_per_year: days, color };
  if (g.user.role !== "super_admin") {
    submitChange("leave_type", payload, g.user.id);
    return json({ ok: true, pending: true, leaveTypes: list() });
  }
  applyChangeRequest("leave_type", payload);
  return json({ ok: true, leaveTypes: list() });
}

export async function DELETE(req: NextRequest) {
  const g = guard();
  if (g.res) return g.res;
  const { id } = await req.json();
  if (!id) return error("Leave type id is required");
  const used = db
    .prepare("SELECT COUNT(*) AS c FROM leave_requests WHERE leave_type_id = ?")
    .get(id) as { c: number };
  if (used.c > 0) {
    return error("This leave type has requests — you can set days to 0 instead of deleting it");
  }
  if (g.user.role !== "super_admin") {
    submitChange("leave_type", { action: "delete", id }, g.user.id);
    return json({ ok: true, pending: true, leaveTypes: list() });
  }
  db.prepare("DELETE FROM leave_types WHERE id = ?").run(id);
  return json({ ok: true, leaveTypes: list() });
}
