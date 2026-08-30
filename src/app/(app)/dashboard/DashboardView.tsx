"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Palmtree,
  FileText,
  ChevronDown,
  Plus,
  ArrowRight,
  Fingerprint,
  Search,
} from "lucide-react";
import PunchWidget from "@/components/PunchWidget";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { classNames, formatDate, timeAgo } from "@/lib/utils";

export type DashKpi = {
  employees: number;
  hiredThisMonth: number;
  present: number;
  presentPct: number;
  onLeave: number;
  leavePct: number;
  pending: number;
};

export type DashActivity = {
  id: string;
  name: string;
  text: string;
  ts: number;
  color: string;
  avatar?: string;
  userId: string;
  tone: "green" | "amber" | "blue" | "purple";
};

export type DashLeaveBal = {
  id: string;
  name: string;
  used: number;
  left: number;
  color: string;
};

export type DashLeaveRow = {
  id: string;
  name: string;
  type: string;
  from: string;
  to: string;
  status: string;
};

export type DashEvent = {
  id: string;
  title: string;
  when: string;
  in: string;
  color: string;
};

function Spark({ color, values }: { color: string; values: number[] }) {
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100;
      const y = 26 - (v / max) * 20;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,32 ${pts} 100,32`;
  return (
    <svg viewBox="0 0 100 32" className="mt-3 h-10 w-full" preserveAspectRatio="none">
      <polyline fill={`${color}22`} stroke="none" points={area} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function Donut({
  present,
  absent,
  leave,
}: {
  present: number;
  absent: number;
  leave: number;
}) {
  const total = Math.max(1, present + absent + leave);
  const c = 2 * Math.PI * 15.5;
  const p = (present / total) * c;
  const a = (absent / total) * c;
  const l = (leave / total) * c;
  return (
    <svg viewBox="0 0 42 42" className="h-[140px] w-[140px] -rotate-90">
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#E8EEF4" strokeWidth="6" />
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#16B878" strokeWidth="6" strokeDasharray={`${p} ${c}`} strokeLinecap="round" />
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#E11D48" strokeWidth="6" strokeDasharray={`${a} ${c}`} strokeDashoffset={-p} strokeLinecap="round" />
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#F5A623" strokeWidth="6" strokeDasharray={`${l} ${c}`} strokeDashoffset={-(p + a)} strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardView({
  firstName,
  greeting,
  canPunch,
  today,
  factory,
  kpis,
  sparks,
  overview,
  activity,
  balances,
  leaveRows,
  events,
  people,
  canApprovals,
  canLeaves,
  canReports,
}: {
  firstName: string;
  greeting: string;
  canPunch: boolean;
  today: any;
  factory: { name: string; radius: number; address: string };
  kpis: DashKpi;
  sparks: { employees: number[]; present: number[]; leave: number[]; pending: number[] };
  overview: { present: number; absent: number; onLeave: number };
  activity: DashActivity[];
  balances: DashLeaveBal[];
  leaveRows: DashLeaveRow[];
  events: DashEvent[];
  people: { id: string; name: string; designation: string }[];
  canApprovals: boolean;
  canLeaves: boolean;
  canReports: boolean;
}) {
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(false);
  const ovTotal = Math.max(1, overview.present + overview.absent + overview.onLeave);
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 1) return [];
    return people.filter((p) => p.name.toLowerCase().includes(s)).slice(0, 6);
  }, [q, people]);

  const presentPct = Math.round((overview.present / ovTotal) * 100);
  const absentPct = Math.round((overview.absent / ovTotal) * 100);
  const leavePct = Math.round((overview.onLeave / ovTotal) * 100);

  return (
    <div className="space-y-5 pb-4">
      <div className="relative hidden lg:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search employees, leaves, documents..."
          className="h-11 w-full rounded-full border border-[#E3EAF1] bg-white pl-10 pr-4 text-[13.5px] text-[#172334] outline-none focus:border-[#1E6FE0]"
        />
        {hits.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[14px] border border-line bg-white py-1 shadow-pop">
            {hits.map((p) => (
              <Link key={p.id} href="/team" className="block px-4 py-2.5 text-sm hover:bg-[#F8FAFD]">
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-muted"> · {p.designation || "Staff"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#172334] lg:text-[30px]">
            {greeting}, {firstName}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-[14px] text-[#8A97A8]">Here&apos;s what&apos;s happening in your workspace today.</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setQuick((v) => !v)}
            className="flex h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[14px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Quick Action <ChevronDown className="h-4 w-4" />
          </button>
          {quick && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setQuick(false)} />
              <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-[14px] border border-line bg-white py-1 shadow-pop">
                <Link href="/attendance" onClick={() => setQuick(false)} className="block px-3 py-2.5 text-sm font-medium text-ink hover:bg-[#F8FAFD]">
                  Punch / attendance
                </Link>
                {canLeaves && (
                  <Link href="/leaves" onClick={() => setQuick(false)} className="block px-3 py-2.5 text-sm font-medium text-ink hover:bg-[#F8FAFD]">
                    Apply leave
                  </Link>
                )}
                {canApprovals && (
                  <Link href="/approvals" onClick={() => setQuick(false)} className="block px-3 py-2.5 text-sm font-medium text-ink hover:bg-[#F8FAFD]">
                    Review approvals
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <PunchWidget canPunch={canPunch} today={today} factory={factory} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          color="#1E6FE0"
          icon={<Users className="h-5 w-5" />}
          label="Total Employees"
          value={kpis.employees}
          hint={kpis.hiredThisMonth >= 0 ? `↑ ${kpis.hiredThisMonth} this month` : `${kpis.hiredThisMonth} this month`}
          hintColor="#16B878"
          spark={sparks.employees}
        />
        <KpiCard
          color="#16B878"
          icon={<CalendarDays className="h-5 w-5" />}
          label="Present Today"
          value={kpis.present}
          hint={`${kpis.presentPct >= 0 ? "↑" : "↓"} ${Math.abs(kpis.presentPct)}% than yesterday`}
          hintColor={kpis.presentPct >= 0 ? "#16B878" : "#E11D48"}
          spark={sparks.present}
        />
        <KpiCard
          color="#F5A623"
          icon={<Palmtree className="h-5 w-5" />}
          label="On Leave"
          value={kpis.onLeave}
          hint={`${kpis.leavePct >= 0 ? "↑" : "↓"} ${Math.abs(kpis.leavePct)}% than yesterday`}
          hintColor={kpis.leavePct > 0 ? "#E11D48" : "#16B878"}
          spark={sparks.leave}
        />
        <KpiCard
          color="#7B61FF"
          icon={<FileText className="h-5 w-5" />}
          label="Pending Approvals"
          value={kpis.pending}
          hint="Review and approve"
          hintColor="#8A97A8"
          spark={sparks.pending}
          href={canApprovals ? "/approvals" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#172334]">Attendance Overview</h2>
            <span className="rounded-full border border-[#E3EAF1] px-2.5 py-1 text-[11px] font-semibold text-[#617083]">Today</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              <Donut present={overview.present} absent={overview.absent} leave={overview.onLeave} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[22px] font-bold leading-none text-[#172334]">{overview.present}</p>
                <p className="text-[11px] text-[#8A97A8]">Present</p>
              </div>
            </div>
            <div className="min-w-[140px] flex-1 space-y-2.5 text-[13px]">
              <Legend color="#16B878" label="Present" n={overview.present} pct={presentPct} />
              <Legend color="#E11D48" label="Absent" n={overview.absent} pct={absentPct} />
              <Legend color="#F5A623" label="On Leave" n={overview.onLeave} pct={leavePct} />
            </div>
          </div>
          {canReports && (
            <Link href="/reports" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#1E6FE0]">
              View full report <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#172334]">Recent Activity</h2>
            <Link href="/attendance" className="text-[12px] font-semibold text-[#1E6FE0]">
              View all
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No recent activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <Avatar name={a.name} color={a.color} size={36} src={avatarSrc(a.userId, a.avatar)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#172334]">{a.name}</p>
                    <p className="truncate text-[12px] text-[#8A97A8]">{a.text}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#8A97A8]">{timeAgo(a.ts)}</span>
                  <span
                    className={classNames(
                      "h-2 w-2 shrink-0 rounded-full",
                      a.tone === "green" && "bg-[#16B878]",
                      a.tone === "amber" && "bg-[#F5A623]",
                      a.tone === "blue" && "bg-[#1E6FE0]",
                      a.tone === "purple" && "bg-[#7B61FF]"
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flow-gradient relative overflow-hidden rounded-[18px] p-5 text-white shadow-glow">
          <p className="max-w-[16rem] text-[22px] font-bold leading-tight">All your HR in one smart place.</p>
          <p className="mt-2 max-w-[16rem] text-[13px] text-white/85">Simplify Attendance, Leaves, Payroll and more.</p>
          <Link
            href={canReports ? "/reports" : "/attendance"}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#1E6FE0]"
          >
            Explore features <ArrowRight className="h-4 w-4" />
          </Link>
          <Fingerprint className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 text-white/15" />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#172334]">Leave Summary</h2>
            <span className="rounded-full border border-[#E3EAF1] px-2.5 py-1 text-[11px] font-semibold text-[#617083]">This Month</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {balances.slice(0, 4).map((b) => (
              <div key={b.id} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ background: `${b.color}22`, color: b.color }}>
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] text-[#8A97A8]">{b.name}</p>
                    <p className="text-[16px] font-bold text-[#172334]">
                      {b.used} <span className="text-[12px] font-medium text-[#8A97A8]">/ {b.left} left</span>
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#E8EEF4]">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (b.used / Math.max(1, b.used + b.left)) * 100)}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#8A97A8]">
                  <th className="pb-2 font-semibold">Employee</th>
                  <th className="pb-2 font-semibold">Leave Type</th>
                  <th className="pb-2 font-semibold">From</th>
                  <th className="pb-2 font-semibold">To</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaveRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted">
                      No leave requests this month.
                    </td>
                  </tr>
                ) : (
                  leaveRows.slice(0, 5).map((r) => (
                    <tr key={r.id} className="border-t border-[#F0F4F8]">
                      <td className="py-2.5 font-medium text-[#172334]">{r.name}</td>
                      <td className="py-2.5 text-[#617083]">{r.type}</td>
                      <td className="py-2.5 text-[#617083]">{formatDate(r.from)}</td>
                      <td className="py-2.5 text-[#617083]">{formatDate(r.to)}</td>
                      <td className="py-2.5">
                        <span
                          className={classNames(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            r.status === "approved" && "bg-[#E1F8EF] text-[#06613E]",
                            r.status === "pending" && "bg-[#FFF1E8] text-[#C2410C]",
                            r.status === "rejected" && "bg-rose-50 text-rose-700"
                          )}
                        >
                          {r.status === "approved" ? "Approved" : r.status === "pending" ? "Pending" : "Rejected"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link href="/leaves" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#1E6FE0]">
            View all leaves <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[#172334]">Upcoming Events</h2>
            <Link href="/leaves" className="text-[12px] font-semibold text-[#1E6FE0]">
              View all
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nothing upcoming.</p>
          ) : (
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: `${e.color}22`, color: e.color }}>
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#172334]">{e.title}</p>
                    <p className="text-[12px] text-[#8A97A8]">{e.when}</p>
                  </div>
                  <span className="shrink-0 text-[12px] text-[#8A97A8]">{e.in}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Legend({ color, label, n, pct }: { color: string; label: string; n: number; pct: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums text-[#617083]">
        {n} ({pct}%)
      </span>
    </div>
  );
}

function KpiCard({
  color,
  icon,
  label,
  value,
  hint,
  hintColor,
  spark,
  href,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  hintColor: string;
  spark: number[];
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-[#8A97A8]">{label}</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[#172334]">{value}</p>
          <p className="mt-1.5 text-[12px] font-semibold" style={{ color: hintColor }}>
            {hint}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] text-white" style={{ background: color }}>
          {icon}
        </span>
      </div>
      <Spark color={color} values={spark} />
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card p-4 transition hover:shadow-pop">
        {inner}
      </Link>
    );
  }
  return <div className="card p-4">{inner}</div>;
}
