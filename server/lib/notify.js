import { all, insert, run } from './db.js';
import { nowIso } from './http.js';

const clients = new Map(); // employeeId -> Set<res>

export function subscribe(employeeId, res) {
  if (!clients.has(employeeId)) clients.set(employeeId, new Set());
  clients.get(employeeId).add(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`retry: 3000\n\n`);
  send(res, { type: 'connected', at: nowIso() });
  const ping = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(ping);
    }
  }, 25000);
  res.on('close', () => {
    clearInterval(ping);
    clients.get(employeeId)?.delete(res);
  });
}

function send(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function emit(employeeId, payload) {
  const set = clients.get(employeeId);
  if (!set || !set.size) return 0;
  for (const res of set) {
    try {
      send(res, payload);
    } catch {
      set.delete(res);
    }
  }
  return set.size;
}

/** Insert a notification and deliver it to any live SSE subscribers. */
export function push(employeeId, { type, title, body, icon, link, payload, priority = 'normal', companyId = null }) {
  if (!employeeId) return null;
  const company = companyId ?? (all('SELECT company_id FROM employees WHERE id = ?', employeeId)[0]?.company_id ?? 0);
  const id = insert('notifications', {
    company_id: company,
    employee_id: employeeId,
    type,
    title,
    body,
    icon,
    link,
    payload: payload ? JSON.stringify(payload) : null,
    priority,
    created_at: nowIso()
  });
  const row = {
    id,
    type,
    title,
    body,
    icon,
    link,
    priority,
    read: 0,
    created_at: nowIso(),
    payload
  };
  emit(employeeId, { type: 'notification', notification: row });
  return row;
}

export function pushMany(employeeIds, note) {
  for (const id of new Set(employeeIds.filter(Boolean))) push(id, note);
}

export function listNotifications(employeeId, { limit = 60, unreadOnly = false } = {}) {
  const rows = all(
    `SELECT * FROM notifications WHERE employee_id = ? ${unreadOnly ? 'AND read = 0' : ''}
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    employeeId,
    limit
  );
  return rows.map((r) => ({ ...r, payload: safe(r.payload) }));
}

export function unreadCount(employeeId) {
  const row = all('SELECT COUNT(*) AS c FROM notifications WHERE employee_id = ? AND read = 0', employeeId)[0];
  return row?.c || 0;
}

export function markRead(employeeId, id) {
  if (id) return run('UPDATE notifications SET read = 1 WHERE employee_id = ? AND id = ?', employeeId, id);
  return run('UPDATE notifications SET read = 1 WHERE employee_id = ?', employeeId);
}

function safe(v) {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
