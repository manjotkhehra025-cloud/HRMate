// ---------------------------------------------------------------------------
// HRMate — persistent data layer (SQLite via node:sqlite, zero dependencies)
// ---------------------------------------------------------------------------
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
export const DATA_DIR = process.env.HRMATE_DATA_DIR || path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = process.env.HRMATE_DB || path.join(DATA_DIR, 'hrmate.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const inMemory = DB_FILE === ':memory:';
export const db = new DatabaseSync(inMemory ? ':memory:' : DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

// --- helpers ---------------------------------------------------------------
const clean = (v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
};

export function run(sql, ...params) {
  return db.prepare(sql).run(...params.map(clean));
}
export function get(sql, ...params) {
  const row = db.prepare(sql).get(...params.map(clean));
  return row ? { ...row } : null;
}
export function all(sql, ...params) {
  return db.prepare(sql).all(...params.map(clean)).map((r) => ({ ...r }));
}
export function one(sql, ...params) {
  const row = get(sql, ...params);
  if (!row) return null;
  const values = Object.values(row);
  return values.length === 1 ? values[0] : row;
}
/**
 * node:sqlite can only bind primitives — arrays/objects would throw
 * "Unknown named parameter". JSON-encode them so callers can pass tags,
 * strengths, payload objects and friends straight through.
 */
const bind = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);

export function insert(table, data) {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  const cols = keys.join(', ');
  const marks = keys.map(() => '?').join(', ');
  const info = run(`INSERT INTO ${table} (${cols}) VALUES (${marks})`, ...keys.map((k) => bind(data[k])));
  return Number(info.lastInsertRowid);
}
export function update(table, id, data) {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (!keys.length) return 0;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const info = run(`UPDATE ${table} SET ${sets} WHERE id = ?`, ...keys.map((k) => bind(data[k])), id);
  return Number(info.changes);
}
export function del(table, id) {
  const info = run(`DELETE FROM ${table} WHERE id = ?`, id);
  return Number(info.changes) > 0;
}
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  }
}

// --- schema ----------------------------------------------------------------
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, logo_emoji TEXT, industry TEXT,
  timezone TEXT, week_start INTEGER DEFAULT 1, work_hours_per_day REAL DEFAULT 8,
  work_days TEXT DEFAULT '[1,2,3,4,5]', currency TEXT DEFAULT 'INR',
  punch_radius_m INTEGER DEFAULT 200, allow_remote_punch INTEGER DEFAULT 1,
  overtime_enabled INTEGER DEFAULT 1, late_grace_min INTEGER DEFAULT 10,
  plan TEXT DEFAULT 'enterprise', created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT, parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  head_employee_id INTEGER, color TEXT, icon TEXT, budget REAL,
  description TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, address TEXT, city TEXT, country TEXT,
  latitude REAL, longitude REAL, radius_m INTEGER DEFAULT 200,
  type TEXT DEFAULT 'office', active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  emp_code TEXT UNIQUE, first_name TEXT NOT NULL, last_name TEXT,
  email TEXT UNIQUE, phone TEXT, password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'employee', designation TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  employment_type TEXT DEFAULT 'full_time', status TEXT DEFAULT 'active',
  join_date TEXT, exit_date TEXT, date_of_birth TEXT, gender TEXT,
  address TEXT, city TEXT, emergency_contact TEXT, emergency_phone TEXT,
  salary REAL, currency TEXT DEFAULT 'INR', shift_id INTEGER,
  avatar_color TEXT, avatar_emoji TEXT, bio TEXT, skills TEXT,
  bank_account TEXT, tax_id TEXT, work_mode TEXT DEFAULT 'onsite',
  probation_end TEXT, notice_period_days INTEGER DEFAULT 60,
  pin_hash TEXT, face_template TEXT, fingerprint_template TEXT,
  biometric_enabled INTEGER DEFAULT 0, push_token TEXT, locale TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'light', last_seen_at TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  device_label TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT, start_time TEXT, end_time TEXT,
  break_minutes INTEGER DEFAULT 30, color TEXT, days TEXT, grace_min INTEGER DEFAULT 10,
  work_hours REAL, overnight INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
  description TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roster (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  date TEXT NOT NULL, kind TEXT DEFAULT 'work', note TEXT, published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')), UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS leave_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT, color TEXT, icon TEXT,
  annual_quota REAL DEFAULT 0, carry_forward REAL DEFAULT 0,
  paid INTEGER DEFAULT 1, requires_proof INTEGER DEFAULT 0,
  min_notice_days INTEGER DEFAULT 0, max_days_per_request INTEGER DEFAULT 0,
  applies_to TEXT DEFAULT 'all', active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL, entitled REAL DEFAULT 0, used REAL DEFAULT 0, pending REAL DEFAULT 0,
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, days REAL NOT NULL,
  half_day INTEGER DEFAULT 0, reason TEXT, status TEXT DEFAULT 'pending',
  approver_id INTEGER, proof_url TEXT, decided_at TEXT, decision_note TEXT,
  cancel_requested INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL, shift_id INTEGER,
  first_in TEXT, last_out TEXT,
  work_minutes REAL DEFAULT 0, ot_minutes REAL DEFAULT 0, break_minutes REAL DEFAULT 0,
  late_minutes INTEGER DEFAULT 0, status TEXT DEFAULT 'absent',
  in_method TEXT, out_method TEXT,
  in_lat REAL, in_lng REAL, in_accuracy REAL, in_location_id INTEGER,
  out_lat REAL, out_lng REAL, out_accuracy REAL, out_location_id INTEGER,
  geofence_ok INTEGER DEFAULT 1, notes TEXT, regularized INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS punches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_id INTEGER REFERENCES attendance(id) ON DELETE CASCADE,
  type TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')),
  method TEXT DEFAULT 'manual', lat REAL, lng REAL, accuracy REAL,
  distance_m REAL, geofence_ok INTEGER DEFAULT 1, device_id INTEGER,
  selfie_url TEXT, face_score REAL, fingerprint_score REAL, ip TEXT, note TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL, title TEXT NOT NULL, doc_type TEXT DEFAULT 'pdf',
  file_name TEXT, file_url TEXT, size_kb INTEGER, uploaded_by INTEGER,
  issue_date TEXT, expiry_date TEXT, verified INTEGER DEFAULT 0,
  verified_by INTEGER, verified_at TEXT, verification_note TEXT,
  status TEXT DEFAULT 'pending', tags TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kyc_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL, status TEXT DEFAULT 'pending', score INTEGER,
  submitted_at TEXT, reviewed_by INTEGER, reviewed_at TEXT, note TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, category TEXT DEFAULT 'business',
  weight INTEGER DEFAULT 25, progress INTEGER DEFAULT 0, status TEXT DEFAULT 'on_track',
  start_date TEXT, due_date TEXT, owner_id INTEGER, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS key_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL, metric TEXT, target REAL DEFAULT 100, current REAL DEFAULT 0,
  unit TEXT DEFAULT '%', due_date TEXT, status TEXT DEFAULT 'on_track', updated_at TEXT
);

