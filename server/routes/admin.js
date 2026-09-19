import { all, get, insert, one, run, update } from '../lib/db.js';
import { badRequest, notFound, nowIso, today } from '../lib/http.js';
import { requirePerm } from '../lib/auth.js';
import { forbidden } from '../lib/http.js';
import { audit, listAudit, auditStats } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { employeeLabel } from '../lib/scope.js';
import { ROLE_PERMISSIONS, ROLES, PERMISSION_GROUPS, can } from '../lib/rbac.js';
import { dbStats } from '../lib/db.js';

export function register(router) {
  // --- company settings ----------------------------------------------------
  router.get('/api/admin/company', (ctx) => {
    requirePerm(ctx, 'admin.settings');
    const company = get('SELECT * FROM companies WHERE id = ?', ctx.actor.company_id);
    const settings = Object.fromEntries(all('SELECT key, value FROM settings').map((s) => [s.key, s.value]));
    return {
      company: { ...company, work_days: JSON.parse(company.work_days || '[1,2,3,4,5]') },
      settings,
      parsed: {
        punch_methods: JSON.parse(settings.punch_methods || '[]'),
        locales: JSON.parse(settings.locales || '["en"]'),
        biometric_required_roles: JSON.parse(settings.biometric_required_roles || '[]')
      }
    };
  });

  router.patch('/api/admin/company', (ctx) => {
    requirePerm(ctx, 'admin.settings');
    const companyFields = ['name', 'logo_emoji', 'industry', 'timezone', 'week_start', 'work_hours_per_day', 'currency', 'punch_radius_m', 'allow_remote_punch', 'overtime_enabled', 'late_grace_min', 'plan'];
    const patch = {};
    for (const f of companyFields) if (ctx.body[f] !== undefined) patch[f] = ctx.body[f];
    if (ctx.body.work_days) patch.work_days = ctx.body.work_days;
    update('companies', ctx.actor.company_id, patch);
    audit(ctx, 'company.update', 'company', ctx.actor.company_id, 'Updated company profile', { meta: Object.keys(patch) });
    return { ok: true };
  });

  router.patch('/api/admin/settings', (ctx) => {
    requirePerm(ctx, 'admin.settings');
    const changed = [];
    for (const [key, value] of Object.entries(ctx.body || {})) {
      const existing = get('SELECT * FROM settings WHERE key = ?', key);
      const serialised = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (existing) run('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?', serialised, nowIso(), key);
      else insert('settings', { key, value: serialised, updated_at: nowIso() });
      changed.push(key);
    }
    audit(ctx, 'settings.update', 'company', null, `Updated settings: ${changed.join(', ')}`, { severity: changed.length > 3 ? 'warning' : 'info' });
    return { ok: true, changed };
  });

  // --- roles & permissions -------------------------------------------------
  router.get('/api/admin/roles', (ctx) => {
    if (!can(ctx.actor, 'admin.roles') && !can(ctx.actor, 'admin.settings')) throw forbidden('Missing permission: admin.roles');
    const counts = Object.fromEntries(all('SELECT role, COUNT(*) AS c FROM employees GROUP BY role').map((r) => [r.role, r.c]));
    return {
      roles: ROLES.map((r) => ({ ...r, headcount: counts[r.key] || 0, permissions: ROLE_PERMISSIONS[r.key] || [] })),
      groups: PERMISSION_GROUPS,
      matrix: Object.fromEntries(ROLES.map((r) => [r.key, ROLE_PERMISSIONS[r.key] || []]))
    };
  });

  router.patch('/api/admin/roles/:key', (ctx) => {
    requirePerm(ctx, 'admin.roles');
    const key = ctx.params.key;
    if (!ROLE_PERMISSIONS[key]) throw notFound('Unknown role');
    const { permissions } = ctx.body;
    if (!Array.isArray(permissions)) throw badRequest('permissions array is required');
    ROLE_PERMISSIONS[key] = permissions;
    audit(ctx, 'role.update', 'role', null, `Updated permissions for ${key} (${permissions.length} keys)`, { severity: 'warning' });
    const affected = all('SELECT id FROM employees WHERE role = ?', key);
    for (const a of affected) push(a.id, { type: 'security', title: 'Permissions updated', body: 'Your role permissions were changed by an administrator.', icon: '🛡️', link: '#/settings' });
    return { ok: true, role: key, permissions };
  });

  // --- device management ---------------------------------------------------
  router.get('/api/devices', (ctx) => {
    const where = ['d.company_id = ?'];
    const args = [ctx.actor.company_id];
    if (ctx.query.scope === 'mine') {
      where.push('d.employee_id = ?');
      args.push(ctx.actor.id);
    } else {
      requirePerm(ctx, 'devices.manage');
      if (ctx.query.status) {
        where.push('d.status = ?');
        args.push(ctx.query.status);
      }
      if (ctx.query.employee_id) {
        where.push('d.employee_id = ?');
        args.push(Number(ctx.query.employee_id));
      }
    }
    const rows = all(
      `SELECT d.*, e.first_name, e.last_name, e.email, e.designation, e.avatar_color, e.avatar_emoji, l.name AS location
       FROM devices d JOIN employees e ON e.id = d.employee_id LEFT JOIN locations l ON l.id = e.location_id
       WHERE ${where.join(' AND ')} ORDER BY d.last_seen_at DESC LIMIT 300`,
      ...args
    );
    return {
      rows: rows.map((d) => ({ ...d, owner: `${d.first_name} ${d.last_name || ''}`.trim() })),
      totals: {
        all: rows.length,
        trusted: rows.filter((d) => d.status === 'trusted').length,
        pending: rows.filter((d) => d.status === 'pending').length,
        blocked: rows.filter((d) => d.status === 'blocked').length,
        revoked: rows.filter((d) => d.status === 'revoked').length,
        biometric: rows.filter((d) => d.fingerprint_enrolled || d.face_enrolled).length,
        stale: rows.filter((d) => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() > 7 * 86400000).length
      },
      platforms: ['iOS', 'Android', 'iPadOS', 'Web'].map((p) => ({ platform: p, count: rows.filter((r) => r.platform === p).length }))
    };
  });

  router.post('/api/devices', (ctx) => {
    const { label, platform = 'Android', model = 'Unknown device' } = ctx.body;
    const id = insert('devices', {
      company_id: ctx.actor.company_id,
      employee_id: ctx.actor.id,
      label: label || `${ctx.actor.first_name}'s ${model}`,
      platform,
      model,
      app_version: '4.2.0',
      status: 'pending',
      trusted: 0,
      enrolled_at: nowIso(),
      last_seen_at: nowIso()
    });
    audit(ctx, 'device.enroll', 'device', id, `Enrolled ${platform} device ${model}`);
    return { id };
  });

  router.patch('/api/devices/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const device = get('SELECT * FROM devices WHERE id = ?', id);
    if (!device) throw notFound('Device not found');
    if (device.employee_id !== ctx.actor.id) requirePerm(ctx, 'devices.manage');
    const patch = { ...ctx.body };
    if (patch.status === 'trusted') patch.trusted = 1;
    if (patch.status === 'revoked') {
      patch.trusted = 0;
      patch.revoked_at = nowIso();
      patch.revoked_reason = patch.revoked_reason || 'Revoked by administrator';
    }
    update('devices', id, patch);
    audit(ctx, `device.${patch.status || 'update'}`, 'device', id, `Device ${device.label} → ${patch.status || 'updated'}`, { severity: patch.status === 'revoked' ? 'warning' : 'info' });
    if (device.employee_id !== ctx.actor.id) {
      push(device.employee_id, {
        type: 'security',
        title: patch.status === 'revoked' ? 'Device revoked' : 'Device updated',
        body: `${device.label} (${device.model})`,
        icon: '🔐',
        link: '#/devices',
        priority: 'high'
      });
    }
    return { ok: true };
  });

  router.delete('/api/devices/:id', (ctx) => {
    const id = Number(ctx.params.id);
    const device = get('SELECT * FROM devices WHERE id = ?', id);
    if (!device) throw notFound('Device not found');
    if (device.employee_id !== ctx.actor.id) requirePerm(ctx, 'devices.manage');
    run('DELETE FROM devices WHERE id = ?', id);
    audit(ctx, 'device.delete', 'device', id, `Removed device ${device.label}`, { severity: 'warning' });
    return { ok: true };
  });

  // --- audit logs ----------------------------------------------------------
  router.get('/api/audit-logs', (ctx) => {
    requirePerm(ctx, 'audit.view');
    const { limit, offset, action, entity, from, to, q } = ctx.query;
    const result = listAudit({
      companyId: ctx.actor.company_id,
      limit: Math.min(200, Number(limit) || 50),
      offset: Number(offset) || 0,
      action: action || undefined,
      entity: entity || undefined,
      from: from || undefined,
      to: to || undefined,
      q: q || undefined
    });
    return { ...result, stats: auditStats(ctx.actor.company_id), actions: all('SELECT DISTINCT action FROM audit_logs WHERE company_id = ? ORDER BY action', ctx.actor.company_id).map((r) => r.action) };
  });

  router.get('/api/audit-logs/export', (ctx) => {
    requirePerm(ctx, 'audit.view_all');
    const rows = all('SELECT * FROM audit_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 5000', ctx.actor.company_id);
    return { rows, exported_at: nowIso() };
  });

  // --- system health / data ------------------------------------------------
  router.get('/api/admin/system', (ctx) => {
    requirePerm(ctx, 'admin.settings');
    const tables = dbStats();
    const totalRows = Object.values(tables).reduce((s, n) => s + n, 0);
    return {
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      database: { file: process.env.HRMATE_DB || 'data/hrmate.db', engine: 'SQLite (node:sqlite)', tables, totalRows },
      sessions: one('SELECT COUNT(*) FROM sessions'),
      pendingApprovals: one("SELECT COUNT(*) FROM approvals WHERE status = 'pending'"),
      expiringDocs: one("SELECT COUNT(*) FROM documents WHERE expiry_date IS NOT NULL AND expiry_date < date('now','+60 day')"),
      lastAudit: one('SELECT created_at FROM audit_logs ORDER BY created_at DESC LIMIT 1')
    };
  });

  router.post('/api/admin/reset-demo-data', (ctx) => {
    requirePerm(ctx, 'admin.settings');
    audit(ctx, 'system.reset', 'company', null, 'Demo data reset requested', { severity: 'warning' });
    return { ok: false, message: 'Run `npm run reset` on the server to rebuild demo data.' };
  });
}
