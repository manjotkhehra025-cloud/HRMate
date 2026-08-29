import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { dateKey } from "@/lib/api";
import { formatTime, IST, istParts } from "@/lib/utils";
import db from "@/lib/db";
import PunchWidget from "@/components/PunchWidget";
import Avatar from "@/components/Avatar";
import PushRegistration from "@/components/PushRegistration";
import { getVapidPublicKey } from "@/lib/push";
import {
  CalendarDays,
  MapPin,
  MessageSquare,
  CheckSquare,
  ArrowRight,
} from "lucide-react";

export const metadata = { title: "Dashboard — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: any) => perms.isSuperAdmin || perms.has(p);

  const today = dateKey();
  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;

  const factory = getFactoryConfig();

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

  let pendingCount = 0;
  if (has("approvals.view")) {
    pendingCount =
      (db.prepare("SELECT COUNT(*) AS c FROM leave_requests WHERE status = 'pending'").get() as any).c +
      (db.prepare("SELECT COUNT(*) AS c FROM manual_punch_requests WHERE status = 'pending'").get() as any).c;
  }

  const posts = db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.color AS author_color
       FROM wall_posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 3`
    )
    .all() as any[];

  const todayIn = record?.punch_in_at ? formatTime(record.punch_in_at) : null;

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: IST,
  });

  const stats = [
    {
      label: "Leave balance",
      value: `${totalBalance}`,
      hint: "days remaining",
      icon: <CalendarDays className="h-5 w-5" />,
      tone: "text-brand-600 bg-brand-50",
      href: "/leaves",
    },
    {
      label: "Punch in",
      value: todayIn || "—",
      hint: todayIn ? "today" : "not yet",
      icon: <MapPin className="h-5 w-5" />,
      tone: "text-emerald-600 bg-emerald-50",
      href: "/attendance",
    },
    {
      label: "Pending",
      value: String(pendingCount),
      hint: "approvals",
      icon: <CheckSquare className="h-5 w-5" />,
      tone: "text-amber-600 bg-amber-50",
      href: "/approvals",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">
            {todayLabel}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">
            Good {getGreeting()}, {user.name.split(" ")[0]}
          </h1>
          <p className="page-sub">Here&apos;s what&apos;s happening at {factory.name} today.</p>
        </div>
        <PushRegistration vapidPublicKey={getVapidPublicKey()} />
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card group flex flex-col gap-2 p-3 transition hover:shadow-pop sm:flex-row sm:items-center sm:gap-4 sm:p-5"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${s.tone}`}
            >
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="hidden text-xs font-medium text-slate-500 sm:block">{s.label}</p>
              <p className="truncate text-lg font-bold tabular-nums text-slate-900 sm:text-xl">
                {s.value}
              </p>
              <p className="text-[10px] font-medium text-slate-400 sm:text-xs">{s.hint}</p>
            </div>
            <ArrowRight className="ml-auto hidden h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-500 sm:block" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PunchWidget canPunch={has("attendance.punch")} today={record} factory={factory} />
        </div>

        <div className="card p-5 sm:p-6 lg:col-span-2">
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

          <div className="mt-4 space-y-1">
            {posts.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">
                No posts yet — share the first update.
              </p>
            )}
            {posts.map((p) => (
              <div
                key={p.id}
                className="flex gap-3 rounded-2xl px-1 py-3 transition hover:bg-slate-50"
              >
                <Avatar name={p.author_name} color={p.author_color} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{p.author_name}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{p.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Leave balances</h2>
          <Link href="/leaves" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            Apply →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {balances.map((b) => {
            const pct = b.days_per_year > 0 ? Math.round((b.balance / b.days_per_year) * 100) : 0;
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-slate-100 p-4"
                style={{ backgroundColor: `${b.color}0d` }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-[11px] font-medium text-slate-400">{b.used} used</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{b.balance}</p>
                <p className="text-xs font-medium text-slate-500">{b.name}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = istParts().hour;
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
