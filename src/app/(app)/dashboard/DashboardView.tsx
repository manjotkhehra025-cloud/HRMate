"use client";

import Link from "next/link";
import {
  Users,
  Palmtree,
  TrendingUp,
  Send,
  PartyPopper,
  BarChart3,
} from "lucide-react";
import PunchWidget from "@/components/PunchWidget";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { usePrefs } from "@/components/PrefsProvider";
import { translateGreeting, translateLeaveName, translateTimeAgo } from "@/lib/i18n";
import { istParts } from "@/lib/utils";

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
  const { t, prefs } = usePrefs();
  const ovTotal = Math.max(1, overview.present + overview.absent + overview.onLeave);
  const presentPct = Math.round((overview.present / ovTotal) * 100);
  const absentPct = Math.round((overview.absent / ovTotal) * 100);
  const leavePct = Math.round((overview.onLeave / ovTotal) * 100);

  // Dynamic localized greeting
  const hour = new Date().getHours();
  const localizedGreeting = translateGreeting(prefs.language, hour);

  // Find Earned Leave balance
  const elBal = balances.find((b) => b.name.toLowerCase().includes("earned")) || balances[0] || {
    name: "Earned Leave",
    used: 0,
    left: 15,
    color: "#10B981",
  };

  // Find next holiday
  const nextHoliday = events[0] || {
    title: t("upcomingHoliday"),
    when: t("nextMonth"),
    in: t("soon"),
    color: "#F59E0B",
  };

  function formatActivityText(text: string) {
    if (text.includes("Punched out at")) {
      const timePart = text.replace("Punched out at", "").trim();
      return `${t("punchedOutMsg")} ${timePart}`;
    }
    if (text.includes("Punched in at")) {
      const timePart = text.replace("Punched in at", "").trim();
      return `${t("punchedInMsg")} ${timePart}`;
    }
    return text;
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Top Mobile App Header Greeting */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-black tracking-tight text-[#0F172A] sm:text-[26px]">
              {localizedGreeting}, {firstName}!
            </h1>
            <span className="text-2xl animate-bounce">👋</span>
          </div>
          <p className="mt-0.5 text-[13px] font-medium text-[#64748B]">
            {t("welcomeSub")}
          </p>
        </div>

        {canLeaves && (
          <Link
            href="/leaves"
            className="inline-flex items-center gap-1.5 self-start rounded-2xl bg-gradient-to-r from-[#059669] to-[#10B981] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition active:scale-95 hover:opacity-90"
          >
            <Send className="h-4 w-4" /> {t("applyLeave")}
          </Link>
        )}
      </div>

      {/* Hero Shift Progress Card with Selfie Punch */}
      <PunchWidget canPunch={canPunch} today={today} factory={factory} />

      {/* 4 Bento Luxury Cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Card 1: 15 Days EL Leave Balance */}
        <Link
          href="/leaves"
          className="group relative overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition active:scale-95 hover:border-[#10B981] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-[#64748B]">{t("leaveBalance")}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981]">
              <Palmtree className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-[24px] font-black tracking-tight text-[#0F172A]">
              {elBal.left} <span className="text-[14px] font-bold text-[#64748B]">{t("daysLeft")}</span>
            </p>
            <p className="text-[11px] font-bold text-[#10B981]">
              15 EL {t("allocatedQuota")}
            </p>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
            <div
              className="h-full rounded-full bg-[#10B981]"
              style={{ width: `${Math.min(100, (elBal.left / 15) * 100)}%` }}
            />
          </div>
        </Link>

        {/* Card 2: Team Members Punched In */}
        <Link
          href="/team"
          className="group relative overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition active:scale-95 hover:border-[#3B82F6] hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-[#64748B]">{t("teamWorking")}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#3B82F6]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-[24px] font-black tracking-tight text-[#0F172A]">
              {kpis.present}{" "}
              <span className="text-[14px] font-bold text-[#64748B]">/ {kpis.employees}</span>
            </p>
            <div className="mt-1 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
              <p className="text-[11px] font-bold text-[#64748B]">{presentPct}% {t("activeToday")}</p>
            </div>
          </div>
          {/* Avatar Pile */}
          <div className="mt-2 flex -space-x-1.5 overflow-hidden">
            {people.slice(0, 4).map((p) => (
              <span
                key={p.id}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-extrabold text-[#0F172A] ring-2 ring-white"
              >
                {p.name.charAt(0)}
              </span>
            ))}
          </div>
        </Link>

        {/* Card 3: Upcoming Holiday */}
        <div className="relative overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-[#64748B]">{t("upcomingHoliday")}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <PartyPopper className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="truncate text-[18px] font-black text-[#0F172A]">
              {nextHoliday.title}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
              {nextHoliday.when}
            </p>
            <span className="mt-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">
              {nextHoliday.in}
            </span>
          </div>
        </div>

        {/* Card 4: My Attendance Stats */}
        <Link
          href="/attendance"
          className="group relative overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition active:scale-95 hover:border-violet-500 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-[#64748B]">{t("myAttendanceScore")}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <p className="text-[24px] font-black tracking-tight text-violet-600">
              98.5%
            </p>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <TrendingUp className="h-3 w-3" /> {t("onTimeStreak")}
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-[#64748B]">
            {t("monthlyScore")}
          </div>
        </Link>
      </div>

      {/* Workforce Distribution Pulse */}
      <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-extrabold text-[#0F172A]">{t("workforcePulse")}</h2>
            <p className="text-[12px] text-[#64748B]">{t("workforceSub")}</p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            {t("live")}
          </span>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="mt-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-[#E2E8F0]">
            <div
              style={{ width: `${presentPct}%` }}
              className="bg-[#10B981] transition-all duration-500"
            />
            <div
              style={{ width: `${absentPct}%` }}
              className="bg-[#EF4444] transition-all duration-500"
            />
            <div
              style={{ width: `${leavePct}%` }}
              className="bg-[#F59E0B] transition-all duration-500"
            />
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-emerald-50/60 p-2.5 border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-800">{t("present")}</span>
              <p className="text-[18px] font-black text-emerald-700">{overview.present}</p>
              <span className="text-[10px] text-emerald-600 font-semibold">{presentPct}%</span>
            </div>

            <div className="rounded-2xl bg-rose-50/60 p-2.5 border border-rose-100">
              <span className="text-[11px] font-bold text-rose-800">{t("absent")}</span>
              <p className="text-[18px] font-black text-rose-700">{overview.absent}</p>
              <span className="text-[10px] text-rose-600 font-semibold">{absentPct}%</span>
            </div>

            <div className="rounded-2xl bg-amber-50/60 p-2.5 border border-amber-100">
              <span className="text-[11px] font-bold text-amber-800">{t("onLeave")}</span>
              <p className="text-[18px] font-black text-amber-700">{overview.onLeave}</p>
              <span className="text-[10px] text-amber-600 font-semibold">{leavePct}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Activity Timeline */}
      <section className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-extrabold text-[#0F172A]">{t("recentActivity")}</h2>
            <p className="text-[12px] text-[#64748B]">{t("historyStatus")}</p>
          </div>
          <Link
            href="/attendance"
            className="text-[12px] font-bold text-[#1E6FE0] hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-[#94A3B8]">
            {t("noNotifications")}
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {activity.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={a.name} color={a.color} size={36} src={avatarSrc(a.userId, a.avatar)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[#0F172A]">{a.name}</p>
                  <p className="truncate text-[12px] text-[#64748B]">{formatActivityText(a.text)}</p>
                </div>
                <span className="text-[11px] font-semibold text-[#94A3B8]">{translateTimeAgo(prefs.language, a.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
