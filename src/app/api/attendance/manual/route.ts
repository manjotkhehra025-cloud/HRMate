import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { notifyMany } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "attendance.manual")) {
    return error("You don't have permission to request manual punch", 403);
  }

  const { date, type, time, reason } = await req.json();
  if (!date || !type || !time || !reason) {
    return error("Date, type, time and reason are required");
  }

  db.prepare(
    `INSERT INTO manual_punch_requests (id, user_id, date, type, time, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(randomId("mp_"), user.id, date, type, time, reason, Date.now());

  // Notify approvers
  const approvers = db
    .prepare("SELECT id FROM users WHERE role IN ('super_admin','admin','manager') AND active = 1")
    .all() as { id: string }[];
  notifyMany(
    approvers.map((a) => a.id),
    "Manual punch request",
    `${user.name} requested a manual ${type} on ${date}`,
    { type: "approval", link: "/approvals" }
  );

  return json({ ok: true });
}
