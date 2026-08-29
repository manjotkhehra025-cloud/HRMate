# HRMate — Smart HRMS

A premium, self-hosted HR management system built with **Next.js 14 + TypeScript + Tailwind CSS + SQLite**.

> **Note:** This is the **v0.1 foundation** — the core platform is fully functional, and features
> will be added incrementally on top of it.

## ✨ Features (shipped in v0.1)

### Attendance
- 🛰️ **GPS punch in / out** — you can only punch when you're physically inside the factory geofence.
- 📍 **Geofence enforcement** — server-side distance check (haversine) against the configured factory location + radius.
- ✋ **Manual punch requests** — forgot to punch? Submit a request that requires **manager/admin approval**.
- 📅 Monthly punch history.

### Leaves
- ⚖️ **Live leave balances** per leave type (Casual, Sick, Earned, Optional Holiday).
- 📝 **Apply for leave** with automatic business-day calculation and balance validation.
- ✅ **Approval workflow** — every request needs approval/rejection.

### Social Wall
- 📣 Company-wide feed with posts, likes and comments.
- 🗑️ Owners can delete their posts; admins/moderators can moderate anything.

### Approvals
- Central queue for **leave requests** and **manual punch requests**.
- One-click approve / reject, with push notifications sent to the requester.

### Super Admin & Permissions
- 👑 **Super Admin has full power** over everything.
- 🔐 **Granular, per-user permission overrides** (18 permissions across 6 groups) on top of role defaults.
- 👥 Role-based defaults: Super Admin, Admin, Manager, Employee.
- 👤 Full user management: create, edit, deactivate, reset passwords.

### Security & Auth
- 🔑 **Passkey login** (WebAuthn) — Face ID / Touch ID / Windows Hello / security keys.
- 🔒 Password login with scrypt hashing.
- 🔐 HTTP-only session cookies.

### Notifications
- 🔔 **Push notifications** (Web Push + service worker) for approvals and social interactions.
- 📬 In-app notification center with unread badges.

## 🧰 Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (better-sqlite3) |
| Passkeys | @simplewebauthn |
| Push | web-push (VAPID) |

## 🚀 Getting started

```bash
npm install
npm run dev
# → http://localhost:3000
```

## 🌍 Production deployment (Docker + HTTPS)

The repo ships with a ready-to-run Docker + Caddy setup that serves the app over
**HTTPS** with automatic Let's Encrypt certificates. It's pre-configured for the
domain **`gdfoods.duckdns.org`**.

See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step guide to deploy on your
Google Cloud VPS (Docker install, firewall, launch, updates and backups).

The SQLite database is auto-created and seeded on first run (in `data/`).

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@hrmate.com` | `admin123` |
| Manager | `manager@hrmate.com` | `manager123` |
| Employee | `employee@hrmate.com` | `employee123` |

> The default factory geofence is set to **New Delhi (28.6139, 77.2090, 200m)**.
> To test GPS punching, change it in **Admin → Factory Settings** to your real location
> (or use the "Use my current location" button).

## 📁 Project structure

```
src/
├── app/
│   ├── (app)/           # Authenticated shell (sidebar + topbar)
│   │   ├── dashboard/
│   │   ├── attendance/
│   │   ├── leaves/
│   │   ├── wall/
│   │   ├── approvals/
│   │   ├── team/
│   │   ├── profile/     # Passkey management
│   │   └── admin/       # Users, permissions, settings
│   ├── login/
│   └── api/             # Route handlers
├── components/          # Reusable UI
└── lib/                 # db, auth, permissions, geo, push, passkeys
```

## 🗺️ Roadmap (coming next)

- [ ] Reports & analytics dashboard (charts, exports)
- [ ] Shift scheduling & overtime tracking
- [ ] Attendance policy / late & early-leave rules
- [ ] Leave approval hierarchy (manager → admin → super admin)
- [ ] Holidays calendar
- [ ] Payroll integration
- [ ] Multi-branch / multi-factory geofences
- [ ] Mobile PWA enhancements & offline support
- [ ] Email notifications
