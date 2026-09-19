import { all, get, insert, one, run, update } from '../lib/db.js';
import { badRequest, dateRange, notFound, nowIso, today } from '../lib/http.js';
import { hashPassword } from '../lib/auth.js';
import { requirePerm } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { assertCanSeeEmployee, visibleEmployeeIds, departmentTreeIds } from '../lib/scope.js';
import { employeeCard, maps, paginate, personRef, serializeEmployee, withPagination } from './_shared.js';
import { ROLES, can } from '../lib/rbac.js';
import { push } from '../lib/notify.js';

const EMPLOYEE_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'role', 'designation', 'department_id', 'location_id',
  'manager_id', 'employment_type', 'status', 'join_date', 'exit_date', 'date_of_birth', 'gender',
  'address', 'city', 'emergency_contact', 'emergency_phone', 'salary', 'currency', 'shift_id',
  'avatar_color', 'avatar_emoji', 'bio', 'bank_account', 'tax_id', 'work_mode', 'probation_end',
  'notice_period_days'
];

function normalize(body) {
  const out = {};
  for (const f of EMPLOYEE_FIELDS) if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  if (body.skills !== undefined) out.skills = Array.isArray(body.skills) ? body.skills : [];
  return out;
}

export function register(router) {
  // --- employees list ------------------------------------------------------
  router.get('/api/employees', (ctx) => {
    const q = ctx.query;
    const m = maps();
    const where = ['e.company_id = ?'];
    const args = [ctx.actor.company_id];

    if (q.status) {
      where.push('e.status = ?');
      args.push(q.status);
    } else {
      where.push("e.status != 'terminated'");
    }
    if (q.department) {
      const ids = departmentTreeIds(Number(q.department));
      where.push(`e.department_id IN (${ids.map(() => '?').join(',')})`);
      args.push(...ids);
    }
    if (q.role) {
      where.push('e.role = ?');
      args.push(q.role);
    }
    if (q.location) {
      where.push('e.location_id = ?');
      args.push(Number(q.location));
    }
    if (q.manager) {
      where.push('e.manager_id = ?');
      args.push(Number(q.manager));
    }
    if (q.shift) {
      where.push('e.shift_id = ?');
      args.push(Number(q.shift));
    }
    if (q.search) {
      where.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.emp_code LIKE ? OR e.designation LIKE ?)');
      const s = `%${q.search}%`;
      args.push(s, s, s, s, s);
    }
    const scope = visibleEmployeeIds(ctx.actor);
    if (scope !== null) {
      if (!scope.length) where.push('1 = 0');
      else {
        where.push(`e.id IN (${scope.map(() => '?').join(',')})`);
        args.push(...scope);
      }
    }
    const sortMap = {
      name: 'e.first_name',
      join_date: 'e.join_date DESC',
      role: 'e.role',
      department: 'e.department_id',
      recent: 'e.created_at DESC'
    };
    const orderBy = sortMap[q.sort] || 'e.first_name';

    const { limit, offset } = paginate(q, 50);
    const total = one(`SELECT COUNT(*) FROM employees e WHERE ${where.join(' AND ')}`, ...args);
    const rows = all(
      `SELECT e.* FROM employees e WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      ...args,
      limit,
      offset
    );

    const todayDate = today();
    const empIds = rows.map((r) => r.id);
    const attMap = {};
    if (empIds.length) {
      for (const r of all(
        `SELECT employee_id, status, first_in, last_out, work_minutes FROM attendance WHERE date = ? AND employee_id IN (${empIds.map(() => '?').join(',')})`,
        todayDate,
        ...empIds
      ))
        attMap[r.employee_id] = r;
    }

    return {
      ...withPagination(q, rows.map((e) => ({ ...employeeCard(e, m), today: attMap[e.id] || null })), total),
      facets: {
        statuses: all('SELECT status, COUNT(*) AS count FROM employees WHERE company_id = ? GROUP BY status', ctx.actor.company_id),
        roles: all('SELECT role, COUNT(*) AS count FROM employees WHERE company_id = ? GROUP BY role', ctx.actor.company_id),
        departments: all('SELECT department_id, COUNT(*) AS count FROM employees WHERE company_id = ? GROUP BY department_id', ctx.actor.company_id),
        headcount: one("SELECT COUNT(*) FROM employees WHERE company_id = ? AND status != 'terminated'", ctx.actor.company_id)
      }
    };
  });

  // --- directory (lightweight, everyone) -----------------------------------
  router.get('/api/directory', (ctx) => {
    const q = ctx.query;
    const m = maps();
    const where = ["e.status != 'terminated'", 'e.company_id = ?'];
    const args = [ctx.actor.company_id];
    // The directory is a contact book: anyone who may see the company roster gets
    // names, roles and contact details. Sensitive fields stay behind /api/employees/:id.
    const scope = can(ctx.actor, 'employee.view_company') ? null : visibleEmployeeIds(ctx.actor);
    if (scope !== null) {
      if (!scope.length) where.push('1 = 0');
      else {
        where.push(`e.id IN (${scope.map(() => '?').join(',')})`);
        args.push(...scope);
      }
    }
    if (q.search) {
      where.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.designation LIKE ? OR e.email LIKE ?)');
      const s = `%${q.search}%`;
      args.push(s, s, s, s);
    }
    if (q.department) {
      where.push('e.department_id = ?');
      args.push(Number(q.department));
    }
    const rows = all(`SELECT e.* FROM employees e WHERE ${where.join(' AND ')} ORDER BY e.first_name`, ...args);
    const grouped = {};
    for (const e of rows) {
      const dept = m.depts[e.department_id]?.name || 'Unassigned';
      grouped[dept] = grouped[dept] || [];
      grouped[dept].push(employeeCard(e, m));
    }
    return {
      people: rows.map((e) => employeeCard(e, m)),
      grouped,
      departments: Object.entries(grouped).map(([name, list]) => ({ name, count: list.length }))
    };
  });

  router.get('/api/org-tree', (ctx) => {
    const m = maps();
    const rows = all("SELECT * FROM employees WHERE company_id = ? AND status != 'terminated'", ctx.actor.company_id);
    const byManager = new Map();
    for (const e of rows) {
      const key = e.manager_id || 0;
      if (!byManager.has(key)) byManager.set(key, []);
      byManager.get(key).push(e);
    }
    const build = (managerId, depth = 0) =>
      (byManager.get(managerId) || [])
        .sort((a, b) => a.first_name.localeCompare(b.first_name))
        .map((e) => ({ ...employeeCard(e, m), depth, reports: depth < 4 ? build(e.id, depth + 1) : [] }));
    return { tree: build(0), counts: { total: rows.length, managers: rows.filter((r) => r.manager_id).length } };
  });

  // --- employee detail -----------------------------------------------------
  router.get('/api/employees/:id', (ctx) => {
    const id = Number(ctx.params.id);
    assertCanSeeEmployee(ctx.actor, id);
    const e = get('SELECT * FROM employees WHERE id = ?', id);
    if (!e) throw notFound('Employee not found');
    const m = maps();
    const manager = e.manager_id ? get('SELECT * FROM employees WHERE id = ?', e.manager_id) : null;
    const reports = all('SELECT * FROM employees WHERE manager_id = ? AND status != ? ORDER BY first_name', id, 'terminated');
    const dept = e.department_id ? get('SELECT * FROM departments WHERE id = ?', e.department_id) : null;
    const todayAtt = get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', id, today());
    const last30 = all(
      `SELECT date, status, work_minutes, late_minutes FROM attendance WHERE employee_id = ? AND date >= date('now','-30 day') ORDER BY date DESC`,
      id
    );
    const documents = all('SELECT * FROM documents WHERE employee_id = ? ORDER BY created_at DESC LIMIT 8', id);
    const kyc = all('SELECT * FROM kyc_checks WHERE employee_id = ? ORDER BY submitted_at DESC', id);
    const devices = all('SELECT * FROM devices WHERE employee_id = ? ORDER BY last_seen_at DESC', id);
    const kudosReceived = one('SELECT COUNT(*) FROM kudos WHERE to_employee_id = ?', id);
    const avgRating = one('SELECT AVG(rating) FROM reviews WHERE employee_id = ? AND rating IS NOT NULL', id);
    const goalProgress = one('SELECT AVG(progress) FROM goals WHERE employee_id = ?', id);
    return {
      employee: serializeEmployee(e, m),
      department: dept,
      manager: manager ? personRef(manager) : null,
      reports: reports.map((r) => employeeCard(r, m)),
      todayAttendance: todayAtt,
      last30,
      documents,
      kyc,
      devices,
      metrics: {
        attendanceRate: last30.length ? Number(((last30.filter((d) => ['present', 'late', 'wfh'].includes(d.status)).length / last30.length) * 100).toFixed(1)) : 0,
        avgRating: avgRating ? Number(Number(avgRating).toFixed(1)) : null,
        goalProgress: goalProgress ? Math.round(goalProgress) : 0,
        kudosReceived,
        tenureDays: e.join_date ? Math.round((Date.now() - new Date(e.join_date).getTime()) / 86400000) : 0,
        docsExpiring: one(`SELECT COUNT(*) FROM documents WHERE employee_id = ? AND expiry_date IS NOT NULL AND expiry_date < date('now','+60 day')`, id)
      }
    };
  });

  // --- create --------------------------------------------------------------
  router.post('/api/employees', (ctx) => {
    requirePerm(ctx, 'employee.create');
    const body = ctx.body;
    if (!body.first_name) throw badRequest('First name is required');
    if (!body.email) throw badRequest('Work email is required');
    if (get('SELECT id FROM employees WHERE LOWER(email) = LOWER(?)', body.email)) throw badRequest('That email is already in use');
    const nextCode = `NP-${1000 + one('SELECT COUNT(*) FROM employees') + 1}`;
    const id = insert('employees', {
      company_id: ctx.actor.company_id,
      emp_code: body.emp_code || nextCode,
      password_hash: hashPassword(body.password || 'Demo@1234'),
      avatar_color: body.avatar_color || '#6366f1',
      avatar_emoji: body.avatar_emoji || '🙂',
      status: 'active',
      role: body.role || 'employee',
      currency: 'INR',
      created_at: nowIso(),
      updated_at: nowIso(),
      ...normalize(body)
    });
    // seed leave balances for the new joiner
    const year = Number(new Date().toISOString().slice(0, 4));
    for (const lt of all('SELECT * FROM leave_types WHERE company_id = ? AND active = 1', ctx.actor.company_id)) {
      insert('leave_balances', { employee_id: id, leave_type_id: lt.id, year, entitled: lt.annual_quota, used: 0, pending: 0 });
    }
    audit(ctx, 'employee.create', 'employee', id, `Onboarded ${body.first_name} ${body.last_name || ''}`, { meta: { email: body.email } });
    push(id, {
      type: 'welcome',
      title: 'Welcome to HRMate 👋',
      body: 'Your workspace is ready. Complete your profile and enable biometric unlock.',
      icon: '🎉',
      link: '#/settings',
      priority: 'high'
    });
    return { id, employee: serializeEmployee(get('SELECT * FROM employees WHERE id = ?', id), maps()) };
  });

  // --- update --------------------------------------------------------------
  router.patch('/api/employees/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const self = id === ctx.actor.id;
    if (!self) requirePerm(ctx, 'employee.update');
    const e = get('SELECT * FROM employees WHERE id = ?', id);
    if (!e) throw notFound('Employee not found');
    if (self) {
      // employees can only edit their own profile fields
      const allowed = ['first_name', 'last_name', 'phone', 'address', 'city', 'emergency_contact', 'emergency_phone', 'bio', 'avatar_color', 'avatar_emoji', 'date_of_birth', 'gender', 'skills'];
      const patch = {};
      for (const f of allowed) if (ctx.body[f] !== undefined) patch[f] = ctx.body[f];
      update('employees', id, { ...patch, updated_at: nowIso() });
      audit(ctx, 'employee.update_self', 'employee', id, 'Updated own profile');
      return { employee: serializeEmployee(get('SELECT * FROM employees WHERE id = ?', id), maps()) };
    }
    update('employees', id, { ...normalize(ctx.body), updated_at: nowIso() });
    audit(ctx, 'employee.update', 'employee', id, `Updated ${e.first_name} ${e.last_name || ''}`, { meta: Object.keys(ctx.body) });
    push(id, { type: 'profile', title: 'Profile updated', body: 'Your employee record was updated by HR.', icon: '🪪', link: '#/profile' });
    return { employee: serializeEmployee(get('SELECT * FROM employees WHERE id = ?', id), maps()) };
  });

  router.delete('/api/employees/:id', (ctx) => {
    requirePerm(ctx, 'employee.delete');
    const id = Number(ctx.params.id);
    const e = get('SELECT * FROM employees WHERE id = ?', id);
    if (!e) throw notFound('Employee not found');
    update('employees', id, { status: 'terminated', exit_date: ctx.body?.exit_date || today(), updated_at: nowIso() });
    run('UPDATE employees SET manager_id = NULL WHERE manager_id = ?', id);
    audit(ctx, 'employee.terminate', 'employee', id, `Marked ${e.first_name} ${e.last_name || ''} as exited`, { severity: 'warning' });
    return { ok: true };
  });

  router.post('/api/employees/:id/restore', (ctx) => {
    requirePerm(ctx, 'employee.update');
    update('employees', Number(ctx.params.id), { status: 'active', exit_date: null, updated_at: nowIso() });
    audit(ctx, 'employee.restore', 'employee', Number(ctx.params.id), 'Reinstated employee');
    return { ok: true };
  });

  router.get('/api/employees/:id/timeline', (ctx) => {
    const id = Number(ctx.params.id);
    assertCanSeeEmployee(ctx.actor, id);
    const events = [
      ...all('SELECT created_at AS at, ? AS kind, summary AS text FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT 12', 'system', id),
      ...all(`SELECT start_date AS at, 'leave' AS kind, ('Leave: ' || lt.name) AS text FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.employee_id = ? ORDER BY start_date DESC LIMIT 8`, id),
      ...all(`SELECT created_at AS at, 'kudos' AS kind, message AS text FROM kudos WHERE to_employee_id = ? ORDER BY created_at DESC LIMIT 6`, id),
      ...all(`SELECT created_at AS at, 'document' AS kind, title AS text FROM documents WHERE employee_id = ? ORDER BY created_at DESC LIMIT 6`, id)
    ]
      .filter((e) => e.at)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 20);
    return { events };
  });

  // --- departments ---------------------------------------------------------
  router.get('/api/departments', (ctx) => {
    const rows = all('SELECT * FROM departments WHERE company_id = ? ORDER BY name', ctx.actor.company_id);
    const counts = Object.fromEntries(
      all('SELECT department_id, COUNT(*) AS c FROM employees GROUP BY department_id').map((r) => [r.department_id, r.c])
    );
    const heads = Object.fromEntries(all('SELECT id, first_name, last_name, designation FROM employees').map((e) => [e.id, `${e.first_name} ${e.last_name || ''}`.trim()]));
    return {
      rows: rows.map((d) => ({
        ...d,
        head_name: heads[d.head_employee_id] || null,
        headcount: counts[d.id] || 0,
        parent_name: rows.find((p) => p.id === d.parent_id)?.name || null
      }))
    };
  });

  router.post('/api/departments', (ctx) => {
    requirePerm(ctx, 'admin.departments');
    const { name, code, color, icon, parent_id, budget, description } = ctx.body;
    if (!name) throw badRequest('Department name is required');
    const id = insert('departments', { company_id: ctx.actor.company_id, name, code, color: color || '#6366f1', icon: icon || '🏢', parent_id: parent_id || null, budget: budget || null, description: description || null });
    audit(ctx, 'department.create', 'department', id, `Created department ${name}`);
    return { id };
  });

  router.patch('/api/departments/:id', (ctx) => {
    requirePerm(ctx, 'admin.departments');
    const id = Number(ctx.params.id);
    update('departments', id, ctx.body);
    audit(ctx, 'department.update', 'department', id, `Updated department #${id}`);
    return { ok: true };
  });

  router.delete('/api/departments/:id', (ctx) => {
    requirePerm(ctx, 'admin.departments');
    const id = Number(ctx.params.id);
    const count = one('SELECT COUNT(*) FROM employees WHERE department_id = ?', id);
    if (count) throw badRequest(`Cannot delete: ${count} employees still assigned`);
    run('DELETE FROM departments WHERE id = ?', id);
    audit(ctx, 'department.delete', 'department', id, `Deleted department #${id}`, { severity: 'warning' });
    return { ok: true };
  });

  // --- locations & shifts (read for most roles) ----------------------------
  router.get('/api/locations', (ctx) => ({ rows: all('SELECT * FROM locations WHERE company_id = ? ORDER BY name', ctx.actor.company_id) }));

  router.post('/api/locations', (ctx) => {
    requirePerm(ctx, 'admin.locations');
    const id = insert('locations', { company_id: ctx.actor.company_id, ...ctx.body });
    audit(ctx, 'location.create', 'location', id, `Created location ${ctx.body.name}`);
    return { id };
  });

  router.patch('/api/locations/:id', (ctx) => {
    requirePerm(ctx, 'admin.locations');
    update('locations', Number(ctx.params.id), ctx.body);
    audit(ctx, 'location.update', 'location', Number(ctx.params.id), `Updated location #${ctx.params.id}`);
    return { ok: true };
  });

  router.delete('/api/locations/:id', (ctx) => {
    requirePerm(ctx, 'admin.locations');
    run('DELETE FROM locations WHERE id = ?', Number(ctx.params.id));
    audit(ctx, 'location.delete', 'location', Number(ctx.params.id), 'Deleted location', { severity: 'warning' });
    return { ok: true };
  });

  router.get('/api/roles', (ctx) => ({ roles: ROLES }));
}
