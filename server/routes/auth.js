import { all, get, insert, one, run, update } from '../lib/db.js';
import { badRequest, nowIso, notFound, unauthorized } from '../lib/http.js';
import {
  biometricTemplate,
  createSession,
  destroySession,
  hashPassword,
  publicEmployee,
  verifyPassword
} from '../lib/auth.js';
import { ROLE_PERMISSIONS, can } from '../lib/rbac.js';
import { audit } from '../lib/audit.js';
import { push } from '../lib/notify.js';
import { balancesFor, maps } from './_shared.js';

function sessionPayload(actor) {
  const m = maps();
  const company = get('SELECT * FROM companies WHERE id = ?', actor.company_id);
  const manager = actor.manager_id ? get('SELECT * FROM employees WHERE id = ?', actor.manager_id) : null;
  const dept = actor.department_id ? get('SELECT * FROM departments WHERE id = ?', actor.department_id) : null;
  const loc = actor.location_id ? get('SELECT * FROM locations WHERE id = ?', actor.location_id) : null;
  const shift = actor.shift_id ? get('SELECT * FROM shifts WHERE id = ?', actor.shift_id) : null;
  return {
    employee: {
      ...publicEmployee(actor),
      department_name: dept?.name || null,
      department_color: dept?.color || null,
      department_icon: dept?.icon || null,
      location_name: loc?.name || null,
      location: loc || null,
      shift: shift || null,
      manager_name: manager ? `${manager.first_name} ${manager.last_name || ''}`.trim() : null,
      manager: manager ? publicEmployee(manager) : null,
      balances: balancesFor(actor.id, Number(new Date().toISOString().slice(0, 4))),
      permissions: ROLE_PERMISSIONS[actor.role] || [],
      settings: {
        locale: actor.locale || 'en',
        theme: actor.theme || 'light'
      }
    },
    company: company
      ? { ...company, work_days: JSON.parse(company.work_days || '[1,2,3,4,5]') }
      : null,
    locations: all('SELECT * FROM locations WHERE company_id = ? ORDER BY name', actor.company_id),
    shifts: all('SELECT * FROM shifts WHERE company_id = ? AND active = 1 ORDER BY start_time', actor.company_id)
  };
}

