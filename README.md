# ⛰ HRMate

A full-stack, mobile-first **HRMS** built with zero runtime dependencies on the server and a
hand-rolled React 18 + Tailwind front end. Attendance and punch in/out, fingerprint & face
authentication, GPS geofencing, shift rosters, leave and approvals, employee records, digital ID
cards, KYC, KRA & goals, performance reviews, directory, calendar, notifications, social wall,
star workers, helpdesk, analytics, admin panel, device management and audit logs — across seven
roles with real role-based access control.

```
npm install
npm run dev          # API on :8787 + Vite on :5173, http://localhost:5173
```

Sign in with any demo account (password `Demo@1234`, app PIN `123456`):

| Email | Role | Sees |
| --- | --- | --- |
| `aarav.mehta@northpeak.io` | Super Admin | everything, including the admin panel |
| `priya.nair@northpeak.io` | HR Admin | company-wide |
| `rohan.deshmukh@northpeak.io` | HR Manager | company-wide |
| `ananya.sharma@northpeak.io` | Department Manager | department tree |
| `vikram.rao@northpeak.io` | Supervisor | own team |
| `meera.iyer@northpeak.io` | Team Leader | own team |
| `kabir.malhotra@northpeak.io` | Employee | self only |

---

## Stack

| Layer | Choice |
| --- | --- |
| Server | Node ≥ 22.5, `node:http` + a small custom `Router`, `node:sqlite`, `node:crypto` — **no npm dependencies** |
| Data | SQLite in WAL mode at `data/hrmate.db`, 34 tables, uploads in `data/uploads` |
| Client | React 18, Vite 8, Tailwind 3, plain JSX, hash routing, `React.lazy` per page |
| Live updates | Server-sent events (`/api/notifications/stream`) + the browser Notification API |
| i18n | 7 locales (en, es, hi, fr, ar, de, pt); Arabic switches the whole UI to RTL |
| Theming | Light / dark / follow-system via `html.classList` + CSS custom properties |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and Vite together (`scripts/dev.js`), API proxied at `/api` |
| `npm run server` / `npm start` | API only, serving `dist/` if it has been built |
| `npm run web` | Vite dev server only |
| `npm run build` | Production bundle into `dist/` |
| `npm run seed` | Seed the database if it is empty |
| `npm run reset` | **Rebuild** the demo dataset from scratch |
| `npm test` | Backend mutation + RBAC suite (`scripts/smoke.mjs`) — 57 assertions |
| `npm run test:web` | API contract suite covering every page's endpoints (`scripts/web-api.mjs`) — 76 assertions |
| `npm run test:all` | Both suites |

Both suites boot their own server on an ephemeral port, so they run standalone.
Repeated runs add rows (test tickets, reviews, audit entries); `npm run reset` restores the
pristine seed.

---

## What is in the box

**27 screens** under `web/src/pages`:

Login (password · PIN · biometric) · Dashboard · Attendance & punch · Employees · Employee detail
(8 tabs) · Directory · Leaves · Approvals · Roster · Shifts · Calendar · Documents · KYC ·
Digital ID card · Goals & KRA · Performance · Social wall · Star workers · Helpdesk ·
Announcements · Reports · Admin panel · Devices · Audit logs · Notifications · Settings · Profile

**151 API routes** under `server/routes/`, grouped by domain:

`auth` `people` `attendance` `leave` `workforce` `approvals` `documents` `performance`
`engagement` `helpdesk` `calendar` `notifications` `admin` `reports`

### Feature notes

- **Punch in/out** validates the GPS coordinate against the location geofence (`haversine`),
  records the method (`gps`, `face`, `fingerprint`, `pin`, `qr`, `manual`), flags out-of-fence
  punches, and refuses duplicates.
- **Biometrics are simulated.** The client posts `{ identifier, method, score }`; the server
  compares it against a deterministic template derived from the account and requires
  `score >= 0.85`. No camera or sensor data is captured or stored.
- **Role matrix edits are in-memory only.** `PATCH /api/admin/roles/:key` mutates the running
  permission map so you can experiment, but it is *not* persisted — restarting the server restores
  the shipped matrix. The admin UI states this inline.
- **Scope** is enforced server-side on every list endpoint (`server/lib/scope.js`): employees see
  themselves, team leads and supervisors see their report tree, department managers see the
  department subtree, HR and super admins see the company.
- **Team directory** is deliberately company-wide (names, roles and contact details) for anyone
  holding `employee.view_company`. Salary, bank, tax and date-of-birth stay behind
  `/api/employees/:id` and the `employee.view_sensitive` permission.
- **Reports** cover attendance (incl. method mix and geofence compliance), leave, headcount,
  workforce, performance, engagement, helpdesk and payroll, each with a CSV export.
- **Audit log** records every privileged mutation, plus `access.denied` entries for 401/403s.

## Demo data

`server/seed.js` is deterministic (`mulberry32(20260919)`), so every install produces the same
company:

```
55 employees · 15 departments · 7 shifts · 4 geofenced locations · 10 leave types
4,177 attendance records · 5,460 punches · 3,905 roster slots · 225 leave requests
358 documents · 166 KYC checks · 170 goals · 428 key results · 95 reviews
54 tickets · 190 kudos · 102 devices · 401 notifications · 240 audit entries
```

The seed also guarantees that the seven demo accounts are rostered *today*, whatever day you
install, so attendance and the live roster are populated on first load. All timestamps are UTC and
money is formatted as `₹` via `Intl.NumberFormat('en-IN')`.

## Layout

```
server/
  index.js            HTTP server, static dist/, /uploads streaming, CORS, audit-on-403
  lib/                db.js · http.js · rbac.js · auth.js · audit.js · notify.js · scope.js
  routes/             14 domain modules, each exporting register(router)
  seed.js             deterministic demo dataset
scripts/
  dev.js              API + Vite together
  seed.js             CLI seeder
  smoke.mjs           backend mutation/RBAC suite
  web-api.mjs         per-page API contract suite
  _boot.mjs           shared test bootstrap
web/src/
  App.jsx             hash router + lazy route map
  components/         Layout (sidebar + bottom tabs), CommandPalette (⌘K), KudoModal
  lib/                api.js · format.js · hooks.js · i18n.js · store.jsx
  ui/                 38 primitives + an 81-icon set
  pages/              27 screens
```

## Security model

Passwords and PINs are scrypt-hashed; sessions are opaque bearer tokens in `localStorage`;
RBAC is a role → permission-key map (`server/lib/rbac.js`, ~70 keys grouped into 7 permission
families) evaluated on the server for every request. Avatars are generated from a colour + emoji +
initials, so the app makes no external image requests.
