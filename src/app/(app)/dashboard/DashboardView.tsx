"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Palmtree,
  FileText,
  Clock,
  MessageSquare,
  Sparkles,
  ArrowRight,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Send,
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
  const ovTotal = Math.max(1, overview.present + overview.absent + overview.onLeave);
  const presentPct = Math.round((overview.present / ovTotal) * 100);
  const absentPct = Math.round((overview.absent / ovTotal) * 100);
  const leavePct = Math.round((overview.onLeave / ovTotal) * 100);

  return (
    <div className="space-y-5 pb-8">
      {/* Mobile Greeting & Quick Greeting Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-black tracking-tight text-[#0F172A] sm:text-[26px]">
              {greeting}, {firstName}!
            </h1>
            <span className="text-2xl animate-bounce">👋</span>
          </div>
          <p className="mt-0.5 text-[13px] font-medium text-[#64748B]">
            Here is your daily workspace snapshot for today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canLeaves && (
            <Link
              href="/leaves"
              className="flex items-center gap-1.5 rounded-2xl bg-[#10B981] px-4 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] transition active:scale-95 hover:bg-[#059669]"
            >
              <Send className="h-4 w-4" /> Apply Leave
            </Link>
          )}
        </div>
      </div>

      {/* Hero Punch Card */}
      <PunchWidget canPunch={canPunch} today={today} factory={factory} />

      {/* App Quick Actions (4-Column Squircle Buttons) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/attendance"
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition active:scale-95 hover:border-[#1E6FE0] hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1E6FE0] transition group-hover:scale-110">
            <Clock className="h-6 w-6" />
          </div>
          <span className="mt-2 text-[13px] font-bold text-[#0F172A]">My Attendance</span>
          <span className="text-[11px] text-[#64748B]">History & Shifts</span>
        </Link>

        {canLeaves && (
          <Link
            href="/leaves"
            className="group flex flex-col items-center justify-center rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition active:scale-95 hover:border-[#10B981] hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#10B981] transition group-hover:scale-110">
              <Palmtree className="h-6 w-6" />
            </div>
            <span className="mt-2 text-[13px] font-bold text-[#0F172A]">Leave Portal</span>
            <span className="text-[11px] text-[#64748B]">Apply & Balance</span>
          </Link>
        )}

        <Link
          href="/team"
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition active:scale-95 hover:border-violet-500 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 transition group-hover:scale-110">
            <Users className="h-6 w-6" />
          </div>
          <span className="mt-2 text-[13px] font-bold text-[#0F172A]">Team Staff</span>
          <span className="text-[11px] text-[#64748B]">Directory & Offs</span>
        </Link>

        <Link
          href={canApprovals ? "/approvals" : canReports ? "/reports" : "/wall"}
          className="group flex flex-col items-center justify-center rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition active:scale-95 hover:border-amber-500 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition group-hover:scale-110">
            {canApprovals ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <MessageSquare className="h-6 w-6" />
            )}
          </div>
          <span className="mt-2 text-[13px] font-bold text-[#0F172A]">
            {canApprovals ? "Approvals" : canReports ? "Reports" : "Social Wall"}
          </span>
          <span className="text-[11px] text-[#64748B]">
            {canApprovals ? `${kpis.pending} pending` : "Updates"}
          </span>
        </Link>
      </div>

      {/* Workforce KPI Stats Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Total Staff */}
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#64748B]">Total Staff</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#1E6FE0]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[24px] font-black text-[#0F172A]">{kpis.employees}</p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <TrendingUp className="h-3 w-3" /> {kpis.hiredThisMonth >= 0 ? `+${kpis.hiredThisMonth} this mo.` : `${kpis.hiredThisMonth}`}
          </div>
        </div>

        {/* Present Today */}
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#64748B]">Present Today</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981]">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[24px] font-black text-emerald-600">{kpis.present}</p>
          <div className="mt-1 text-[11px] font-bold text-[#64748B]">
            {presentPct}% workforce
          </div>
        </div>

        {/* On Leave */}
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#64748B]">On Leave</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Palmtree className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[24px] font-black text-amber-600">{kpis.onLeave}</p>
          <div className="mt-1 text-[11px] font-bold text-[#64748B]">
            {leavePct}% off today
          </div>
        </div>

        {/* Pending Approvals */}
        <Link
          href={canApprovals ? "/approvals" : "/leaves"}
          className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition hover:border-[#1E6FE0]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#64748B]">Pending Tasks</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-[24px] font-black text-purple-600">{kpis.pending}</p>
          <div className="mt-1 text-[11px] font-bold text-purple-600">
            Action required →
          </div>
        </Link>
      </div>

      {/* My Leave Balances Cards */}
      <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-extrabold text-[#0F172A]">My Leave Balances</h2>
            <p className="text-[12px] text-[#64748B]">Available quota for this year</p>
          </div>
          <Link
            href="/leaves"
            className="flex items-center gap-1 text-[12px] font-bold text-[#10B981] hover:underline"
          >
            Apply <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {balances.slice(0, 3).map((b) => (
            <div
              key={b.id}
              className="relative overflow-hidden rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#0F172A]">{b.name}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: `${b.color}15`, color: b.color }}
                >
                  {b.left} Left
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[20px] font-black text-[#0F172A]">{b.used}</span>
                <span className="text-[12px] text-[#64748B]">used of {b.used + b.left} allocated</span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
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
      </section>

      {/* Two Columns: Recent Activity & Attendance Breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Attendance Distribution */}
        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#0F172A]">Attendance Pulse</h2>
              <p className="text-[12px] text-[#64748B]">Real-time factory attendance breakdown</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Live
            </span>
          </div>

          {/* Multi-segment Progress Bar */}
          <div className="mt-3">
            <div className="flex h-3.5 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                style={{ width: `${presentPct}%` }}
                className="bg-[#10B981] transition-all duration-500"
                title={`Present: ${overview.present}`}
              />
              <div
                style={{ width: `${absentPct}%` }}
                className="bg-[#EF4444] transition-all duration-500"
                title={`Absent: ${overview.absent}`}
              />
              <div
                style={{ width: `${leavePct}%` }}
                className="bg-[#F59E0B] transition-all duration-500"
                title={`On Leave: ${overview.onLeave}`}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-emerald-50/60 p-2.5 border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-800">Present</span>
                <p className="text-[18px] font-black text-emerald-700">{overview.present}</p>
                <span className="text-[10px] text-emerald-600 font-semibold">{presentPct}%</span>
              </div>

              <div className="rounded-2xl bg-rose-50/60 p-2.5 border border-rose-100">
                <span className="text-[11px] font-bold text-rose-800">Absent</span>
                <p className="text-[18px] font-black text-rose-700">{overview.absent}</p>
                <span className="text-[10px] text-rose-600 font-semibold">{absentPct}%</span>
              </div>

              <div className="rounded-2xl bg-amber-50/60 p-2.5 border border-amber-100">
                <span className="text-[11px] font-bold text-amber-800">On Leave</span>
                <p className="text-[18px] font-black text-amber-700">{overview.onLeave}</p>
                <span className="text-[10px] text-amber-600 font-semibold">{leavePct}%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Activity Feed */}
        <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#0F172A]">Recent Activity</h2>
              <p className="text-[12px] text-[#64748B]">Live check-ins and updates</p>
            </div>
            <Link
              href="/attendance"
              className="text-[12px] font-bold text-[#1E6FE0] hover:underline"
            >
              View All
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[#94A3B8]">
              No activity recorded today yet.
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {activity.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={a.name} color={a.color} size={36} src={avatarSrc(a.userId, a.avatar)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#0F172A]">{a.name}</p>
                    <p className="truncate text-[12px] text-[#64748B]">{a.text}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#94A3B8]">{timeAgo(a.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
