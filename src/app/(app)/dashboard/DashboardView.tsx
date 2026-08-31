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
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle,
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
    <svg viewBox="0 0 100 32" className="mt-3 h-9 w-full" preserveAspectRatio="none">
      <polyline fill={`${color}20`} stroke="none" points={area} />
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
    <svg viewBox="0 0 42 42" className="h-[148px] w-[148px] -rotate-90">
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#E8EEF4" strokeWidth="5.5" />
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#16B878" strokeWidth="5.5" strokeDasharray={`${p} ${c}`} strokeLinecap="round" />
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#E11D48" strokeWidth="5.5" strokeDasharray={`${a} ${c}`} strokeDashoffset={-p} strokeLinecap="round" />
      <circle cx="21" cy="21" r="15.5" fill="none" stroke="#F5A623" strokeWidth="5.5" strokeDasharray={`${l} ${c}`} strokeDashoffset={-(p + a)} strokeLinecap="round" />
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
    <div className="space-y-6 pb-6">
      {/* Top Search Bar for Web */}
      <div className="relative hidden lg:block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Quick search team members, leaves, designations..."
          className="h-12 w-full rounded-[14px] border border-[#E3EAF1] bg-white pl-11 pr-24 text-[14px] text-[#172334] shadow-[0_2px_8px_rgba(18,58,99,0.04)] outline-none transition focus:border-[#1E6FE0] focus:ring-2 focus:ring-[#1E6FE0]/15"
        />
        <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md bg-[#F4F7FB] px-2 py-1 text-[11px] font-semibold text-[#8A97A8] border border-[#E3EAF1]">
          Quick Search
        </div>
        {hits.length > 0 && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-[16px] border border-[#E3EAF1] bg-white py-1.5 shadow-pop animate-fade-in">
            <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#8A97A8]">
              Employees Matching
            </p>
            {hits.map((p) => (
              <Link
                key={p.id}
                href="/team"
                className="flex items-center justify-between px-4 py-2.5 text-sm transition hover:bg-[#F8FAFD]"
              >
                <span className="font-semibold text-[#172334]">{p.name}</span>
                <span className="text-[12.5px] text-[#8A97A8]">{p.designation || "Staff"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Greeting Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] font-bold tracking-tight text-[#172334] lg:text-[30px]">
              {greeting}, {firstName}!
            </h1>
            <span className="inline-flex text-2xl" role="img" aria-label="wave">
              👋
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[#617083]">
            Welcome to your workspace dashboard. Here is today&apos;s real-time company overview.
          </p>
        </div>

        {/* Quick Action Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setQuick((v) => !v)}
            className="flex h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(30,111,224,0.3)] transition hover:bg-[#1556B8]"
          >
            <Plus className="h-4 w-4" /> Quick Actions <ChevronDown className="h-4 w-4" />
          </button>
          {quick && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setQuick(false)} />
              <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-[16px] border border-[#E3EAF1] bg-white py-1.5 shadow-pop animate-fade-in">
                <Link
                  href="/attendance"
                  onClick={() => setQuick(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium text-[#172334] hover:bg-[#F8FAFD]"
                >
                  <Clock className="h-4 w-4 text-[#1E6FE0]" /> Punch / Attendance
                </Link>
                {canLeaves && (
                  <Link
                    href="/leaves"
                    onClick={() => setQuick(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium text-[#172334] hover:bg-[#F8FAFD]"
                  >
                    <CalendarDays className="h-4 w-4 text-[#16B878]" /> Apply for Leave
                  </Link>
                )}
                {canApprovals && (
                  <Link
                    href="/approvals"
                    onClick={() => setQuick(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium text-[#172334] hover:bg-[#F8FAFD]"
                  >
                    <CheckCircle className="h-4 w-4 text-[#F5A623]" /> Review Approvals
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Live Punch Widget */}
      <PunchWidget canPunch={canPunch} today={today} factory={factory} />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          color="#1E6FE0"
          bgGradient="from-[#1E6FE0]/10 to-transparent"
          icon={<Users className="h-5 w-5 text-white" />}
          label="Total Employees"
          value={kpis.employees}
          hint={kpis.hiredThisMonth >= 0 ? `+${kpis.hiredThisMonth} this month` : `${kpis.hiredThisMonth} this month`}
          hintTone="green"
          spark={sparks.employees}
        />
        <KpiCard
          color="#16B878"
          bgGradient="from-[#16B878]/10 to-transparent"
          icon={<CalendarDays className="h-5 w-5 text-white" />}
          label="Present Today"
          value={kpis.present}
          hint={`${kpis.presentPct >= 0 ? "↑" : "↓"} ${Math.abs(kpis.presentPct)}% vs yesterday`}
          hintTone={kpis.presentPct >= 0 ? "green" : "red"}
          spark={sparks.present}
        />
        <KpiCard
          color="#F5A623"
          bgGradient="from-[#F5A623]/10 to-transparent"
          icon={<Palmtree className="h-5 w-5 text-white" />}
          label="On Leave"
          value={kpis.onLeave}
          hint={`${kpis.leavePct >= 0 ? "↑" : "↓"} ${Math.abs(kpis.leavePct)}% vs yesterday`}
          hintTone={kpis.leavePct > 0 ? "amber" : "green"}
          spark={sparks.leave}
        />
        <KpiCard
          color="#7B61FF"
          bgGradient="from-[#7B61FF]/10 to-transparent"
          icon={<FileText className="h-5 w-5 text-white" />}
          label="Pending Approvals"
          value={kpis.pending}
          hint="Action required"
          hintTone="purple"
          spark={sparks.pending}
          href={canApprovals ? "/approvals" : undefined}
        />
      </div>

      {/* 3-Column Mid Section */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Attendance Donut Overview */}
        <section className="card p-6 xl:col-span-1 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#172334]">Attendance Overview</h2>
                <p className="text-[12.5px] text-[#8A97A8]">Today&apos;s workforce distribution</p>
              </div>
              <span className="rounded-full bg-[#E7F1FF] px-3 py-1 text-[11px] font-bold text-[#1E6FE0]">
                Live
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 py-2">
              <div className="relative flex items-center justify-center">
                <Donut present={overview.present} absent={overview.absent} leave={overview.onLeave} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[26px] font-bold tabular-nums leading-none text-[#172334]">
                    {overview.present}
                  </p>
                  <p className="mt-1 text-[11.5px] font-semibold text-[#8A97A8]">Present</p>
                </div>
              </div>

              <div className="min-w-[150px] flex-1 space-y-3 text-[13px]">
                <Legend color="#16B878" label="Present" n={overview.present} pct={presentPct} />
                <Legend color="#E11D48" label="Absent" n={overview.absent} pct={absentPct} />
                <Legend color="#F5A623" label="On Leave" n={overview.onLeave} pct={leavePct} />
              </div>
            </div>
          </div>

          {canReports && (
            <div className="mt-5 border-t border-[#F0F4F8] pt-4">
              <Link
                href="/reports"
                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1E6FE0] hover:underline"
              >
                View detailed monthly report <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>

        {/* Recent Activity Feed */}
        <section className="card p-6 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#172334]">Recent Activity</h2>
                <p className="text-[12.5px] text-[#8A97A8]">Live punches & updates</p>
              </div>
              <Link href="/attendance" className="text-[12.5px] font-bold text-[#1E6FE0] hover:underline">
                View all
              </Link>
            </div>

            {activity.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#8A97A8]">
                No recent activity recorded today.
              </div>
            ) : (
              <ul className="space-y-3.5">
                {activity.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-[12px] p-1.5 transition hover:bg-[#F8FAFD]">
                    <Avatar name={a.name} color={a.color} size={38} src={avatarSrc(a.userId, a.avatar)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-[#172334]">{a.name}</p>
                      <p className="truncate text-[12px] text-[#617083]">{a.text}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-[#8A97A8]">{timeAgo(a.ts)}</span>
                    <span
                      className={classNames(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
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
          </div>
        </section>

        {/* Feature Banner */}
        <section className="flow-gradient relative flex flex-col justify-between overflow-hidden rounded-[18px] p-6 text-white shadow-glow">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11.5px] font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-white" /> Enterprise HRMS
            </span>
            <h3 className="mt-4 max-w-[17rem] text-[22px] font-bold leading-tight">
              All your HR operations in one smart platform.
            </h3>
            <p className="mt-2 max-w-[17rem] text-[13.5px] text-white/90">
              Simplify Attendance, Leaves, Team management, and Reports effortlessly.
            </p>
          </div>

          <div className="relative z-10 mt-6">
            <Link
              href={canReports ? "/reports" : "/attendance"}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13.5px] font-bold text-[#1E6FE0] shadow-md transition hover:bg-[#F4F7FB]"
            >
              Explore Reports <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <Fingerprint className="pointer-events-none absolute -bottom-6 -right-6 h-36 w-36 text-white/10" />
        </section>
      </div>

      {/* 2-Column Bottom Section (Leaves + Events) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Leave Summary */}
        <section className="card p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-bold text-[#172334]">Leave Summary</h2>
              <p className="text-[12.5px] text-[#8A97A8]">Balances and monthly requests</p>
            </div>
            <span className="rounded-full bg-[#F4F7FB] border border-[#E3EAF1] px-3 py-1 text-[11px] font-bold text-[#617083]">
              This Month
            </span>
          </div>

          {/* Leave Balance Mini Meters */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {balances.slice(0, 4).map((b) => (
              <div key={b.id} className="rounded-[14px] bg-[#F8FAFD] border border-[#E3EAF1] p-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: `${b.color}22`, color: b.color }}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-[#8A97A8]">{b.name}</p>
                    <p className="text-[16px] font-bold text-[#172334]">
                      {b.used}{" "}
                      <span className="text-[11.5px] font-normal text-[#8A97A8]">/ {b.left} left</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E8EEF4]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (b.used / Math.max(1, b.used + b.left)) * 100)}%`,
                      background: b.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Leave Requests Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-[#E3EAF1] text-[11px] font-bold uppercase tracking-wider text-[#8A97A8]">
                  <th className="pb-2.5 font-bold">Employee</th>
                  <th className="pb-2.5 font-bold">Leave Type</th>
                  <th className="pb-2.5 font-bold">From</th>
                  <th className="pb-2.5 font-bold">To</th>
                  <th className="pb-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F8]">
                {leaveRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#8A97A8]">
                      No leave requests submitted this month.
                    </td>
                  </tr>
                ) : (
                  leaveRows.slice(0, 5).map((r) => (
                    <tr key={r.id} className="transition hover:bg-[#F8FAFD]">
                      <td className="py-3 font-semibold text-[#172334]">{r.name}</td>
                      <td className="py-3 text-[#617083]">{r.type}</td>
                      <td className="py-3 text-[#617083]">{formatDate(r.from)}</td>
                      <td className="py-3 text-[#617083]">{formatDate(r.to)}</td>
                      <td className="py-3">
                        <span
                          className={classNames(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
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

          <div className="mt-4 border-t border-[#F0F4F8] pt-3">
            <Link
              href="/leaves"
              className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#1E6FE0] hover:underline"
            >
              View all leave records <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Upcoming Events */}
        <section className="card p-6 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#172334]">Upcoming Events</h2>
                <p className="text-[12.5px] text-[#8A97A8]">Holidays & schedule</p>
              </div>
              <Link href="/leaves" className="text-[12.5px] font-bold text-[#1E6FE0] hover:underline">
                View all
              </Link>
            </div>

            {events.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[#8A97A8]">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-3.5">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-[12px] p-2 transition hover:bg-[#F8FAFD]">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
                      style={{ background: `${e.color}22`, color: e.color }}
                    >
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-[#172334]">{e.title}</p>
                      <p className="text-[12px] text-[#8A97A8]">{e.when}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#F4F7FB] border border-[#E3EAF1] px-2.5 py-0.5 text-[11px] font-semibold text-[#617083]">
                      {e.in}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Legend({ color, label, n, pct }: { color: string; label: string; n: number; pct: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 font-medium text-[#172334]">
        <i className="h-3 w-3 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums font-bold text-[#617083]">
        {n} <span className="text-[11.5px] font-normal text-[#8A97A8]">({pct}%)</span>
      </span>
    </div>
  );
}

function KpiCard({
  color,
  bgGradient,
  icon,
  label,
  value,
  hint,
  hintTone,
  spark,
  href,
}: {
  color: string;
  bgGradient?: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  hintTone: "green" | "red" | "amber" | "purple";
  spark: number[];
  href?: string;
}) {
  const toneMap = {
    green: "bg-[#E1F8EF] text-[#06613E]",
    red: "bg-[#FDECEC] text-[#C52B35]",
    amber: "bg-[#FFF4E0] text-[#D98200]",
    purple: "bg-[#F3E8FF] text-[#7E22CE]",
  };

  const inner = (
    <div className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#8A97A8]">{label}</p>
          <p className="mt-1.5 text-[30px] font-bold tabular-nums leading-none text-[#172334]">
            {value}
          </p>
          <div className="mt-2.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${toneMap[hintTone]}`}>
              <TrendingUp className="h-3 w-3" />
              {hint}
            </span>
          </div>
        </div>
        <span
          className="flex h-12 w-12 items-center justify-center rounded-[14px] shadow-sm"
          style={{ background: color }}
        >
          {icon}
        </span>
      </div>
      <Spark color={color} values={spark} />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="card transition hover:shadow-pop hover:-translate-y-0.5">
        {inner}
      </Link>
    );
  }
  return <div className="card">{inner}</div>;
}
