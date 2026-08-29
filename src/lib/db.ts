import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { hashPassword, randomId } from "./crypto";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.HRMATE_DB || path.join(dataDir, "hrmate.db");

declare global {
  // eslint-disable-next-line no-var
  var __hrmateDb: Database.Database | undefined;
}

const db: Database.Database =
  global.__hrmateDb || new Database(dbPath);

if (!global.__hrmateDb) {
  global.__hrmateDb = db;
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
}

function migrate(d: Database.Database) {
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

function seed(d: Database.Database) {
  const count = (d.prepare("SELECT COUNT(*) AS c FROM users").get() as any).c;
  if (count > 0) return;

  const now = Date.now();
  const insertUser = d.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, department, designation, color, created_at)
     VALUES (@id, @email, @password_hash, @name, @role, @department, @designation, @color, @created_at)`
  );

  const users = [
    {
      id: randomId("u_"),
      email: "admin@hrmate.com",
      password_hash: hashPassword("admin123"),
      name: "Aarav Sharma",
      role: "super_admin",
      department: "Management",
      designation: "Super Admin",
      color: "#6366f1",
    },
    {
      id: randomId("u_"),
      email: "manager@hrmate.com",
      password_hash: hashPassword("manager123"),
      name: "Priya Verma",
      role: "manager",
      department: "Production",
      designation: "Plant Manager",
      color: "#0ea5e9",
    },
    {
      id: randomId("u_"),
      email: "employee@hrmate.com",
      password_hash: hashPassword("employee123"),
      name: "Rahul Singh",
      role: "employee",
      department: "Production",
      designation: "Machine Operator",
      color: "#10b981",
    },
    {
      id: randomId("u_"),
      email: "sneha@hrmate.com",
      password_hash: hashPassword("sneha123"),
      name: "Sneha Kaur",
      role: "employee",
      department: "Quality",
      designation: "QC Inspector",
      color: "#f59e0b",
    },
    {
      id: randomId("u_"),
      email: "vikram@hrmate.com",
      password_hash: hashPassword("vikram123"),
      name: "Vikram Patel",
      role: "employee",
      department: "Logistics",
      designation: "Warehouse Staff",
      color: "#ef4444",
    },
  ];

  const insert = d.transaction(() => {
    for (const u of users) {
      insertUser.run({ ...u, created_at: now });
    }
  });
  insert();

  // Leave types
  const insertLeave = d.prepare(
    `INSERT INTO leave_types (id, name, days_per_year, color, sort) VALUES (?, ?, ?, ?, ?)`
  );
  insertLeave.run("lt_casual", "Casual Leave", 12, "#6366f1", 1);
  insertLeave.run("lt_sick", "Sick Leave", 10, "#ef4444", 2);
  insertLeave.run("lt_earned", "Earned Leave", 15, "#10b981", 3);
  insertLeave.run("lt_optional", "Optional Holiday", 3, "#f59e0b", 4);

  // Default factory settings (geofence)
  const setSetting = d.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`
  );
  setSetting.run("factory_name", "HRMate Manufacturing Unit");
  setSetting.run("factory_lat", "28.6139"); // New Delhi (demo)
  setSetting.run("factory_lng", "77.2090");
  setSetting.run("factory_radius", "200"); // meters
  setSetting.run("factory_address", "Plot 12, Industrial Area, New Delhi");
  setSetting.run("work_start", "09:00");
  setSetting.run("work_end", "18:00");

  // Sample wall posts
  const insertPost = d.prepare(
    `INSERT INTO wall_posts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)`
  );
  insertPost.run(
    randomId("p_"),
    users[0].id,
    "Welcome to HRMate! 🎉 This is our social wall — share announcements, shout-outs and updates with the team.",
    now - 1000 * 60 * 60 * 5
  );
  insertPost.run(
    randomId("p_"),
    users[1].id,
    "Reminder: Monthly production review meeting tomorrow at 10 AM in the conference room. Please be on time. 📋",
    now - 1000 * 60 * 60 * 3
  );
  insertPost.run(
    randomId("p_"),
    users[2].id,
    "Great teamwork on the new line setup this week! Proud of everyone. 💪",
    now - 1000 * 60 * 60 * 1
  );

  const insertLike = d.prepare(
    `INSERT INTO wall_likes (post_id, user_id) VALUES (?, ?)`
  );
  insertLike.run(
    (d.prepare("SELECT id FROM wall_posts ORDER BY created_at DESC LIMIT 1").get() as any).id,
    users[1].id
  );

  const insertComment = d.prepare(
    `INSERT INTO wall_comments (id, post_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`
  );
  const firstPost = d.prepare("SELECT id FROM wall_posts ORDER BY created_at ASC LIMIT 1").get() as any;
  insertComment.run(
    randomId("c_"),
    firstPost.id,
    users[3].id,
    "Looking forward to using this! 🙌",
    now - 1000 * 60 * 60 * 4
  );
}

export default db;
export { db };
