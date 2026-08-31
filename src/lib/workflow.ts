import db from "./db";
import {
  departmentScope,
  isApproverDesignation,
  isLeadershipRole,
  type ManagerScope,
} from "./staff";
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

export type ApproverOption = { id: string; name: string; label: string; role: string };

export function approverLabel(u: {
  name: string;
  role: string;
  designation?: string;
  manager_scope?: string;
}) {
  if (isApproverDesignation(u.designation)) {
    const d = (u.designation || "").trim();
    if (/agm/i.test(d) && !/assistant/i.test(d)) return `${u.name} — Assistant General Manager`;
    return `${u.name} — ${d}`;
  }
  if (u.role === "super_admin") return `${u.name} — Super Admin`;
  return `${u.name} — ${u.designation || "Manager"}`;
}

type ApproverRow = {
  id: string;
  name: string;
  role: string;
  designation: string;
  manager_scope: string;
  active?: number;
};

function loadActivePeople(excludeUserId?: string): ApproverRow[] {
  return db
    .prepare(
      `SELECT id, name, role, designation, manager_scope, active
       FROM users WHERE active = 1 ${excludeUserId ? "AND id != ?" : ""}
       ORDER BY name`
    )
    .all(...(excludeUserId ? [excludeUserId] : [])) as ApproverRow[];
}

function designatedApprovers(excludeUserId: string): ApproverRow[] {
  return loadActivePeople(excludeUserId).filter((r) => isApproverDesignation(r.designation));
}

/** Only Senior Manager Production + AGM. If those IDs do not exist yet, Super Admin. */
export function listApproverOptions(excludeUserId: string): ApproverOption[] {
  const designated = designatedApprovers(excludeUserId);
  if (designated.length) {
    return designated.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      label: approverLabel(r),
    }));
  }
  return loadActivePeople(excludeUserId)
    .filter((r) => r.role === "super_admin")
    .map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      label: approverLabel(r),
    }));
}

export function approverFallback(excludeUserId: string): boolean {
  return designatedApprovers(excludeUserId).length === 0;
}

export function getApprover(id: string, requesterId: string) {
  const designated = designatedApprovers(requesterId);
  if (designated.length) {
    return designated.find((d) => d.id === id) || null;
  }
  const fallbackId = id || superAdminIds().find((x) => x !== requesterId) || superAdminIds()[0];
  if (!fallbackId || fallbackId === requesterId) return null;
  const u = db
    .prepare(
      `SELECT id, name, role, designation, manager_scope, active FROM users WHERE id = ?`
    )
    .get(fallbackId) as ApproverRow | undefined;
  if (!u || !u.active || u.role !== "super_admin") return null;
  return u;
}

export function punchStageForUser(userId: string): "manager" | "scope" | "final" {
  const u = db
    .prepare("SELECT role, department FROM users WHERE id = ?")
    .get(userId) as { role: string; department: string } | undefined;
  if (!u || isLeadershipRole(u.role)) return "final";
  // Official + yellow card both go to the department manager (Senior Manager or AGM).
  return "scope";
}

function managerIdsForDepartment(department: string) {
  return managersForScope(departmentScope(department));
}

export function notifyPunchApprovers(
  requester: {
    id: string;
    name: string;
    department: string;
    staff_type?: string;
  },
  summary: string,
  date: string,
  stage: string,
  approverId?: string | null
) {
  if (approverId) {
    notify(approverId, "Manual punch", `${requester.name} needs your approval — ${summary} on ${date}`, {
      type: "approval",
      link: "/approvals",
    });
    return;
  }
  if (stage === "manager" || stage === "scope") {
    const ids = managerIdsForDepartment(requester.department);
    if (ids.length === 0) {
      notifyMany(superAdminIds(), "Manual punch (no manager)", `${requester.name}: ${summary} on ${date}`, {
        type: "approval",
        link: "/approvals",
      });
      return;
    }
    const title = stage === "manager" ? "Yellow card punch" : "Manual punch";
    notifyMany(ids, title, `${requester.name} needs your approval — ${summary} on ${date}`, {
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

export function notifyLeaveApprovers(
  requester: {
    id: string;
    name: string;
    role: string;
    department: string;
  },
  summary: string,
  approverId?: string | null
) {
  if (approverId) {
    notify(approverId, "Leave request", `${requester.name}: ${summary}`, {
      type: "approval",
      link: "/approvals",
    });
    return;
  }
  if (isLeadershipRole(requester.role)) {
    notifyMany(superAdminIds(), "Leave request — Super Admin", `${requester.name}: ${summary}`, {
      type: "approval",
      link: "/approvals",
    });
    return;
  }
  const ids = managerIdsForDepartment(requester.department);
  if (ids.length === 0) {
    notifyMany(superAdminIds(), "Leave request (no manager)", `${requester.name}: ${summary}`, {
      type: "approval",
      link: "/approvals",
    });
    return;
  }
  notifyMany(ids, "Leave request", `${requester.name}: ${summary}`, {
    type: "approval",
    link: "/approvals",
  });
}

function managesDepartment(actor: { role: string; manager_scope?: string }, department: string) {
  return actor.role === "manager" && actor.manager_scope === departmentScope(department);
}

export function canActOnManual(
  actor: { id: string; role: string; manager_scope?: string },
  row: { user_id: string; status: string; stage?: string; approver_id?: string | null }
): boolean {
  if (row.status !== "pending") return false;
  const target = db
    .prepare("SELECT id, role, staff_type, department FROM users WHERE id = ?")
    .get(row.user_id) as { id: string; role: string; staff_type: string; department: string } | undefined;
  if (!target) return false;
  if (actor.id === row.user_id) return false;
  if (actor.role === "super_admin") return true;
  if (row.approver_id) return actor.id === row.approver_id;
  if (isLeadershipRole(target.role)) return false;
  const stage = row.stage || "final";
  if (stage === "scope" || stage === "manager") return managesDepartment(actor, target.department);
  return actor.role === "admin";
}

export function canActOnLeave(
  actor: { id: string; role: string; manager_scope?: string },
  row: { user_id: string; status: string; approver_id?: string | null }
): boolean {
  if (row.status !== "pending") return false;
  const target = db
    .prepare("SELECT id, role, department FROM users WHERE id = ?")
    .get(row.user_id) as { id: string; role: string; department: string } | undefined;
  if (!target) return false;
  if (actor.id === row.user_id) return false;
  if (actor.role === "super_admin") return true;
  if (row.approver_id) return actor.id === row.approver_id;
  if (isLeadershipRole(target.role)) return false;
  if (actor.role === "manager") return managesDepartment(actor, target.department);
  return actor.role === "admin";
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
