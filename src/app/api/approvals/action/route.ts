import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { applyApprovedManualPunch } from "@/lib/attendance";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "approvals.manage")) {
    return error("You don't have permission to manage approvals", 403);
  }

  const { kind, id, action, note } = await req.json();
  if (!kind || !id || !action || !["approve", "reject"].includes(action)) {
    return error("Invalid request");
  }

  const status = action === "approve" ? "approved" : "rejected";

  if (kind === "leave") {
    const row = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
    if (!row) return error("Leave request not found", 404);
    if (row.status !== "pending") return error("Already processed");

    db.prepare(
      "UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewed_note = ? WHERE id = ?"
    ).run(status, user.id, Date.now(), note || "", id);

    const lt = db.prepare("SELECT name FROM leave_types WHERE id = ?").get(row.leave_type_id) as any;
    notify(
      row.user_id,
      `Leave ${status}`,
      `Your ${lt.name} request (${row.start_date} to ${row.end_date}) was ${status}${note ? ` — "${note}"` : ""}`,
      { type: status === "approved" ? "success" : "error", link: "/leaves" }
    );
  } else if (kind === "manual") {
    const row = db.prepare("SELECT * FROM manual_punch_requests WHERE id = ?").get(id) as any;
    if (!row) return error("Manual punch request not found", 404);
    if (row.status !== "pending") return error("Already processed");

    if (status === "approved") {
      try {
        applyApprovedManualPunch(row);
      } catch (e: any) {
        return error(e?.message || "Failed to apply manual punch", 500);
      }
    }

    db.prepare(
      "UPDATE manual_punch_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewed_note = ? WHERE id = ?"
    ).run(status, user.id, Date.now(), note || "", id);

    notify(
      row.user_id,
      `Manual punch ${status}`,
      `Your manual ${row.type} request for ${row.date} was ${status}${note ? ` — "${note}"` : ""}`,
      { type: status === "approved" ? "success" : "error", link: "/attendance" }
    );
  } else {
    return error("Unknown kind");
  }

  return json({ ok: true });
}
