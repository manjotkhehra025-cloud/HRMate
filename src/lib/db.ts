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

let _db: DatabaseLike | null = null;

function getDb(): DatabaseLike {
  if (_db) return _db;
  const Database = require("better-sqlite3");
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.HRMATE_DB || path.join(dataDir, "hrmate.db");
  const db = new Database(dbPath) as DatabaseLike;
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  _db = db;
  return db;
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
    color: "#6366f1",
  };
  insertUser.run({ ...admin, created_at: now });

  const insertLeave = d.prepare(
    `INSERT INTO leave_types (id, name, days_per_year, color, sort) VALUES (?, ?, ?, ?, ?)`
  );
  insertLeave.run("lt_casual", "Casual Leave", 12, "#6366f1", 1);
  insertLeave.run("lt_sick", "Sick Leave", 10, "#ef4444", 2);
  insertLeave.run("lt_earned", "Earned Leave", 15, "#10b981", 3);
  insertLeave.run("lt_optional", "Optional Holiday", 3, "#f59e0b", 4);

  const setSetting = d.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  );
  setSetting.run("factory_name", "My Factory");
  setSetting.run("factory_lat", "28.6139");
  setSetting.run("factory_lng", "77.2090");
  setSetting.run("factory_radius", "200");
  setSetting.run("factory_address", "");
  setSetting.run("work_start", "09:00");
  setSetting.run("work_end", "18:00");
}

export default db;
export { db };
