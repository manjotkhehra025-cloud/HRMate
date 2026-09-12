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
  CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
  CREATE INDEX IF NOT EXISTS idx_holidays_off ON holidays(is_off);
  CREATE INDEX IF NOT EXISTS idx_ot_user ON overtime_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_gate_user ON gate_passes(user_id);
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
  const count = d.prepare("SELECT COUNT(*) AS c FROM holidays").get() as any;
  if (count && count.c > 0) return;

  const now = Date.now();
  const insertHoliday = d.prepare(
    `INSERT OR IGNORE INTO holidays (id, title, date, type, is_off, description, color, created_at)
     VALUES (@id, @title, @date, @type, @is_off, @description, @color, @created_at)`
  );

  const HOLIDAYS_2026 = [
    { id: "hol_2026_01", title: "New Year's Day", date: "2026-01-01", type: "festival_observance", is_off: 0, description: "Celebration of New Year 2026", color: "#3B82F6" },
    { id: "hol_2026_02", title: "Guru Gobind Singh Ji Parkash Purab", date: "2026-01-05", type: "public_holiday", is_off: 1, description: "Birth anniversary of 10th Sikh Guru", color: "#F59E0B" },
    { id: "hol_2026_03", title: "Lohri", date: "2026-01-13", type: "festival_observance", is_off: 0, description: "Traditional harvest festival of Punjab", color: "#F97316" },
    { id: "hol_2026_04", title: "Makar Sankranti / Maghi", date: "2026-01-14", type: "festival_observance", is_off: 0, description: "Solar cycle harvest festival & Maghi Mela", color: "#EAB308" },
    { id: "hol_2026_05", title: "Republic Day", date: "2026-01-26", type: "national_holiday", is_off: 1, description: "National holiday commemorating the Constitution of India", color: "#EF4444" },
    { id: "hol_2026_06", title: "Guru Ravidas Jayanti", date: "2026-02-01", type: "public_holiday", is_off: 1, description: "Birth anniversary of Guru Ravidas Ji", color: "#8B5CF6" },
    { id: "hol_2026_07", title: "Maha Shivratri", date: "2026-02-15", type: "festival_observance", is_off: 0, description: "Great night of Lord Shiva", color: "#6366F1" },
    { id: "hol_2026_08", title: "Holi / Holla Mohalla", date: "2026-03-03", type: "public_holiday", is_off: 1, description: "Festival of Colors & Sikh martial festival at Anandpur Sahib", color: "#EC4899" },
    { id: "hol_2026_09", title: "Holla Mohalla (Day 2)", date: "2026-03-04", type: "festival_observance", is_off: 0, description: "Traditional festivities and martial gatherings", color: "#F43F5E" },
    { id: "hol_2026_10", title: "Eid-ul-Fitr", date: "2026-03-20", type: "public_holiday", is_off: 1, description: "Islamic festival marking the end of Ramadan", color: "#10B981" },
    { id: "hol_2026_11", title: "Shaheed Diwas (Bhagat Singh, Rajguru, Sukhdev)", date: "2026-03-23", type: "festival_observance", is_off: 0, description: "Martyrdom tribute to Shaheed Bhagat Singh and comrades", color: "#F59E0B" },
    { id: "hol_2026_12", title: "Ram Navami", date: "2026-03-27", type: "festival_observance", is_off: 0, description: "Celebration of the birth of Lord Rama", color: "#F97316" },
    { id: "hol_2026_13", title: "Good Friday", date: "2026-04-03", type: "public_holiday", is_off: 1, description: "Christian holy day commemorating the crucifixion of Jesus", color: "#6B7280" },
    { id: "hol_2026_14", title: "Baisakhi (Khalsa Sajna Divas)", date: "2026-04-13", type: "public_holiday", is_off: 1, description: "Harvest festival and Foundation of Khalsa Panth (1699)", color: "#F59E0B" },
    { id: "hol_2026_15", title: "Dr. B.R. Ambedkar Jayanti", date: "2026-04-14", type: "public_holiday", is_off: 1, description: "Birth anniversary of the Father of the Indian Constitution", color: "#1E6FE0" },
    { id: "hol_2026_16", title: "Parshuram Jayanti", date: "2026-04-20", type: "festival_observance", is_off: 0, description: "Birth anniversary of Lord Parshuram", color: "#8B5CF6" },
    { id: "hol_2026_17", title: "International Labour Day / May Day", date: "2026-05-01", type: "festival_observance", is_off: 0, description: "Worldwide celebration of workers and factory workforce", color: "#EF4444" },
    { id: "hol_2026_18", title: "Buddha Purnima", date: "2026-05-02", type: "festival_observance", is_off: 0, description: "Birth of Gautama Buddha", color: "#EAB308" },
    { id: "hol_2026_19", title: "Eid-ul-Adha (Bakrid)", date: "2026-05-27", type: "public_holiday", is_off: 1, description: "Feast of the Sacrifice", color: "#10B981" },
    { id: "hol_2026_20", title: "Guru Arjan Dev Ji Martyrdom Day", date: "2026-06-16", type: "public_holiday", is_off: 1, description: "Shaheedi Diwas of 5th Sikh Guru", color: "#F59E0B" },
    { id: "hol_2026_21", title: "International Yoga Day", date: "2026-06-21", type: "festival_observance", is_off: 0, description: "Global health and wellness celebration", color: "#06B6D4" },
    { id: "hol_2026_22", title: "Muharram", date: "2026-06-26", type: "public_holiday", is_off: 1, description: "First month of Islamic calendar / Ashura", color: "#475569" },
    { id: "hol_2026_23", title: "Independence Day", date: "2026-08-15", type: "national_holiday", is_off: 1, description: "79th Indian Independence Day celebration", color: "#EF4444" },
    { id: "hol_2026_24", title: "Raksha Bandhan", date: "2026-08-27", type: "festival_observance", is_off: 0, description: "Celebration of sibling bond and protection", color: "#EC4899" },
    { id: "hol_2026_25", title: "Janmashtami", date: "2026-09-04", type: "festival_observance", is_off: 0, description: "Birth anniversary of Lord Krishna", color: "#3B82F6" },
    { id: "hol_2026_26", title: "Teachers' Day", date: "2026-09-05", type: "festival_observance", is_off: 0, description: "Dr. Sarvepalli Radhakrishnan birth tribute", color: "#8B5CF6" },
    { id: "hol_2026_27", title: "Mahatma Gandhi Jayanti", date: "2026-10-02", type: "national_holiday", is_off: 1, description: "National holiday honouring Mahatma Gandhi", color: "#10B981" },
    { id: "hol_2026_28", title: "Maharaja Agrasen Jayanti", date: "2026-10-10", type: "festival_observance", is_off: 0, description: "Celebration of Maharaja Agrasen", color: "#F97316" },
    { id: "hol_2026_29", title: "Dussehra / Vijayadashami", date: "2026-10-20", type: "public_holiday", is_off: 1, description: "Victory of good over evil", color: "#F59E0B" },
    { id: "hol_2026_30", title: "Maharishi Valmiki Jayanti", date: "2026-10-25", type: "public_holiday", is_off: 1, description: "Birth anniversary of Adi Kavi Maharishi Valmiki", color: "#F97316" },
    { id: "hol_2026_31", title: "Karwa Chauth", date: "2026-10-29", type: "festival_observance", is_off: 0, description: "Traditional fasting festival", color: "#F43F5E" },
    { id: "hol_2026_32", title: "Diwali / Bandi Chhor Divas", date: "2026-11-08", type: "public_holiday", is_off: 1, description: "Festival of Lights & Historic release of Guru Hargobind Ji", color: "#F59E0B" },
    { id: "hol_2026_33", title: "Govardhan Puja", date: "2026-11-09", type: "festival_observance", is_off: 0, description: "Day following Diwali celebration", color: "#EAB308" },
    { id: "hol_2026_34", title: "Vishwakarma Day", date: "2026-11-10", type: "public_holiday", is_off: 1, description: "Factory tools and machinery puja celebration", color: "#1E6FE0" },
    { id: "hol_2026_35", title: "Bhai Dooj", date: "2026-11-11", type: "festival_observance", is_off: 0, description: "Celebration between brothers and sisters", color: "#EC4899" },
    { id: "hol_2026_36", title: "Children's Day", date: "2026-11-14", type: "festival_observance", is_off: 0, description: "Pandit Jawaharlal Nehru birthday tribute", color: "#3B82F6" },
    { id: "hol_2026_37", title: "Chhath Puja", date: "2026-11-15", type: "festival_observance", is_off: 0, description: "Solar deity thanksgiving worship", color: "#F97316" },
    { id: "hol_2026_38", title: "Guru Nanak Dev Ji Parkash Purab", date: "2026-11-24", type: "public_holiday", is_off: 1, description: "Birth anniversary of the 1st Sikh Guru", color: "#F59E0B" },
    { id: "hol_2026_39", title: "Guru Tegh Bahadur Ji Martyrdom Day", date: "2026-12-08", type: "public_holiday", is_off: 1, description: "Shaheedi Diwas of 9th Sikh Guru (Hind Di Chadar)", color: "#64748B" },
    { id: "hol_2026_40", title: "Christmas Day", date: "2026-12-25", type: "public_holiday", is_off: 1, description: "Christian celebration of the birth of Jesus Christ", color: "#EF4444" },
  ];

  for (const h of HOLIDAYS_2026) {
    insertHoliday.run({ ...h, created_at: now });
  }
}

export default db;
export { db };
