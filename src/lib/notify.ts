import db from "./db";
import { randomId } from "./crypto";
import { sendPushToUser, sendPushToMany } from "./push";

export function notify(
  userId: string,
  title: string,
  body: string,
  opts: { type?: string; link?: string; push?: boolean } = {}
) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, read, link, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(randomId("n_"), userId, title, body, opts.type || "info", opts.link || "", Date.now());

  if (opts.push !== false) {
    sendPushToUser(userId, { title, body, link: opts.link });
  }
}

export function notifyMany(
  userIds: string[],
  title: string,
  body: string,
  opts: { type?: string; link?: string } = {}
) {
  const stmt = db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, read, link, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  );
  for (const id of userIds) {
    stmt.run(randomId("n_"), id, title, body, opts.type || "info", opts.link || "", Date.now());
  }
  sendPushToMany(userIds, { title, body, link: opts.link });
}
