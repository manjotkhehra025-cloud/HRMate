import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { istTimestamp } from "@/lib/attendance";
import { getApprover, notifyPunchApprovers, punchStageForUser } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "attendance.manual")) {
    return error("You don't have permission to request manual punch", 403);
  }

  const body = await req.json();
  const reason = (body.reason as string) || "";
  if (!reason.trim()) {
    return error("Reason is required");
  }

  const punches: { type: "punch_in" | "punch_out"; time: string; date: string }[] = [];
  const inDate = String(body.punch_in_date || body.date || "");
  const outDate = String(body.punch_out_date || body.date || "");

  if (body.punch_in) punches.push({ type: "punch_in", time: body.punch_in, date: inDate });
  if (body.punch_out) punches.push({ type: "punch_out", time: body.punch_out, date: outDate });

  // Back-compat: single { type, time }
  if (punches.length === 0 && body.type && body.time) {
    if (body.type !== "punch_in" && body.type !== "punch_out") {
      return error("Type must be punch_in or punch_out");
    }
    punches.push({ type: body.type, time: body.time, date: String(body.date || "") });
  }

  if (punches.length === 0) {
    return error("Enter a punch-in time, punch-out time, or both");
  }
  if (punches.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.date))) {
    return error("Pick a date for each punch");
  }

  try {
    for (const p of punches) istTimestamp(p.date, p.time);
  } catch {
    return error("Invalid date or time");
  }

  if (body.punch_in && body.punch_out) {
    const inTs = istTimestamp(inDate, body.punch_in);
    const outTs = istTimestamp(outDate, body.punch_out);
    if (outTs <= inTs) {
      return error("Punch out must be after punch in (next day is allowed for 24-hour shifts)");
    }
  }

  const approver = getApprover(String(body.approver_id || ""), user.id);
  if (!approver) return error("Pick who should approve this request");

  const stage = approver.role === "super_admin" ? "final" : punchStageForUser(user.id);
  const insert = db.prepare(
    `INSERT INTO manual_punch_requests (id, user_id, date, type, time, reason, created_at, stage, approver_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of punches) {
    insert.run(randomId("mp_"), user.id, p.date, p.type, p.time, reason.trim(), Date.now(), stage, approver.id);
  }

  const summary = punches
    .map((p) => `${p.type === "punch_in" ? "in" : "out"} ${p.date} ${p.time}`)
    .join(", ");
  notifyPunchApprovers(
    { id: user.id, name: user.name, department: user.department, staff_type: user.staff_type },
    summary,
    punches[0].date,
    stage,
    approver.id
  );

  return json({ ok: true, count: punches.length, stage, approver_name: approver.name });
}
