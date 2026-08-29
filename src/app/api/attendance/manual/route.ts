import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { notifyMany } from "@/lib/notify";
import { istTimestamp } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "attendance.manual")) {
    return error("You don't have permission to request manual punch", 403);
  }

  const body = await req.json();
  const date = body.date as string;
  const reason = (body.reason as string) || "";
  if (!date || !reason.trim()) {
    return error("Date and reason are required");
  }

  const punches: { type: "punch_in" | "punch_out"; time: string }[] = [];

  if (body.punch_in) punches.push({ type: "punch_in", time: body.punch_in });
  if (body.punch_out) punches.push({ type: "punch_out", time: body.punch_out });

  // Back-compat: single { type, time }
  if (punches.length === 0 && body.type && body.time) {
    if (body.type !== "punch_in" && body.type !== "punch_out") {
      return error("Type must be punch_in or punch_out");
    }
    punches.push({ type: body.type, time: body.time });
  }

  if (punches.length === 0) {
    return error("Enter a punch-in time, punch-out time, or both");
  }

  try {
    for (const p of punches) istTimestamp(date, p.time);
  } catch {
    return error("Invalid date or time");
  }

  if (body.punch_in && body.punch_out) {
    const inTs = istTimestamp(date, body.punch_in);
    const outTs = istTimestamp(date, body.punch_out);
    if (outTs <= inTs) {
      return error("Punch out time must be after punch in time");
    }
  }

  const insert = db.prepare(
    `INSERT INTO manual_punch_requests (id, user_id, date, type, time, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of punches) {
    insert.run(randomId("mp_"), user.id, date, p.type, p.time, reason.trim(), Date.now());
  }

  const approvers = db
    .prepare("SELECT id FROM users WHERE role IN ('super_admin','admin','manager') AND active = 1")
    .all() as { id: string }[];
  const summary = punches
    .map((p) => `${p.type === "punch_in" ? "in" : "out"} ${p.time}`)
    .join(", ");
  notifyMany(
    approvers.map((a) => a.id),
    "Manual punch request",
    `${user.name} requested manual punch ${summary} on ${date}`,
    { type: "approval", link: "/approvals" }
  );

  return json({ ok: true, count: punches.length });
}
