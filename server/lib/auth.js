import crypto from 'node:crypto';
import { all, get, insert, run, update } from './db.js';
import { nowIso, uid, unauthorized, forbidden, notFound } from './http.js';
import { can, levelOf, roleMeta } from './rbac.js';

const SESSION_TTL_HOURS = 24 * 14;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, digest] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const derived = crypto.scryptSync(String(password), salt, 32);
  const expected = Buffer.from(digest, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// A "template" for the simulated biometrics: deterministic digest of a secret so
// re-verification matches without storing anything reversible.
export function biometricTemplate(kind, secret) {
  return crypto.createHash('sha256').update(`${kind}:${secret}`).digest('hex').slice(0, 48);
}

export function createSession(employeeId, meta = {}) {
  const token = uid(32);
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  insert('sessions', {
    token,
    employee_id: employeeId,
    device_label: meta.deviceLabel || 'Web / Mobile browser',
    ip: meta.ip || null,
    expires_at: expires
  });
  return { token, expires_at: expires };
}

export function destroySession(token) {
  run('DELETE FROM sessions WHERE token = ?', token);
}

export function loadActor(req) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    const cookie = req.headers.cookie || '';
    const m = cookie.match(/hrmate_token=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }
  if (!token) return null;
  const session = get('SELECT * FROM sessions WHERE token = ?', token);
  if (!session) return null;
  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  const employee = get('SELECT * FROM employees WHERE id = ?', session.employee_id);
  if (!employee || employee.status === 'terminated') return null;
  run('UPDATE employees SET last_seen_at = ? WHERE id = ?', nowIso(), employee.id);
  return { ...employee, token };
}

export function requireActor(ctx) {
  if (!ctx.actor) throw unauthorized();
  return ctx.actor;
}

export function requirePerm(ctx, perm) {
  const actor = requireActor(ctx);
  if (!can(actor, perm)) throw forbidden(`Missing permission: ${perm}`);
  return actor;
}

export function requireLevel(ctx, role) {
  const actor = requireActor(ctx);
  if (levelOf(actor.role) < levelOf(role)) throw forbidden('Insufficient role level');
  return actor;
}

export function sessionsFor(employeeId) {
  return all('SELECT * FROM sessions WHERE employee_id = ? ORDER BY created_at DESC', employeeId);
}

export function publicEmployee(e) {
  if (!e) return null;
  const { password_hash, pin_hash, face_template, fingerprint_template, ...rest } = e;
  return {
    ...rest,
    full_name: [e.first_name, e.last_name].filter(Boolean).join(' '),
    role_label: roleMeta(e.role).label,
    has_pin: !!pin_hash,
    biometric_enrolled: !!face_template || !!fingerprint_template,
    skills: safeParse(e.skills, []),
    manager: e.manager_id ? get('SELECT id, first_name, last_name, designation, role FROM employees WHERE id = ?', e.manager_id) : null
  };
}

export function safeParse(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export { can, levelOf, roleMeta };
