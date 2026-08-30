import { NextRequest } from "next/server";
import db from "@/lib/db";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { applyApprovedManualPunch } from "@/lib/attendance";
import { applyChangeRequest, canActOnManual, notifyPunchApprovers } from "@/lib/workflow";

export async function POST(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "approvals.manage") && user.role !== "super_admin") {
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
    if (
      !canActOnLeave({ id: user.id, role: user.role, manager_scope: user.manager_scope }, row) &&
      user.role !== "super_admin"
    ) {
      return error("You can't act on this leave request", 403);
    }

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
    const actor = {
      id: user.id,
      role: user.role,
      manager_scope: user.manager_scope,
    };
    if (!canActOnManual(actor, row) && user.role !== "super_admin") {
      return error("You can't act on this request", 403);
    }

    const stage = row.stage || "final";
    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id) as any;

    if (action === "approve" && stage === "manager" && user.role !== "super_admin") {
      db.prepare(
        "UPDATE manual_punch_requests SET stage = 'final', reviewed_note = ? WHERE id = ?"
      ).run(`Manager ${user.name} approved. Waiting for Super Admin.`, id);
      notifyPunchApprovers(
        { id: target.id, name: target.name, department: target.department, staff_type: target.staff_type },
        `${row.type === "punch_in" ? "in" : "out"} ${row.time}`,
        row.date,
        "final"
      );
      notify(
        row.user_id,
        "Manager approved punch",
        `Your manual ${row.type} for ${row.date} was sent to Super Admin`,
        { type: "info", link: "/attendance" }
      );
      return json({ ok: true, forwarded: true });
    }

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
  } else if (kind === "change") {
    if (user.role !== "super_admin") return error("Only Super Admin can approve these changes", 403);
    const row = db.prepare("SELECT * FROM change_requests WHERE id = ?").get(id) as any;
    if (!row) return error("Change request not found", 404);
    if (row.status !== "pending") return error("Already processed");
    if (status === "approved") {
      try {
        applyChangeRequest(row.kind, JSON.parse(row.payload));
      } catch (e: any) {
        return error(e?.message || "Failed to apply change", 500);
      }
    }
    db.prepare(
      "UPDATE change_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewed_note = ? WHERE id = ?"
    ).run(status, user.id, Date.now(), note || "", id);
    notify(
      row.requested_by,
      `Change ${status}`,
      `Your ${row.kind.replace("_", " ")} request was ${status}`,
      { type: status === "approved" ? "success" : "error", link: "/settings" }
    );
  } else {
    return error("Unknown kind");
  }

  return json({ ok: true });
}
