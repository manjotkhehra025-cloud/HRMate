import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json, dateKey } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { listApproverOptions } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const records = db
    .prepare(
      `SELECT o.*, u.name as approver_name
       FROM overtime_requests o
       LEFT JOIN users u ON u.id = o.approver_id
       WHERE o.user_id = ?
       ORDER BY o.date DESC`
    )
    .all(user.id) as any[];

  const currentMonth = dateKey().slice(0, 7);
  const totalOtHours = records
    .filter((r) => r.status === "approved" && r.date.startsWith(currentMonth))
    .reduce((sum, r) => sum + (r.hours || 0), 0);

  const approvers = listApproverOptions(user.id);

  return json({
    records,
    totalOtHours,
    approvers,
  });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { date, hours, reason, approver_id } = body;

  if (!date || !hours || !reason) {
    return error("Date, hours, and reason are required");
  }

  const numHours = parseFloat(hours);
  if (isNaN(numHours) || numHours <= 0 || numHours > 16) {
    return error("Overtime hours must be between 0.5 and 16 hours");
  }

  const id = randomId("ot_");
  db.prepare(
    `INSERT INTO overtime_requests (id, user_id, date, hours, reason, status, approver_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(id, user.id, date, numHours, reason.trim(), approver_id || null, Date.now());

  return json({ ok: true, id });
}
