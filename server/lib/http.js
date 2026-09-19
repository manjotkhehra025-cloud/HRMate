// Small HTTP framework + helpers (no external dependencies).
import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (msg, d) => new HttpError(400, msg, d);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

export const uid = (n = 24) => crypto.randomBytes(n).toString('hex');
export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) {
        reject(new HttpError(413, 'Payload too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(badRequest('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

// --- tiny router -----------------------------------------------------------
export class Router {
  constructor() {
    this.routes = [];
  }
  add(method, pattern, handler) {
    const keys = [];
    const rx = new RegExp(
      '^' +
        pattern
          .split('/')
          .map((seg) => {
            if (seg.startsWith(':')) {
              keys.push(seg.slice(1));
              return '([^/]+)';
            }
            if (seg === '*') return '.*';
            return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('/') +
        '/?$'
    );
    this.routes.push({ method, rx, keys, handler, pattern });
  }
  get(p, h) {
    this.add('GET', p, h);
  }
  post(p, h) {
    this.add('POST', p, h);
  }
  patch(p, h) {
    this.add('PATCH', p, h);
  }
  put(p, h) {
    this.add('PUT', p, h);
  }
  delete(p, h) {
    this.add('DELETE', p, h);
  }
  match(method, pathname) {
    let pathMatch = false;
    for (const r of this.routes) {
      const m = r.rx.exec(pathname);
      if (!m) continue;
      pathMatch = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });
      return { handler: r.handler, params };
    }
    if (pathMatch) throw new HttpError(405, 'Method not allowed');
    return null;
  }
}

// --- misc ------------------------------------------------------------------
export const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
export const str = (v, max = 4000) => (v === undefined || v === null ? null : String(v).slice(0, max));
export const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export function groupBy(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

export function dateRange(startISO, endISO) {
  const out = [];
  const cur = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function addDays(dateISO, days) {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(aISO, bISO) {
  const a = new Date(aISO + 'T00:00:00Z').getTime();
  const b = new Date(bISO + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

export function minutesBetween(startHHMM, endHHMM, referenceDateISO) {
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const start = new Date(referenceDateISO + 'T00:00:00Z');
  start.setUTCHours(sh, sm, 0, 0);
  const end = new Date(referenceDateISO + 'T00:00:00Z');
  end.setUTCHours(eh, em, 0, 0);
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1); // overnight shift
  return (end - start) / 60000;
}

export function toIsoWithTime(dateISO, hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function initialsOf(first, last) {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '?';
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function maskToken(t) {
  return t ? `${t.slice(0, 6)}…${t.slice(-4)}` : '';
}
