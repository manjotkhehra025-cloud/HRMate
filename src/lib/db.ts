import path from "path";
import fs from "fs";
import { createRequire } from "node:module";
import { hashPassword, randomId } from "./crypto";

// ---------------------------------------------------------------------------
// IMPORTANT: better-sqlite3 is a native C++ addon. It is loaded LAZILY (only
// when the first real DB query runs) so that `next build` — which imports our
// pages to collect page data — never loads the native module in the build
// worker. Loading better-sqlite3 at module scope caused a native SIGSEGV in
// the "Collecting page data" build phase.
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url);

type DatabaseLike = {
  prepare: (sql: string) => any;
  pragma: (sql: string) => any;
  exec: (sql: string) => any;
  transaction: (fn: (...args: any[]) => any) => any;
  [key: string]: any;
};

const globalForDb = globalThis as typeof globalThis & { __hrmateDb?: DatabaseLike };

function getDb(): DatabaseLike {
  if (globalForDb.__hrmateDb) return globalForDb.__hrmateDb;
  const Database = require("better-sqlite3");
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.HRMATE_DB || path.join(dataDir, "hrmate.db");
  const db = new Database(dbPath) as DatabaseLike;
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  ensureSchema(db);
  seed(db);
  seedFactoryDefaults(db);
  seedShiftsAndLeave(db);
  seedHolidays(db);
  seedKraTemplates(db);
  globalForDb.__hrmateDb = db;
  startJobsSafe();
  return db;
}

function startJobsSafe() {
  if (process.env.NEXT_PHASE) return;
  if (process.env.NEXT_RUNTIME === "edge") return;
  import("./jobs")
    .then((m) => m.startScheduler())
    .catch((e) => console.error("[hrmate jobs] start failed", e));
}

// Default export is a Proxy so all existing `db.prepare(...)` call sites keep
// working, while the underlying database is created on first use.
const db = new Proxy({} as DatabaseLike, {
  get(_target, prop: string | symbol) {
    const real = getDb();
    const val = real[prop as any];
    return typeof val === "function" ? val.bind(real) : val;
  },
  set(_target, prop: string | symbol, value) {
    const real = getDb();
    real[prop as any] = value;
    return true;
  },
});

