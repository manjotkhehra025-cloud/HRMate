import { all, get, one } from './db.js';
import { levelOf, roleMeta } from './rbac.js';

/** Employees reporting (directly) to the given manager. */
export function directReports(managerId) {
  return all('SELECT * FROM employees WHERE manager_id = ? AND status != ? ORDER BY first_name', managerId, 'terminated');
}

/** Everyone in the subtree under a manager (inclusive of the manager). */
export function reportTreeIds(managerId, includeSelf = true) {
  const ids = new Set(includeSelf ? [managerId] : []);
  let frontier = [managerId];
  let guard = 0;
  while (frontier.length && guard++ < 12) {
    const marks = frontier.map(() => '?').join(',');
    const next = all(`SELECT id FROM employees WHERE manager_id IN (${marks}) AND status != 'terminated'`, ...frontier);
    frontier = next.map((r) => r.id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }
  return [...ids];
}

/** All departments in the subtree of a department (inclusive). */
export function departmentTreeIds(departmentId) {
  const ids = new Set([departmentId]);
  let frontier = [departmentId];
  let guard = 0;
  while (frontier.length && guard++ < 12) {
    const marks = frontier.map(() => '?').join(',');
    const next = all(`SELECT id FROM departments WHERE parent_id IN (${marks})`, ...frontier);
    frontier = next.map((r) => r.id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function departmentOfEmployee(employeeId) {
  const e = get('SELECT department_id FROM employees WHERE id = ?', employeeId);
  return e?.department_id || null;
}

/**
 * Resolve the set of employee ids the actor is allowed to operate on for
 * people-related data. Returns null when the scope is "company" (no filter).
 */
export function visibleEmployeeIds(actor, { includeSelf = true } = {}) {
  if (!actor) return [];
  const scope = roleMeta(actor.role).scope;
  if (scope === 'system' || scope === 'company') return null;
  if (scope === 'department') {
    const deptIds = departmentOfEmployee(actor.id) ? departmentTreeIds(departmentOfEmployee(actor.id)) : [];
    const marks = deptIds.length ? deptIds.map(() => '?').join(',') : 'NULL';
    const rows = all(
      `SELECT id FROM employees WHERE department_id IN (${marks}) OR manager_id = ? ${includeSelf ? 'OR id = ?' : ''}`,
      ...deptIds,
      actor.id,
      ...(includeSelf ? [actor.id] : [])
    );
    return [...new Set(rows.map((r) => r.id))];
  }
  // team scopes: direct reports + their reports for supervisors/team leads
  const tree = reportTreeIds(actor.id, includeSelf);
  return [...new Set(tree)];
}

/** SQL fragment limiting `employee_id` for a scoped actor. */
export function scopeClause(actor, column = 'employee_id') {
  const ids = visibleEmployeeIds(actor);
  if (ids === null) return { sql: '', args: [] };
  if (!ids.length) return { sql: `AND 1 = 0`, args: [] };
  return { sql: `AND ${column} IN (${ids.map(() => '?').join(',')})`, args: ids };
}

export function canSeeEmployee(actor, employeeId) {
  const ids = visibleEmployeeIds(actor);
  if (ids === null) return true;
  return ids.includes(Number(employeeId));
}

export function assertCanSeeEmployee(actor, employeeId) {
  if (!canSeeEmployee(actor, employeeId)) {
    const err = new Error('You do not have access to this employee');
    err.status = 403;
    throw err;
  }
}

/** Approval chain: manager -> dept head -> hr. */
export function approvalChain(employeeId) {
  const chain = [];
  const emp = get('SELECT * FROM employees WHERE id = ?', employeeId);
  if (!emp) return chain;
  let guard = 0;
  let cursor = emp.manager_id;
  while (cursor && guard++ < 6) {
    const mgr = get('SELECT * FROM employees WHERE id = ?', cursor);
    if (!mgr) break;
    chain.push(mgr);
    if (levelOf(mgr.role) >= levelOf('dept_manager')) break;
    cursor = mgr.manager_id;
  }
  if (!chain.some((c) => c.role === 'hr_manager' || c.role === 'hr_admin')) {
    const hr = one(
      "SELECT id FROM employees WHERE company_id = ? AND role IN ('hr_admin','hr_manager') AND status = 'active' ORDER BY id LIMIT 1",
      emp.company_id
    );
    if (hr) chain.push(get('SELECT * FROM employees WHERE id = ?', hr));
  }
  return chain;
}

export function nextApprover(employeeId) {
  const chain = approvalChain(employeeId);
  return chain[0]?.id || null;
}

export function employeeLabel(e) {
  return e ? `${e.first_name} ${e.last_name || ''}`.trim() : 'Unknown';
}

export function activeEmployees(companyId, extraWhere = '', args = []) {
  return all(
    `SELECT * FROM employees WHERE company_id = ? AND status != 'terminated' ${extraWhere} ORDER BY first_name`,
    companyId,
    ...args
  );
}

/** Every active employee id for a scoped actor (company scope => all active). */
export function scopeIdsOrDefault(actor) {
  const ids = visibleEmployeeIds(actor);
  if (ids === null) return all("SELECT id FROM employees WHERE status != 'terminated'").map((r) => r.id);
  return ids;
}
