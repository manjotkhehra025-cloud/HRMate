// ---------------------------------------------------------------------------
// HRMate API + static host. Zero runtime dependencies (node:http + node:sqlite).
// ---------------------------------------------------------------------------
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from './lib/db.js';
import { seedDatabase } from './seed.js';
import { Router, HttpError, parseBody, sendJson, notFound } from './lib/http.js';
import { loadActor } from './lib/auth.js';
import { audit } from './lib/audit.js';

import * as authRoutes from './routes/auth.js';
import * as peopleRoutes from './routes/people.js';
import * as attendanceRoutes from './routes/attendance.js';
import * as leaveRoutes from './routes/leave.js';
import * as workforceRoutes from './routes/workforce.js';
import * as approvalsRoutes from './routes/approvals.js';
import * as documentRoutes from './routes/documents.js';
import * as performanceRoutes from './routes/performance.js';
import * as engagementRoutes from './routes/engagement.js';
import * as helpdeskRoutes from './routes/helpdesk.js';
import * as calendarRoutes from './routes/calendar.js';
import * as notificationRoutes from './routes/notifications.js';
import * as adminRoutes from './routes/admin.js';
import * as reportRoutes from './routes/reports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DIST = path.join(ROOT, 'dist');
const UPLOADS = path.join(ROOT, 'data', 'uploads');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

// --- bootstrap -------------------------------------------------------------
migrate();
const seedResult = seedDatabase({ force: process.argv.includes('--reseed') });
if (seedResult.skipped) {
  console.log('· reusing existing database (run `npm run reset` to rebuild demo data)');
} else {
  console.log(`· seeded demo data: ${JSON.stringify(seedResult.stats)}`);
}

// --- router ----------------------------------------------------------------
export const router = new Router();
for (const mod of [
  authRoutes,
  peopleRoutes,
  attendanceRoutes,
  leaveRoutes,
  workforceRoutes,
  approvalsRoutes,
  documentRoutes,
  performanceRoutes,
  engagementRoutes,
  helpdeskRoutes,
  calendarRoutes,
  notificationRoutes,
  adminRoutes,
  reportRoutes
])
  mod.register(router);

const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/pin', '/api/auth/biometric', '/api/auth/bootstrap', '/api/health']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

function serveStatic(req, res, pathname) {
  let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
    if (!fs.existsSync(filePath)) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(
        'HRMate API is running, but the web bundle is not built yet.\n\nRun `npm run build` (or `npm run dev` for the Vite dev server on :5173).'
      );
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveUpload(req, res, pathname) {
  const filePath = path.join(UPLOADS, pathname.replace('/uploads', ''));
  if (!filePath.startsWith(UPLOADS) || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('not found');
  }
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size
  });
  fs.createReadStream(filePath).pipe(res);
}

const clientIp = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');

  // CORS for local tooling / mobile dev shells
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (pathname.startsWith('/uploads')) return serveUpload(req, res, pathname);
    if (!pathname.startsWith('/api')) {
      return req.method === 'GET' ? serveStatic(req, res, pathname) : (res.writeHead(405), res.end());
    }

    if (pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, uptime: Math.round(process.uptime()), time: new Date().toISOString() });
    }

    const match = router.match(req.method, pathname);
    if (!match) throw notFound(`No route for ${req.method} ${pathname}`);

    const actor = loadActor(req);
    if (!actor && !PUBLIC_PATHS.has(pathname)) throw new HttpError(401, 'Sign in to continue');

    const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await parseBody(req) : {};
    const ctx = {
      req,
      res,
      actor,
      ip: clientIp(req),
      params: match.params,
      query: Object.fromEntries(url.searchParams.entries()),
      body
    };

    const result = await match.handler(ctx, { raw: { req, res } });
    if (res.writableEnded) return;
    sendJson(res, 200, result ?? { ok: true });
  } catch (err) {
    if (res.writableEnded) return;
    const status = err.status || 500;
    if (status >= 500) console.error(`[api] ${req.method} ${pathname} →`, err);
    else if (status === 401 || status === 403) {
      try {
        const actor = loadActor(req);
        audit({ actor, ip: clientIp(req) }, 'access.denied', 'security', null, `${req.method} ${pathname} → ${status}: ${err.message}`, { severity: 'warning' });
      } catch {
        /* ignore audit failures */
      }
    }
    sendJson(res, status, { error: err.message || 'Internal server error', status, details: err.details || null });
  } finally {
    const ms = Date.now() - startedAt;
    if (ms > 900) console.warn(`[slow] ${req.method} ${pathname} took ${ms}ms`);
  }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

if (process.env.HRMATE_TEST !== '1') {
  server.listen(PORT, HOST, () => {
    console.log(`\n  ⛰  HRMate API listening on http://${HOST}:${PORT}`);
    console.log(`     web bundle : ${fs.existsSync(path.join(DIST, 'index.html')) ? 'served from dist/' : 'not built (use npm run dev)'}`);
    console.log(`     database   : ${process.env.HRMATE_DB || 'data/hrmate.db'}\n`);
  });
}

export { server, DIST, ROOT };