function migrate(d: DatabaseLike) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    department TEXT DEFAULT '',
    designation TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    color TEXT DEFAULT '#6366f1',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen INTEGER
  );
  CREATE TABLE IF NOT EXISTS user_permissions (
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL,
    granted INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, permission)
  );
  CREATE TABLE IF NOT EXISTS passkey_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT DEFAULT '',
    device_name TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    punch_in_at INTEGER,
    punch_in_lat REAL,
    punch_in_lng REAL,
    punch_in_geofence INTEGER,
    punch_out_at INTEGER,
    punch_out_lat REAL,
    punch_out_lng REAL,
    punch_out_geofence INTEGER,
    notes TEXT DEFAULT '',
    UNIQUE(user_id, date)
  );
  CREATE TABLE IF NOT EXISTS manual_punch_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    time TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    reviewed_note TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leave_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    days_per_year INTEGER NOT NULL,
    color TEXT DEFAULT '#6366f1',
    sort INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    leave_type_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    reviewed_note TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wall_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wall_likes (
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS wall_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, endpoint)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    type TEXT DEFAULT 'info',
    read INTEGER DEFAULT 0,
    link TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_wall_posts ON wall_posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
  `);
}

function hasColumn(d: DatabaseLike, table: string, column: string): boolean {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/** Additive tables/columns for existing production DBs. Never drops data. */
function ensureSchema(d: DatabaseLike) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS user_prefs (
    user_id TEXT PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'en',
    appearance TEXT NOT NULL DEFAULT 'system',
    text_size TEXT NOT NULL DEFAULT 'medium',
    notify_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    hours REAL NOT NULL DEFAULT 8,
    auto_pick TEXT NOT NULL DEFAULT 'none',
    sort INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS device_biometrics (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_info TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_device_biometrics_user ON device_biometrics(user_id);
  `);
  if (!hasColumn(d, "attendance", "shift_id")) {
    d.exec(`ALTER TABLE attendance ADD COLUMN shift_id TEXT`);
  }
  if (!hasColumn(d, "users", "staff_type")) {
    d.exec(`ALTER TABLE users ADD COLUMN staff_type TEXT NOT NULL DEFAULT 'official'`);
  }
  if (!hasColumn(d, "users", "manager_scope")) {
    d.exec(`ALTER TABLE users ADD COLUMN manager_scope TEXT NOT NULL DEFAULT ''`);
  }
  if (!hasColumn(d, "users", "avatar")) {
    d.exec(`ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''`);
  }
  d.exec(`
  CREATE TABLE IF NOT EXISTS leave_balances (
    user_id TEXT NOT NULL,
    leave_type_id TEXT NOT NULL,
    extra_days REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, leave_type_id)
  );
  CREATE TABLE IF NOT EXISTS change_requests (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    reviewed_note TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
  `);
  if (!hasColumn(d, "manual_punch_requests", "stage")) {
    d.exec(`ALTER TABLE manual_punch_requests ADD COLUMN stage TEXT NOT NULL DEFAULT 'final'`);
  }
  if (!hasColumn(d, "leave_types", "reset_period")) {
    d.exec(`ALTER TABLE leave_types ADD COLUMN reset_period TEXT NOT NULL DEFAULT 'year'`);
  }
  d.prepare(
    `UPDATE leave_types SET days_per_year = 2, reset_period = 'month' WHERE id = 'lt_short'`
  ).run();
  if (!hasColumn(d, "users", "weekly_off")) {
    d.exec(`ALTER TABLE users ADD COLUMN weekly_off INTEGER NOT NULL DEFAULT 6`);
    d.prepare(`UPDATE users SET weekly_off = 0 WHERE role = 'super_admin'`).run();
  }
  if (!hasColumn(d, "attendance", "comp_off_credited")) {
    d.exec(`ALTER TABLE attendance ADD COLUMN comp_off_credited INTEGER NOT NULL DEFAULT 0`);
  }
  d.exec(`
  CREATE TABLE IF NOT EXISTS missed_days (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    deadline TEXT NOT NULL,
    notified_at INTEGER NOT NULL DEFAULT 0,
    auto_absent_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );
  CREATE TABLE IF NOT EXISTS overtime_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    hours REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approver_id TEXT,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    reviewed_note TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gate_passes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'duty',
    time_out TEXT NOT NULL,
    time_in TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approver_id TEXT,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    reviewed_note TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'public_holiday',
    is_off INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    color TEXT DEFAULT '#1E6FE0',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kra_templates (
    id TEXT PRIMARY KEY,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    weightage INTEGER NOT NULL DEFAULT 20,
    target_metric TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_kras (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    period TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    weightage INTEGER NOT NULL DEFAULT 20,
    target_metric TEXT NOT NULL,
    self_score REAL DEFAULT NULL,
    self_remarks TEXT DEFAULT '',
    manager_score REAL DEFAULT NULL,
    manager_remarks TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shift_rosters (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shift_id TEXT NOT NULL,
    date TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, date)
  );
  CREATE TABLE IF NOT EXISTS shift_swap_requests (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    requester_date TEXT NOT NULL,
    requester_shift_id TEXT NOT NULL,
    target_date TEXT NOT NULL,
    target_shift_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    peer_status TEXT NOT NULL DEFAULT 'pending',
    manager_status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    resolution_note TEXT DEFAULT '',
    resolved_by TEXT,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    doc_number TEXT DEFAULT '',
    file_url TEXT,
    uploaded_by TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS worker_awards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    award_type TEXT NOT NULL,
    period TEXT NOT NULL,
    title TEXT NOT NULL,
    citation TEXT NOT NULL,
    awarded_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
  CREATE INDEX IF NOT EXISTS idx_holidays_off ON holidays(is_off);
  CREATE INDEX IF NOT EXISTS idx_ot_user ON overtime_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_gate_user ON gate_passes(user_id);
  CREATE INDEX IF NOT EXISTS idx_kra_user ON user_kras(user_id);
  CREATE INDEX IF NOT EXISTS idx_roster_user_date ON shift_rosters(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_tickets_user ON helpdesk_tickets(user_id);
  CREATE INDEX IF NOT EXISTS idx_docs_user ON employee_documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_awards_user ON worker_awards(user_id);
  `);
  if (!hasColumn(d, "users", "emp_code")) {
    d.exec(`ALTER TABLE users ADD COLUMN emp_code TEXT NOT NULL DEFAULT ''`);
  }
  d.prepare(`UPDATE users SET emp_code = 'NS000001' WHERE (emp_code IS NULL OR emp_code = '') AND role = 'super_admin'`).run();
  if (!hasColumn(d, "users", "blood_group")) {
    d.exec(`ALTER TABLE users ADD COLUMN blood_group TEXT NOT NULL DEFAULT 'A+'`);
  }
  if (!hasColumn(d, "users", "emergency_contact")) {
    d.exec(`ALTER TABLE users ADD COLUMN emergency_contact TEXT NOT NULL DEFAULT ''`);
  }
  if (!hasColumn(d, "users", "doj")) {
    d.exec(`ALTER TABLE users ADD COLUMN doj TEXT NOT NULL DEFAULT ''`);
  }
  if (!hasColumn(d, "users", "dob")) {
    d.exec(`ALTER TABLE users ADD COLUMN dob TEXT NOT NULL DEFAULT ''`);
  }
  if (!hasColumn(d, "users", "shift_id")) {
    d.exec(`ALTER TABLE users ADD COLUMN shift_id TEXT NOT NULL DEFAULT 'sh_general_day'`);
  }
  if (!hasColumn(d, "sessions", "last_seen")) {
    d.exec(`ALTER TABLE sessions ADD COLUMN last_seen INTEGER`);
  }
  if (!hasColumn(d, "leave_requests", "approver_id")) {
    d.exec(`ALTER TABLE leave_requests ADD COLUMN approver_id TEXT`);
  }
  if (!hasColumn(d, "manual_punch_requests", "approver_id")) {
    d.exec(`ALTER TABLE manual_punch_requests ADD COLUMN approver_id TEXT`);
  }
}