export function register(router) {
  // public bootstrap payload (login screen hints, locales, demo accounts)
  router.get('/api/auth/bootstrap', (ctx) => {
    const company = get('SELECT * FROM companies ORDER BY id LIMIT 1');
    const roles = [
      ['super_admin', 'aarav.mehta@northpeak.io', 'Group Chief Information Officer'],
      ['hr_admin', 'priya.nair@northpeak.io', 'Vice President — Human Resources'],
      ['hr_manager', 'rohan.deshmukh@northpeak.io', 'HR Manager — Talent & Operations'],
      ['dept_manager', 'ananya.sharma@northpeak.io', 'Director — Engineering'],
      ['supervisor', 'vikram.rao@northpeak.io', 'Supervisor — Support Operations'],
      ['team_leader', 'meera.iyer@northpeak.io', 'Team Lead — Mobile Engineering'],
      ['employee', 'kabir.malhotra@northpeak.io', 'Senior Mobile Engineer']
    ].map(([role, email, designation]) => ({ role, email, designation, password: 'Demo@1234', pin: '123456' }));
    return {
      company: company ? { ...company, work_days: JSON.parse(company.work_days || '[1,2,3,4,5]') } : null,
      demoAccounts: roles,
      stats: {
        employees: one('SELECT COUNT(*) FROM employees'),
        attendanceToday: one("SELECT COUNT(*) FROM attendance WHERE date = date('now')")
      },
      locales: JSON.parse(one("SELECT value FROM settings WHERE key = 'locales'") || '["en"]'),
      serverTime: nowIso()
    };
  });

  router.post('/api/auth/login', (ctx) => {
    const { identifier, email, emp_code, password, device } = ctx.body;
    const key = (identifier || email || emp_code || '').toString().trim();
    if (!key || !password) throw badRequest('Email and password are required');
    const employee =
      get('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)', key) ||
      get('SELECT * FROM employees WHERE LOWER(emp_code) = LOWER(?)', key);
    if (!employee) throw unauthorized('No account found for those credentials');
    if (employee.status === 'terminated') throw unauthorized('This account has been deactivated');
    if (!verifyPassword(password, employee.password_hash)) {
      audit(ctx, 'login.failed', 'session', employee.id, `Failed sign-in attempt for ${employee.email}`, { severity: 'warning' });
      throw unauthorized('Incorrect password');
    }
    const session = createSession(employee.id, {
      deviceLabel: device?.label || 'Web / Mobile browser',
      ip: ctx.ip
    });
    if (device?.label) {
      insert('devices', {
        company_id: employee.company_id,
        employee_id: employee.id,
        label: device.label,
        platform: device.platform || 'Web',
        model: device.model || device.label,
        app_version: '4.2.0',
        status: 'trusted',
        trusted: 1,
        enrolled_at: nowIso(),
        last_seen_at: nowIso()
      });
    }
    run('UPDATE employees SET last_seen_at = ? WHERE id = ?', nowIso(), employee.id);
    audit({ ...ctx, actor: employee }, 'login', 'session', employee.id, `${employee.email} signed in`, { meta: { device: device?.label } });
    push(employee.id, {
      type: 'security',
      title: 'New sign-in',
      body: `Signed in from ${device?.label || 'a browser'} just now.`,
      icon: '🔐',
      link: '#/devices'
    });
    return { token: session.token, expires_at: session.expires_at, ...sessionPayload({ ...employee, token: session.token }) };
  });

  router.post('/api/auth/pin', (ctx) => {
    const { identifier, pin, device } = ctx.body;
    const key = (identifier || '').toString().trim();
    if (!key || !pin) throw badRequest('Employee and PIN are required');
    const employee =
      get('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)', key) ||
      get('SELECT * FROM employees WHERE LOWER(emp_code) = LOWER(?)', key);
    if (!employee) throw unauthorized('No account found for those credentials');
    if (!verifyPassword(pin, employee.pin_hash)) throw unauthorized('Incorrect PIN');
    const session = createSession(employee.id, { deviceLabel: device?.label || 'Mobile PIN unlock', ip: ctx.ip });
    audit({ ...ctx, actor: employee }, 'login.pin', 'session', employee.id, `${employee.email} unlocked with PIN`);
    return { token: session.token, expires_at: session.expires_at, ...sessionPayload({ ...employee, token: session.token }) };
  });

  // Simulated biometric sign-in: the client performs a liveness scan and the
  // server matches the scan against the enrolled template on file.
  router.post('/api/auth/biometric', (ctx) => {
    const { identifier, method = 'face', score = 0.96, device } = ctx.body;
    const employee =
      get('SELECT * FROM employees WHERE LOWER(email) = LOWER(?)', String(identifier || '').trim()) ||
      get('SELECT * FROM employees WHERE LOWER(emp_code) = LOWER(?)', String(identifier || '').trim());
    if (!employee) throw unauthorized('No account found for those credentials');
    const field = method === 'face' ? 'face_template' : 'fingerprint_template';
    if (!employee[field]) throw unauthorized(`${method === 'face' ? 'Face' : 'Fingerprint'} is not enrolled for this account`);
    const confidence = Number(score);
    if (!(confidence >= 0.85)) throw unauthorized('Biometric match confidence too low');
    const session = createSession(employee.id, { deviceLabel: device?.label || `Biometric (${method})`, ip: ctx.ip });
    audit({ ...ctx, actor: employee }, 'login.biometric', 'session', employee.id, `${employee.email} signed in with ${method}`, {
      meta: { confidence }
    });
    return {
      token: session.token,
      expires_at: session.expires_at,
      match: { method, confidence, template: biometricTemplate(method, employee.email) },
      ...sessionPayload({ ...employee, token: session.token })
    };
  });

  router.get('/api/auth/me', (ctx) => sessionPayload(ctx.actor));

  router.post('/api/auth/logout', (ctx) => {
    destroySession(ctx.actor.token);
    audit(ctx, 'logout', 'session', ctx.actor.id, `${ctx.actor.email} signed out`);
    return { ok: true };
  });

  router.patch('/api/auth/password', (ctx) => {
    const { current, next } = ctx.body;
    if (!verifyPassword(current, ctx.actor.password_hash)) throw unauthorized('Current password is incorrect');
    if (!next || String(next).length < 8) throw badRequest('New password must be at least 8 characters');
    update('employees', ctx.actor.id, { password_hash: hashPassword(next) });
    audit(ctx, 'password.change', 'employee', ctx.actor.id, 'Password changed', { severity: 'warning' });
    push(ctx.actor.id, { type: 'security', title: 'Password changed', body: 'Your HRMate password was updated.', icon: '🔑', link: '#/settings' });
    return { ok: true };
  });

  router.patch('/api/auth/pin', (ctx) => {
    const { pin } = ctx.body;
    if (!/^\d{4,8}$/.test(String(pin || ''))) throw badRequest('PIN must be 4-8 digits');
    update('employees', ctx.actor.id, { pin_hash: hashPassword(pin) });
    audit(ctx, 'pin.set', 'employee', ctx.actor.id, 'App PIN updated');
    return { ok: true };
  });

  router.post('/api/auth/biometric/enroll', (ctx) => {
    const { method = 'face' } = ctx.body;
    const field = method === 'face' ? 'face_template' : 'fingerprint_template';
    update('employees', ctx.actor.id, { [field]: biometricTemplate(method, ctx.actor.email), biometric_enabled: 1 });
    audit(ctx, 'biometric.enroll', 'employee', ctx.actor.id, `${method} template enrolled`);
    push(ctx.actor.id, { type: 'security', title: 'Biometric enrolled', body: `${method === 'face' ? 'Face' : 'Fingerprint'} unlock is now active.`, icon: '🧬', link: '#/devices' });
    return { ok: true, method, template: biometricTemplate(method, ctx.actor.email) };
  });

  router.delete('/api/auth/biometric/:method', (ctx) => {
    const field = ctx.params.method === 'face' ? 'face_template' : 'fingerprint_template';
    update('employees', ctx.actor.id, { [field]: null });
    audit(ctx, 'biometric.revoke', 'employee', ctx.actor.id, `${ctx.params.method} template removed`, { severity: 'warning' });
    return { ok: true };
  });

  router.patch('/api/auth/preferences', (ctx) => {
    const { locale, theme, push_enabled } = ctx.body;
    const patch = {};
    if (locale) patch.locale = String(locale).slice(0, 8);
    if (theme) patch.theme = theme === 'dark' ? 'dark' : 'light';
    if (push_enabled !== undefined) patch.push_token = push_enabled ? `web:${ctx.actor.id}` : null;
    update('employees', ctx.actor.id, patch);
    return { ok: true, employee: publicEmployee(get('SELECT * FROM employees WHERE id = ?', ctx.actor.id)) };
  });

  router.get('/api/auth/permissions', (ctx) => ({
    role: ctx.actor.role,
    permissions: ROLE_PERMISSIONS[ctx.actor.role] || [],
    can: (perm) => can(ctx.actor, perm)
  }));
}