CREATE TABLE IF NOT EXISTS review_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, period TEXT, start_date TEXT, end_date TEXT,
  status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_id INTEGER REFERENCES review_cycles(id) ON DELETE SET NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id INTEGER, rating REAL, potential INTEGER,
  productivity INTEGER DEFAULT 0, quality INTEGER DEFAULT 0, teamwork INTEGER DEFAULT 0,
  initiative INTEGER DEFAULT 0, reliability INTEGER DEFAULT 0,
  strengths TEXT, improvements TEXT, summary TEXT,
  status TEXT DEFAULT 'draft', self_rating REAL, ack INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT, category TEXT DEFAULT 'general',
  audience TEXT DEFAULT 'all', pinned INTEGER DEFAULT 0, priority TEXT DEFAULT 'normal',
  author_id INTEGER, publish_at TEXT, expires_at TEXT, views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  body TEXT, image_url TEXT, tag TEXT DEFAULT 'general',
  likes INTEGER DEFAULT 0, comments_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (post_id, employee_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  body TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kudos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  to_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  value TEXT NOT NULL, message TEXT, points INTEGER DEFAULT 5,
  badge TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assignee_id INTEGER, subject TEXT NOT NULL, body TEXT,
  category TEXT DEFAULT 'it', priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open', due_date TEXT, resolved_at TEXT, rating INTEGER,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  label TEXT, platform TEXT, model TEXT, app_version TEXT,
  status TEXT DEFAULT 'pending', trusted INTEGER DEFAULT 0,
  fingerprint_enrolled INTEGER DEFAULT 0, face_enrolled INTEGER DEFAULT 0,
  last_lat REAL, last_lng REAL, last_seen_at TEXT, enrolled_at TEXT,
  revoked_at TEXT, revoked_reason TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT,
  icon TEXT, link TEXT, payload TEXT, read INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal', created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL, ref_id INTEGER NOT NULL,
  requester_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  approver_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  summary TEXT, status TEXT DEFAULT 'pending', priority TEXT DEFAULT 'normal',
  decided_at TEXT, decision_note TEXT, created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(type, ref_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  actor_id INTEGER, actor_name TEXT, action TEXT NOT NULL, entity TEXT,
  entity_id INTEGER, summary TEXT, meta TEXT, ip TEXT,
  severity TEXT DEFAULT 'info', created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, date TEXT NOT NULL, type TEXT DEFAULT 'public',
  applies_to TEXT DEFAULT 'all', optional INTEGER DEFAULT 0, color TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, date TEXT NOT NULL, start_time TEXT,
  end_time TEXT, all_day INTEGER DEFAULT 0, kind TEXT DEFAULT 'meeting',
  location TEXT, organizer_id INTEGER, color TEXT, attendees TEXT
);

CREATE TABLE IF NOT EXISTS swap_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  with_employee_id INTEGER, date TEXT NOT NULL, shift_id INTEGER,
  reason TEXT, status TEXT DEFAULT 'pending', decided_at TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS overtime_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL, minutes REAL NOT NULL, reason TEXT,
  status TEXT DEFAULT 'pending', approver_id INTEGER, decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT, amount REAL NOT NULL, currency TEXT DEFAULT 'INR',
  date TEXT, receipt_url TEXT, description TEXT,
  status TEXT DEFAULT 'pending', approver_id INTEGER, decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON attendance(company_id, date);
CREATE INDEX IF NOT EXISTS idx_punches_emp ON punches(employee_id, at);
CREATE INDEX IF NOT EXISTS idx_roster_emp_date ON roster(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_emp ON leave_requests(employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_notif_emp ON notifications(employee_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`;

export function migrate() {
  // `tickets` is referenced by comments() FK — create order matters, so define
  // tickets before comments inside SCHEMA execution by splitting safely.
  db.exec(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    assignee_id INTEGER, subject TEXT NOT NULL, body TEXT,
    category TEXT DEFAULT 'it', priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open', due_date TEXT, resolved_at TEXT, rating INTEGER,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );`);
  db.exec(SCHEMA);
}

export function isSeeded() {
  return one('SELECT COUNT(*) FROM companies') > 0;
}

export function dbStats() {
  const tables = all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
  const out = {};
  for (const t of tables) out[t.name] = one(`SELECT COUNT(*) FROM ${t.name}`);
  return out;
}
