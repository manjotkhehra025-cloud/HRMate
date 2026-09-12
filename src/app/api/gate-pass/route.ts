import { NextRequest } from "next/server";
import db from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { listApproverOptions } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = requireUser();
  if (!user) return unauthorized();

  const passes = db
    .prepare(
      `SELECT g.*, u.name as approver_name
       FROM gate_passes g
       LEFT JOIN users u ON u.id = g.approver_id
       WHERE g.user_id = ?
       ORDER BY g.date DESC, g.created_at DESC`
    )
    .all(user.id) as any[];

  const approvers = listApproverOptions(user.id);

  return json({
    passes,
    approvers,
  });
}

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { date, type, time_out, time_in, reason, approver_id } = body;

  if (!date || !time_out || !reason) {
    return error("Date, Exit Time, and Reason are required");
  }

  const id = randomId("gp_");
  db.prepare(
    `INSERT INTO gate_passes (id, user_id, date, type, time_out, time_in, reason, status, approver_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    id,
    user.id,
    date,
    type || "duty",
    time_out,
    time_in || "End of Day",
    reason.trim(),
    approver_id || null,
    Date.now()
  );

  return json({ ok: true, id });
}
