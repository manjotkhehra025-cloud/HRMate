import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { dateKey } from "@/lib/api";
import { formatTime } from "@/lib/utils";
import db from "@/lib/db";
import PunchWidget from "@/components/PunchWidget";
import Avatar from "@/components/Avatar";
import { Badge } from "@/components/ui";
import PushRegistration from "@/components/PushRegistration";
import { getVapidPublicKey } from "@/lib/push";
import {
  CalendarDays,
  MapPin,
  MessageSquare,
  CheckSquare,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export const metadata = { title: "Dashboard — HRMate" };

export default function DashboardPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  const today = dateKey();
  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;

  const factory = getFactoryConfig();

  // Leave balance summary
  const year = new Date().getFullYear();
  const types = db.prepare("SELECT * FROM leave_types ORDER BY sort").all() as any[];
  const usedRows = db
    .prepare(
      `SELECT leave_type_id, SUM(days) AS total FROM leave_requests
       WHERE user_id = ? AND status = 'approved' AND substr(start_date,1,4) = ?
       GROUP BY leave_type_id`
    )
    .all(user.id, String(year)) as { leave_type_id: string; total: number }[];
  const usedMap: Record<string, number> = {};
  for (const u of usedRows) usedMap[u.leave_type_id] = u.total;
  const balances = types.map((t) => ({
    ...t,
    used: usedMap[t.id] || 0,
    balance: t.days_per_year - (usedMap[t.id] || 0),
  }));
  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  // Pending approvals (for managers/admins)
  let pendingCount = 0;
  if (has("approvals.view")) {
    pendingCount =
      (db.prepare("SELECT COUNT(*) AS c FROM leave_requests WHERE status = 'pending'").get() as any).c +
      (db.prepare("SELECT COUNT(*) AS c FROM manual_punch_requests WHERE status = 'pending'").get() as any).c;
  }

  // Recent wall posts
  const posts = db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.color AS author_color
       FROM wall_posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 3`
    )
    .all() as any[];

  const todayIn = record?.punch_in_at ? formatTime(record.punch_in_at) : null;
  const todayOut = record?.punch_out_at ? formatTime(record.punch_out_at) : null;

  const stats = [
    {
      label: "Leave balance",
      value: `${totalBalance} days`,
      icon: <CalendarDays className="h-5 w-5" />,
      tone: "text-brand-600 bg-brand-50",
      href: "/leaves",
    },
    {
      label: "Punch in",
      value: todayIn || "Not yet",
      icon: <MapPin className="h-5 w-5" />,
      tone: "text-emerald-600 bg-emerald-50",
      href: "/attendance",
    },
    {
      label: "Pending approvals",
      value: String(pendingCount),
      icon: <CheckSquare className="h-5 w-5" />,
      tone: "text-amber-600 bg-amber-50",
      href: "/approvals",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Good {getGreeting()}, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening at {factory.name} today.
          </p>
        </div>
        <PushRegistration vapidPublicKey={getVapidPublicKey()} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card group flex items-center gap-4 p-5 transition hover:shadow-pop"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.tone}`}>
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <p className="truncate text-xl font-bold text-slate-900">{s.value}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-500" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Punch widget */}
        <div className="lg:col-span-1">
          <PunchWidget canPunch={has("attendance.punch")} today={record} factory={factory} />
        </div>

        {/* Wall preview */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MessageSquare className="h-4 w-4 text-brand-500" /> Social wall
            </h2>
            {has("wall.view") && (
              <Link
                href="/wall"
                className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {posts.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No posts yet.</p>
            )}
            {posts.map((p) => (
              <div key={p.id} className="flex gap-3">
                <Avatar name={p.author_name} color={p.author_color} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{p.author_name}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{p.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leave balances */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-800">Leave balances</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {balances.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-slate-100 p-4"
              style={{ backgroundColor: `${b.color}08` }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-xs font-medium text-slate-400">{b.used} used</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{b.balance}</p>
              <p className="text-xs font-medium text-slate-500">{b.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
