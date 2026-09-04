const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.HRMATE_DB || path.join(dataDir, "hrmate.db");

console.log("Connecting to database:", dbPath);
const db = new Database(dbPath);

const adminEmail = process.argv[2] || "admin@hrmate.com";
const newPass = process.argv[3] || "admin123";

const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").get(adminEmail);

if (!user) {
  console.log(`User ${adminEmail} not found. Creating Super Admin...`);
  const id = "u_" + crypto.randomBytes(6).toString("hex");
  const hashed = hashPassword(newPass);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, department, designation, color, active, created_at, weekly_off)
    VALUES (?, ?, ?, 'Super Admin', 'super_admin', 'Management', 'Super Admin', '#1E6FE0', 1, ?, 0)
  `).run(id, adminEmail.toLowerCase(), hashed, Date.now());
  console.log(`Created Super Admin user: ${adminEmail} / ${newPass}`);
} else {
  const hashed = hashPassword(newPass);
  db.prepare("UPDATE users SET password_hash = ?, active = 1 WHERE id = ?").run(hashed, user.id);
  console.log(`Password for ${user.email} (Name: ${user.name}, Role: ${user.role}) has been reset to: ${newPass}`);
}

const allUsers = db.prepare("SELECT id, email, name, role, active FROM users").all();
console.log("\nExisting users in database:");
console.table(allUsers);
