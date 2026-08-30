import db from "./db";
import { departmentScope, type ManagerScope } from "./staff";
import { notify, notifyMany } from "./notify";
import { randomId } from "./crypto";

export function superAdminIds(): string[] {
  return (
    db
      .prepare("SELECT id FROM users WHERE role = 'super_admin' AND active = 1")
      .all() as { id: string }[]
  ).map((r) => r.id);
}

export function managersForScope(scope: ManagerScope): string[] {
  if (!scope) return [];
  return (
    db
      .prepare(
        `SELECT id FROM users WHERE role = 'manager' AND active = 1 AND manager_scope = ?`
      )
      .all(scope) as { id: string }[]
  ).map((r) => r.id);
}

export function punchStageForUser(userId: string): "manager" | "final" {
  const u = db
    .prepare("SELECT staff_type, department FROM users WHERE id = ?")
    .get(userId) as { staff_type: string; department: string } | undefined;
  if (u?.staff_type === "yellow_card") return "manager";
  return "final";
}

export function notifyPunchApprovers(requester: {
  id: string;
  name: string;
  department: string;
  staff_type?: string;
}, summary: string, date: string, stage: string) {
  if (stage === "manager") {
    const scope = departmentScope(requester.department);
    const ids = managersForScope(scope);
    if (ids.length === 0) {
      notifyMany(superAdminIds(), "Manual punch (no manager)", `${requester.name}: ${summary} on ${date}`, {
        type: "approval",
        link: "/approvals",
      });
      return;
    }
    notifyMany(ids, "Yellow card punch", `${requester.name} needs your approval — ${summary} on ${date}`, {
      type: "approval",
      link: "/approvals",
    });
    return;
  }
  notifyMany(superAdminIds(), "Manual punch — Super Admin", `${requester.name}: ${summary} on ${date}`, {
    type: "approval",
    link: "/approvals",
  });
}

export function canActOnManual(
  actor: { id: string; role: string; manager_scope?: string },
  row: { user_id: string; status: string; stage?: string }
): boolean {
  if (row.status !== "pending") return false;
  const target = db
    .prepare("SELECT staff_type, department FROM users WHERE id = ?")
    .get(row.user_id) as { staff_type: string; department: string } | undefined;
  const stage = row.stage || "final";
  if (actor.role === "super_admin") return true;
  if (target?.staff_type === "yellow_card") {
    if (stage === "manager") {
      return actor.role === "manager" && actor.manager_scope === departmentScope(target.department);
    }
    // pending_admin stage
    return false;
  }
  // official staff — admin or super admin (managers of yellow-card scopes do not approve official)
  return actor.role === "admin" || actor.role === "super_admin";
}

export function applyChangeRequest(payloadKind: string, payload: any) {
  if (payloadKind === "leave_type") {
    if (payload.action === "create") {
      const max = db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM leave_types").get() as {
        m: number;
      };
      db.prepare(
        `INSERT INTO leave_types (id, name, days_per_year, color, sort) VALUES (?, ?, ?, ?, ?)`
      ).run(randomId("lt_"), payload.name, payload.days_per_year, payload.color || "#1E6FE0", max.m + 1);
    } else if (payload.action === "update") {
      db.prepare("UPDATE leave_types SET name = ?, days_per_year = ?, color = ? WHERE id = ?").run(
        payload.name,
        payload.days_per_year,
        payload.color,
        payload.id
      );
    } else if (payload.action === "delete") {
      db.prepare("DELETE FROM leave_types WHERE id = ?").run(payload.id);
    }
  } else if (payloadKind === "leave_balance") {
    const existing = db
      .prepare("SELECT extra_days FROM leave_balances WHERE user_id = ? AND leave_type_id = ?")
      .get(payload.user_id, payload.leave_type_id) as { extra_days: number } | undefined;
    const next = (existing?.extra_days || 0) + Number(payload.delta || 0);
    db.prepare(
      `INSERT INTO leave_balances (user_id, leave_type_id, extra_days) VALUES (?, ?, ?)
       ON CONFLICT(user_id, leave_type_id) DO UPDATE SET extra_days = excluded.extra_days`
    ).run(payload.user_id, payload.leave_type_id, next);
  }
}

export function submitChange(kind: string, payload: unknown, requestedBy: string) {
  const id = randomId("cr_");
  db.prepare(
    `INSERT INTO change_requests (id, kind, payload, status, requested_by, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`
  ).run(id, kind, JSON.stringify(payload), requestedBy, Date.now());
  const requester = db.prepare("SELECT name FROM users WHERE id = ?").get(requestedBy) as {
    name: string;
  };
  notifyMany(
    superAdminIds(),
    "Change needs approval",
    `${requester?.name || "Admin"} submitted a ${kind.replace("_", " ")} change`,
    { type: "approval", link: "/approvals" }
  );
  return id;
}

export { notify };