function seed(d: DatabaseLike) {
  const count = d.prepare("SELECT COUNT(*) AS c FROM users").get() as any;
  if (count.c > 0) return;

  const now = Date.now();
  const insertUser = d.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, department, designation, color, created_at)
     VALUES (@id, @email, @password_hash, @name, @role, @department, @designation, @color, @created_at)`
  );

  // Only the bootstrap super-admin account is seeded. No demo users, wall
  // posts, comments or likes are created — the workspace starts clean.
  const admin = {
    id: randomId("u_"),
    email: "admin@hrmate.com",
    password_hash: hashPassword("admin123"),
    name: "Super Admin",
    role: "super_admin",
    department: "Management",
    designation: "Super Admin",
    color: "#1E6FE0",
  };
  insertUser.run({ ...admin, created_at: now });
  d.prepare(`UPDATE users SET weekly_off = 0 WHERE id = ?`).run(admin.id);

  const insertLeave = d.prepare(
    `INSERT INTO leave_types (id, name, days_per_year, color, sort) VALUES (?, ?, ?, ?, ?)`
  );
  insertLeave.run("lt_casual", "Casual Leave", 12, "#6366f1", 1);
  insertLeave.run("lt_sick", "Sick Leave", 10, "#ef4444", 2);
  insertLeave.run("lt_earned", "Earned Leave", 15, "#10b981", 3);
  insertLeave.run("lt_optional", "Optional Holiday", 3, "#f59e0b", 4);
}

/** Fill missing keys only — never overwrite a saved factory location. */
function seedFactoryDefaults(d: DatabaseLike) {
  const setSetting = d.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  setSetting.run("factory_name", "GD Foods Mfg. (I) Pvt. Ltd.");
  setSetting.run("factory_lat", "31.4286");
  setSetting.run("factory_lng", "75.1481");
  setSetting.run("factory_radius", "250");
  setSetting.run("factory_address", "Khadur Sahib, Khadur Sahib Tahsil, Tarn Taran, Punjab, 143117, India");
  setSetting.run("brand_name", "Tops");
  setSetting.run(
    "office_address",
    "4th Floor, Novotel City Centre Hotel, Plot No. 1, Community Centre, DB Gupta Road, Motia Khan, Jhandewalan, New Delhi - 110055"
  );
  setSetting.run("office_phone", "+91-11-45233333");
  setSetting.run("office_email", "response@tops.in");
  setSetting.run("work_start", "08:00");
  setSetting.run("work_end", "17:00");
}

function seedShiftsAndLeave(d: DatabaseLike) {
  const leave = d.prepare(
    `INSERT OR IGNORE INTO leave_types (id, name, days_per_year, color, sort) VALUES (?, ?, ?, ?, ?)`
  );
  leave.run("lt_casual", "Casual Leave", 12, "#6366f1", 1);
  leave.run("lt_sick", "Sick Leave", 10, "#ef4444", 2);
  leave.run("lt_earned", "Earned Leave", 15, "#10b981", 3);
  leave.run("lt_optional", "Optional Holiday", 3, "#f59e0b", 4);
  leave.run("lt_comp", "Compensatory off", 0, "#8b5cf6", 5);
  leave.run("lt_short", "Short leave", 2, "#06b6d4", 6);
  d.prepare(`UPDATE leave_types SET days_per_year = 2, reset_period = 'month' WHERE id = 'lt_short'`).run();

  const shift = d.prepare(
    `INSERT OR IGNORE INTO shifts (id, name, start_time, hours, auto_pick, sort) VALUES (?, ?, ?, ?, ?, ?)`
  );
  shift.run("sh_general_day", "General Day Shift", "08:00", 9, "morning", 1);
  shift.run("sh_night", "Night Shift", "19:00", 12, "evening", 2);
  shift.run("sh_season_day", "Season Day Shift", "07:00", 12, "morning", 3);

  // Permanently configure the 3 core shifts
  try {
    const upsertShift = d.prepare(
      `INSERT INTO shifts (id, name, start_time, hours, auto_pick, sort)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, start_time = excluded.start_time, hours = excluded.hours, sort = excluded.sort`
    );
    upsertShift.run("sh_general_day", "General Day Shift", "08:00", 9, "morning", 1);
    upsertShift.run("sh_night", "Night Shift", "19:00", 12, "evening", 2);
    upsertShift.run("sh_season_day", "Season Day Shift", "07:00", 12, "morning", 3);
  } catch {}
}

function seedHolidays(d: DatabaseLike) {
  const now = Date.now();
  const upsertHoliday = d.prepare(
    `INSERT INTO holidays (id, title, date, type, is_off, description, color, created_at)
     VALUES (@id, @title, @date, @type, @is_off, @description, @color, @created_at)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       date = excluded.date,
       type = excluded.type,
       is_off = excluded.is_off,
       description = excluded.description,
       color = excluded.color`
  );

  // GD Foods Mfg. (I) Pvt. Ltd. — Khadur Sahib Unit — Official 2026 Holidays (Eligibility: 11 Days)
  const KHADUR_SAHIB_HOLIDAYS_2026 = [
    { id: "hol_2026_01", title: "New Year", date: "2026-01-01", type: "festival_observance", is_off: 0, description: "New Year Celebration", color: "#3B82F6" },
    { id: "hol_2026_02", title: "Lohri", date: "2026-01-13", type: "public_holiday", is_off: 1, description: "Harvest festival of Punjab (Factory Off)", color: "#F97316" },
    { id: "hol_2026_03", title: "Republic Day", date: "2026-01-26", type: "national_holiday", is_off: 1, description: "National Holiday - Constitution of India (Factory Off)", color: "#EF4444" },
    { id: "hol_2026_04", title: "Holi", date: "2026-03-04", type: "public_holiday", is_off: 1, description: "Festival of Colors (Factory Off)", color: "#EC4899" },
    { id: "hol_2026_05", title: "Ram Navami", date: "2026-03-26", type: "festival_observance", is_off: 0, description: "Birth of Lord Rama", color: "#F59E0B" },
    { id: "hol_2026_06", title: "Baisakhi", date: "2026-04-14", type: "festival_observance", is_off: 0, description: "Harvest Festival", color: "#EAB308" },
    { id: "hol_2026_07", title: "Labour Day", date: "2026-05-01", type: "festival_observance", is_off: 0, description: "International Workers' Day", color: "#64748B" },
    { id: "hol_2026_08", title: "Independence Day", date: "2026-08-15", type: "national_holiday", is_off: 1, description: "National Holiday - 79th Independence Day (Factory Off)", color: "#EF4444" },
    { id: "hol_2026_09", title: "Raksha Bandhan", date: "2026-08-28", type: "public_holiday", is_off: 1, description: "Sibling Festival (Factory Off)", color: "#EC4899" },
    { id: "hol_2026_10", title: "Janmashtami", date: "2026-09-04", type: "public_holiday", is_off: 1, description: "Birth of Lord Krishna (Factory Off)", color: "#3B82F6" },
    { id: "hol_2026_11", title: "Gandhi Jayanti", date: "2026-10-02", type: "national_holiday", is_off: 1, description: "National Holiday - Mahatma Gandhi Birthday (Factory Off)", color: "#10B981" },
    { id: "hol_2026_12", title: "Dussehra", date: "2026-10-20", type: "festival_observance", is_off: 0, description: "Vijayadashami Celebration", color: "#F97316" },
    { id: "hol_2026_13", title: "Diwali (Choti)", date: "2026-11-07", type: "public_holiday", is_off: 1, description: "Festival of Lights (Factory Off)", color: "#F59E0B" },
    { id: "hol_2026_14", title: "Diwali (Badi)", date: "2026-11-08", type: "festival_observance", is_off: 0, description: "Diwali Day (Sunday)", color: "#EAB308" },
    { id: "hol_2026_15", title: "Govardhan Pooja", date: "2026-11-09", type: "public_holiday", is_off: 1, description: "Govardhan Puja (Factory Off)", color: "#1E6FE0" },
    { id: "hol_2026_16", title: "Bhai Dooj", date: "2026-11-11", type: "public_holiday", is_off: 1, description: "Bhai Dooj Celebration (Factory Off)", color: "#EC4899" },
    { id: "hol_2026_17", title: "Guru Nanak Birthday", date: "2026-11-24", type: "public_holiday", is_off: 1, description: "Guru Nanak Dev Ji Parkash Purab (Factory Off)", color: "#F59E0B" },
    { id: "hol_2026_18", title: "Christmas", date: "2026-12-25", type: "festival_observance", is_off: 0, description: "Christmas Day Celebration", color: "#EF4444" },
  ];

  try {
    // Clean up old obsolete IDs beyond the 18 list if needed
    d.exec(`DELETE FROM holidays WHERE id NOT LIKE 'hol_2026_%' OR CAST(SUBSTR(id, 10) AS INTEGER) > 18`);
  } catch {}

  for (const h of KHADUR_SAHIB_HOLIDAYS_2026) {
    upsertHoliday.run({ ...h, created_at: now });
  }
}

function seedKraTemplates(d: DatabaseLike) {
  const count = d.prepare("SELECT COUNT(*) AS c FROM kra_templates").get() as any;
  if (count && count.c > 10) return;

  const now = Date.now();
  const insertTemplate = d.prepare(
    `INSERT OR IGNORE INTO kra_templates (id, department, designation, title, description, weightage, target_metric, created_at)
     VALUES (@id, @department, @designation, @title, @description, @weightage, @target_metric, @created_at)`
  );

  const KRA_TEMPLATES = [
    // 0. Universal Official Staff Attendance KRA (Auto-calculated from biometric attendance)
    {
      id: "kt_official_att",
      department: "General",
      designation: "Official Staff",
      title: "Attendance, Punctuality & Shift Discipline",
      description: "Maintain >= 95% biometric/GPS on-time attendance and prompt shift reporting.",
      weightage: 20,
      target_metric: ">= 95% On-Time Biometric Punch (Auto-Calculated)",
    },
    // 1. Production Department
    {
      id: "kt_prod_01",
      department: "Production",
      designation: "Operator",
      title: "Daily Production Batch Output",
      description: "Deliver assigned batch output in kg/crates per shift without machine stoppage.",
      weightage: 30,
      target_metric: ">= 95% of target shift output",
    },
    {
      id: "kt_prod_02",
      department: "Production",
      designation: "Operator",
      title: "Raw Material & Packaging Wastage Control",
      description: "Minimize product spillage, packaging film rejection and leakage.",
      weightage: 25,
      target_metric: "< 0.5% material wastage per batch",
    },
    {
      id: "kt_prod_03",
      department: "Production",
      designation: "Supervisor",
      title: "Shift Line Efficiency & GMP Compliance",
      description: "Ensure clean line clearance, staff hygiene, and optimal machine utilization.",
      weightage: 25,
      target_metric: "100% GMP audit compliance",
    },
    {
      id: "kt_prod_04",
      department: "Production",
      designation: "Staff",
      title: "Shift Handover & Material Reconciliation",
      description: "Accurate shift closing report, inventory logging, and handover notes.",
      weightage: 20,
      target_metric: "Zero discrepancy in daily closing stock",
    },
    {
      id: "kt_prod_05",
      department: "Production",
      designation: "Helper",
      title: "Floor Cleaning & Sanitation Standard",
      description: "Hourly sanitization of conveyor belts, trays, and work tables.",
      weightage: 25,
      target_metric: "100% clean inspection before each shift",
    },

    // 2. Quality Department (QC, Microbiology, Lab)
    {
      id: "kt_qual_01",
      department: "Quality",
      designation: "QC Chemist",
      title: "In-Process & Finished Product Testing SLA",
      description: "Conduct chemical, brix, acidity, and sensory testing within specified TAT.",
      weightage: 30,
      target_metric: "100% batches tested prior to packing",
    },
    {
      id: "kt_qual_02",
      department: "Quality",
      designation: "Microbiologist",
      title: "Microbiological Sterility & Swab Testing",
      description: "Air, water, surface swabs, and incubation tests for zero contamination.",
      weightage: 30,
      target_metric: "Zero microbial contamination incidents",
    },
    {
      id: "kt_qual_03",
      department: "Quality",
      designation: "Lab Assistant",
      title: "COA Release & FSSAI Record Maintenance",
      description: "Timely Certificate of Analysis logging and regulatory compliance audit trail.",
      weightage: 25,
      target_metric: "100% error-free digital COA records",
    },
    {
      id: "kt_qual_04",
      department: "Quality",
      designation: "Supervisor",
      title: "Customer Quality Complaints Resolution",
      description: "Root-cause analysis (RCA) and corrective actions for any market feedback.",
      weightage: 15,
      target_metric: "Zero market rejection / FSSAI notices",
    },

    // 3. Engineering Department (Electrical, Maintenance)
    {
      id: "kt_eng_01",
      department: "Engineering",
      designation: "Maintenance Engineer",
      title: "Preventive Maintenance (PM) Schedule Adherence",
      description: "Execution of planned weekly and monthly machinery maintenance checklists.",
      weightage: 35,
      target_metric: ">= 98% PM completion rate",
    },
    {
      id: "kt_eng_02",
      department: "Engineering",
      designation: "Electrician",
      title: "Breakdown Response & Downtime Minimization",
      description: "Immediate resolution of motor, panel, conveyor or boiler electrical faults.",
      weightage: 30,
      target_metric: "Mean Time to Repair (MTTR) < 20 minutes",
    },
    {
      id: "kt_eng_03",
      department: "Engineering",
      designation: "Technician",
      title: "Boiler, Compressor & Utility Safety Check",
      description: "Daily pressure, temperature, steam leak checks and logbook maintenance.",
      weightage: 20,
      target_metric: "100% accident-free plant uptime",
    },
    {
      id: "kt_eng_04",
      department: "Engineering",
      designation: "Staff",
      title: "Energy & Fuel Efficiency",
      description: "Monitor electricity consumption, diesel generator load, and boiler fuel burning.",
      weightage: 15,
      target_metric: "5% reduction in auxiliary power loss",
    },

    // 4. Security Department
    {
      id: "kt_sec_01",
      department: "Security",
      designation: "Security Guard",
      title: "100% Inward / Outward Gate Pass Verification",
      description: "Verify physical goods against signed QR gate pass and invoice before release.",
      weightage: 35,
      target_metric: "Zero unauthorized material dispatch",
    },
    {
      id: "kt_sec_02",
      department: "Security",
      designation: "Security Guard",
      title: "Visitor & Contractor Identity Logging",
      description: "Photo capture, phone verification, and visitor pass issuance at main gate.",
      weightage: 30,
      target_metric: "100% logged visitor entries with zero lapses",
    },
    {
      id: "kt_sec_03",
      department: "Security",
      designation: "Security Supervisor",
      title: "Perimeter Patrolling & CCTV Vigilance",
      description: "Scheduled night patrolling rounds and continuous monitoring of factory boundaries.",
      weightage: 20,
      target_metric: "100% CCTV coverage and zero blind spots",
    },
    {
      id: "kt_sec_04",
      department: "Security",
      designation: "Staff",
      title: "Weighbridge & Truck In-Out Turnaround",
      description: "Accurate gross and tare weight logging for incoming raw materials.",
      weightage: 15,
      target_metric: "< 15 mins turnaround time per truck",
    },

    // 5. Agriculture Department
    {
      id: "kt_agri_01",
      department: "Agriculture",
      designation: "Field Officer",
      title: "Raw Crop Grading & Brix Quality Assessment",
      description: "Farm inspection, brix level check, and sorting of incoming agricultural produce.",
      weightage: 35,
      target_metric: ">= 92% Grade-A procurement quality",
    },
    {
      id: "kt_agri_02",
      department: "Agriculture",
      designation: "Supervisor",
      title: "Farmer & Supplier Harvest Scheduling",
      description: "Manage harvest schedule and transport logistics to prevent factory overflow.",
      weightage: 30,
      target_metric: "100% on-time daily supply quota",
    },
    {
      id: "kt_agri_03",
      department: "Agriculture",
      designation: "Staff",
      title: "Shed Storage & Moisture Management",
      description: "Ensure proper ventilation and temperature monitoring in raw storage sheds.",
      weightage: 20,
      target_metric: "< 1% transit rot and damage",
    },

    // 6. Accounts Department
    {
      id: "kt_acc_01",
      department: "Accounts",
      designation: "Accountant",
      title: "Daily Gate Billing & Purchase Invoices",
      description: "Verify purchase orders, GRN, and freight bills within same-day turnaround.",
      weightage: 35,
      target_metric: "100% invoice reconciliation within 24h",
    },
    {
      id: "kt_acc_02",
      department: "Accounts",
      designation: "Accounts Executive",
      title: "Petty Cash & Factory Expense Auditing",
      description: "Daily voucher verification, physical cash reconciliation, and ledger entries.",
      weightage: 30,
      target_metric: "Zero cash imbalance at shift close",
    },
    {
      id: "kt_acc_03",
      department: "Accounts",
      designation: "Staff",
      title: "Contractor Rate-Card & Attendance Verification",
      description: "Cross-verify contractor muster rolls against digital biometric gate entries.",
      weightage: 20,
      target_metric: "100% verified contractor billing",
    },
    {
      id: "kt_acc_04",
      department: "Accounts",
      designation: "Staff",
      title: "GST, E-Way Bill & Dispatch Compliance",
      description: "Timely e-way bill generation for finished food product dispatches.",
      weightage: 15,
      target_metric: "Zero dispatch delays due to documentation",
    },
  ];

  for (const t of KRA_TEMPLATES) {
    insertTemplate.run({ ...t, created_at: now });
  }
}

export default db;
export { db };
