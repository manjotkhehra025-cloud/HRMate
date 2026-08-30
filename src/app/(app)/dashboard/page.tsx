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
import { balancesForUser } from "@/lib/leave";
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
  const balances = balancesForUser(user.id);
  const totalBalance = balances.reduce((s, b) => s + Math.max(0, b.balance), 0);

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
      icon: <CalendarDays className="h-[17px] w-[17px]" />,
      tint: "#1E6FE0",
      href: "/leaves",
    },
    {
      label: "Punch in",
      value: todayIn || "—",
      hint: todayIn ? "today" : "not yet",
      icon: <MapPin className="h-[17px] w-[17px]" />,
      tint: "#07945D",
      href: "/attendance",
    },
    {
      label: "Pending",
      value: String(pendingCount),
      hint: "approvals",
      icon: <CheckSquare className="h-[17px] w-[17px]" />,
      tint: "#D98200",
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
          <h1 className="page-title mt-1">
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
            className="kpi-card transition hover:shadow-pop"
            style={{ ["--kpi" as any]: s.tint }}
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-[10px] font-bold uppercase tracking-kicker text-muted">{s.label}</p>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: `${s.tint}1c`, color: s.tint }}
              >
                {s.icon}
              </span>
            </div>
            <p className="mt-1 truncate text-[22px] font-bold tabular tracking-kpi text-ink sm:text-[24px]">
              {s.value}
            </p>
            <p className="text-[11px] text-muted">{s.hint}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3">
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
