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
    expires_at INTEGER NOT NULL
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
  `);
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
  setSetting.run("factory_name", "My Factory");
  setSetting.run("factory_lat", "28.6139");
  setSetting.run("factory_lng", "77.2090");
  setSetting.run("factory_radius", "200");
  setSetting.run("factory_address", "");
  setSetting.run("work_start", "09:00");
  setSetting.run("work_end", "18:00");
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
  shift.run("sh_day", "Day", "08:00", 8, "morning", 1);
  shift.run("sh_season", "Season day", "07:00", 8, "none", 2);
  shift.run("sh_night", "Night", "19:00", 8, "evening", 3);
}

export default db;
export { db };
