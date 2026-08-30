import type { ReactNode } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getPermissions, type Permission } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { dateKey } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import db from "@/lib/db";
import PunchWidget from "@/components/PunchWidget";
import PushRegistration from "@/components/PushRegistration";
import { getVapidPublicKey } from "@/lib/push";
import { balancesForUser } from "@/lib/leave";
import { parseWeeklyOff } from "@/lib/staff";
import { dayStatus } from "@/lib/reports";
import {
  CalendarDays,
  Users,
  BarChart3,
  UserCheck,
  Palmtree,
  UserX,
} from "lucide-react";

export const metadata = { title: "Dashboard — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

function addDays(dateKeyStr: string, n: number) {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function mondayOf(dateKeyStr: string) {
  const weekday = new Date(dateKeyStr + "T12:00:00+05:30").getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateKeyStr, offset);
}

export default function DashboardPage() {
  const user = getSessionUser()!;
  const perms = getPermissions(user.id);
  const has = (p: Permission) => perms.isSuperAdmin || perms.has(p);

  const today = dateKey();
  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;

  const factory = getFactoryConfig();
  const balances = balancesForUser(user.id);

  const weekStart = mondayOf(today);
  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekStart, -1);
  const sparkStart = addDays(today, -12);
  const rangeStart = lastWeekStart < sparkStart ? lastWeekStart : sparkStart;

  const teamView = has("attendance.team") || has("reports.view");
  const people = (
    teamView
      ? (db
          .prepare(
            `SELECT id, department, weekly_off FROM users WHERE active = 1 AND role != 'super_admin'`
          )
          .all() as { id: string; department: string; weekly_off: number }[])
      : [
          {
            id: user.id,
            department: user.department,
            weekly_off: user.weekly_off ?? 6,
          },
        ]
  ) as { id: string; department: string; weekly_off: number }[];

  const attWeek = db
    .prepare(
      `SELECT user_id, date, punch_in_at, punch_out_at FROM attendance WHERE date >= ? AND date <= ?`
    )
    .all(rangeStart, today) as {
    user_id: string;
    date: string;
    punch_in_at: number | null;
    punch_out_at: number | null;
  }[];
  const attMap: Record<string, Record<string, (typeof attWeek)[0]>> = {};
  for (const r of attWeek) {
    attMap[r.user_id] = attMap[r.user_id] || {};
    attMap[r.user_id][r.date] = r;
  }

  const leaveRows = db
    .prepare(
      `SELECT user_id, start_date, end_date FROM leave_requests
       WHERE status = 'approved' AND end_date >= ? AND start_date <= ?`
    )
    .all(rangeStart, today) as { user_id: string; start_date: string; end_date: string }[];
  const leaveDays: Record<string, Set<string>> = {};
  for (const l of leaveRows) {
    let d = l.start_date < rangeStart ? rangeStart : l.start_date;
    const end = l.end_date > today ? today : l.end_date;
    while (d <= end) {
      (leaveDays[l.user_id] ||= new Set()).add(d);
      d = addDays(d, 1);
    }
  }
  const onLeave = (userId: string, date: string) => !!leaveDays[userId]?.has(date);

  function weekCounts(from: string, to: string) {
    let present = 0;
    let leave = 0;
    let absent = 0;
    for (const p of people) {
      const off = parseWeeklyOff(p.weekly_off, 6);
      let d = from;
      while (d <= to) {
        const st = dayStatus(d, attMap[p.id]?.[d] || null, today, off);
        if (st === "present" || st === "half") present++;
        else if (onLeave(p.id, d) && st !== "weekly_off" && st !== "future") leave++;
        else if (st === "absent") absent++;
        d = addDays(d, 1);
      }
    }
    return { present, leave, absent };
  }

  const thisWeek = weekCounts(weekStart, today);
  const prevWeek = weekCounts(lastWeekStart, lastWeekEnd);
  const presentDelta = thisWeek.present - prevWeek.present;
  const leaveDelta = thisWeek.leave - prevWeek.leave;
  const absentDelta = thisWeek.absent - prevWeek.absent;

  const sparkDates: { date: string; present: number; label: string }[] = [];
  for (let i = 12; i >= 0; i--) {
    const d = addDays(today, -i);
    let c = 0;
    for (const p of people) {
      const st = dayStatus(
        d,
        attMap[p.id]?.[d] || null,
        today,
        parseWeeklyOff(p.weekly_off, 6)
      );
      if (st === "present" || st === "half") c++;
    }
    sparkDates.push({ date: d, present: c, label: d.slice(-2) });
  }
  const sparkMax = Math.max(1, ...sparkDates.map((s) => s.present));

  const deptToday: { name: string; present: number; total: number }[] = [];
  if (teamView) {
    const map: Record<string, { present: number; total: number }> = {};
    for (const p of people) {
      const k = p.department || "—";
      map[k] = map[k] || { present: 0, total: 0 };
      map[k].total++;
      const st = dayStatus(
        today,
        attMap[p.id]?.[today] || null,
        today,
        parseWeeklyOff(p.weekly_off, 6)
      );
      if (st === "present" || st === "half") map[k].present++;
    }
    for (const [name, v] of Object.entries(map)) deptToday.push({ name, ...v });
    deptToday.sort((a, b) => a.name.localeCompare(b.name));
  }

  const recentAtt = (
    teamView
      ? (db
          .prepare(
            `SELECT u.name AS user_name, a.date, a.punch_in_at, a.punch_out_at, a.notes
             FROM attendance a JOIN users u ON u.id = a.user_id
             WHERE a.punch_in_at IS NOT NULL
             ORDER BY COALESCE(a.punch_out_at, a.punch_in_at) DESC LIMIT 10`
          )
          .all() as {
          user_name: string;
          date: string;
          punch_in_at: number | null;
          punch_out_at: number | null;
          notes: string;
        }[])
      : (db
          .prepare(
            `SELECT u.name AS user_name, a.date, a.punch_in_at, a.punch_out_at, a.notes
             FROM attendance a JOIN users u ON u.id = a.user_id
             WHERE a.user_id = ? AND a.punch_in_at IS NOT NULL
             ORDER BY COALESCE(a.punch_out_at, a.punch_in_at) DESC LIMIT 10`
          )
          .all(user.id) as {
          user_name: string;
          date: string;
          punch_in_at: number | null;
          punch_out_at: number | null;
          notes: string;
        }[])
  );

  const activity = recentAtt.map((r) => {
    const manual = (r.notes || "").toLowerCase().includes("manual");
    const ts = r.punch_out_at || r.punch_in_at || 0;
    const kind = r.punch_out_at ? "Punch Out" : "Punch In";
    return {
      title: `Attendance · ${manual ? "Manual Entry" : kind}`,
      who: r.user_name,
      ts,
    };
  });

  const tiles = [
    has("attendance.view") || has("attendance.punch")
      ? { href: "/attendance", label: "Attendance", sub: "View history", icon: CalendarDays }
      : null,
    has("leaves.apply") || has("leaves.view")
      ? { href: "/leaves", label: "Apply leave", sub: "Request time off", icon: Palmtree }
      : null,
    has("attendance.team") || has("leaves.team")
      ? { href: "/team", label: "My team", sub: "Team overview", icon: Users }
      : null,
    has("reports.view")
      ? { href: "/reports", label: "Reports", sub: "Insights & stats", icon: BarChart3 }
      : null,
  ].filter(Boolean) as { href: string; label: string; sub: string; icon: typeof CalendarDays }[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="hidden lg:block">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Today at a glance</p>
        </div>
        <PushRegistration vapidPublicKey={getVapidPublicKey()} />
      </div>

      <PunchWidget canPunch={has("attendance.punch")} today={record} factory={factory} />

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Kpi
          tint="#07945D"
          icon={<UserCheck className="h-[17px] w-[17px]" />}
          label="Present"
          value={String(thisWeek.present).padStart(2, "0")}
          hint={`${presentDelta >= 0 ? "+" : ""}${presentDelta} this week`}
        />
        <Kpi
          tint="#D98200"
          icon={<Palmtree className="h-[17px] w-[17px]" />}
          label="Leave"
          value={String(thisWeek.leave).padStart(2, "0")}
          hint={`${leaveDelta >= 0 ? "+" : ""}${leaveDelta} this week`}
          href="/leaves"
        />
        <Kpi
          tint="#C52B35"
          icon={<UserX className="h-[17px] w-[17px]" />}
          label="Absent"
          value={String(thisWeek.absent).padStart(2, "0")}
          hint={`${absentDelta >= 0 ? "+" : ""}${absentDelta} this week`}
        />
      </div>

      {tiles.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Your workspace</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="card flex flex-col gap-3 p-4 transition hover:shadow-pop"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-tile bg-[#E1F8EF] text-flow-deep">
                  <t.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{t.label}</p>
                  <p className="text-[12px] text-muted">{t.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${teamView ? "lg:grid-cols-2" : ""}`}>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Last 13 days</h2>
            <div className="flex gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-flow" /> Present
              </span>
              <span className="flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-[#E7EEF5]" /> Absent
              </span>
            </div>
          </div>
          <div className="flex h-24 items-end gap-1">
            {sparkDates.map((s) => (
              <div key={s.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-[4px]"
                  style={{
                    height: `${Math.max(12, Math.round((s.present / sparkMax) * 100))}%`,
                    background: s.present > 0 ? "#16B878" : "#E7EEF5",
                  }}
                  title={`${s.date}: ${s.present}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            {sparkDates.map((s) => (
              <span key={s.date} className="min-w-0 flex-1 text-center text-[9px] text-muted">
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {teamView && (
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Department attendance</h2>
              <span className="text-[11px] text-muted">Today</span>
            </div>
            {deptToday.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No department data for today.</p>
            ) : (
              <div className="space-y-3">
                {deptToday.map((d) => {
                  const pct = d.total ? Math.round((d.present / d.total) * 100) : 0;
                  return (
                    <div key={d.name}>
                      <div className="mb-1 flex items-center justify-between text-[12px]">
                        <span className="font-medium text-ink">{d.name}</span>
                        <span className="tabular-nums text-muted">
                          {d.present}/{d.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#E7EEF5]">
                        <div className="h-full rounded-full bg-flow" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No recent punches yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <p className="min-w-0 text-ink">
                  <span className="font-medium">{a.title}</span>
                  <span className="text-muted">
                    {" "}
                    · {a.who} · {timeAgo(a.ts)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Leave balances</h2>
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
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                  <span className="text-[11px] font-medium text-slate-400">{b.used} used</span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{b.balance}</p>
                <p className="text-xs font-medium text-slate-500">{b.name}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  tint,
  icon,
  label,
  value,
  hint,
  href,
}: {
  tint: string;
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-bold uppercase tracking-kicker text-muted">{label}</p>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: `${tint}1c`, color: tint }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 truncate text-[22px] font-bold tabular tracking-kpi text-ink sm:text-[24px]">{value}</p>
      <p className="text-[11px] text-muted">{hint}</p>
    </>
  );
  const cls = "kpi-card transition hover:shadow-pop";
  if (href) {
    return (
      <Link href={href} className={cls} style={{ ["--kpi" as any]: tint }}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} style={{ ["--kpi" as any]: tint }}>
      {inner}
    </div>
  );
}
