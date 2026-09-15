"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  CalendarDays,
  Search,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  Phone,
  MessageCircle,
  Mail,
  Award,
  IdCard,
  Shield,
  Activity,
  Calendar,
  AlertCircle,
  Edit3,
  Sparkles,
  TrendingUp,
  FileText,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate, formatTime } from "@/lib/utils";
import { WEEKDAYS, departmentScope, DEPARTMENTS } from "@/lib/staff";
import { usePrefs } from "@/components/PrefsProvider";
import { translateLeaveName, translateWeekday } from "@/lib/i18n";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
  color: string;
  role: string;
  department: string;
  designation: string;
  weekly_off?: number;
  avatar?: string;
  today_in: number | null;
  today_out: number | null;
  staff_type?: string;
}

interface Leave {
  id: string;
  user_name: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  days: number;
}

interface MemberDetail {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    department: string;
    designation: string;
    staff_type: string;
    weekly_off: number;
    avatar?: string;
    color: string;
  };
  todayAttendance: {
    in: number | null;
    out: number | null;
    geofenced: boolean;
    isPresent: boolean;
    isCompleted: boolean;
  };
  monthStats: {
    totalDays: number;
    onTimeRate: number;
    totalHours: number;
  };
  balances: Array<{
    id: string;
    name: string;
    color: string;
    balance: number;
    used: number;
    days_per_year: number;
    accrual_rate?: string;
  }>;
  recentLeaves: Array<{
    id: string;
    start_date: string;
    end_date: string;
    days: number;
    status: string;
    reason: string;
    leave_type_name: string;
    leave_type_color: string;
  }>;
  kraSummary: {
    total: number;
    approved: number;
    score: number | null;
  } | null;
  viewerPermissions: {
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isSelf: boolean;
    canViewLeaves: boolean;
    canAdjustLeaves: boolean;
  };
}

export default function TeamClient({
  canViewAttendance,
  canViewLeaves,
  canEditWeeklyOff,
  viewerRole,
  viewerScope,
}: {
  canViewAttendance: boolean;
  canViewLeaves: boolean;
  canEditWeeklyOff: boolean;
  viewerRole: string;
  viewerScope: string;
}) {
  const { t, prefs } = usePrefs();
  const [members, setMembers] = useState<Member[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "leaves">(canViewAttendance ? "today" : "leaves");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  // Selected member drawer state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.users || []);
        setLeaves(d.leaves || []);
        setLoading(false);
      });
  }, []);

  // Fetch detailed employee data on card tap
  const handleOpenMember = async (id: string) => {
    setSelectedMemberId(id);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/team/member?id=${id}`);
      const data = await res.json();
      if (data.ok) {
        setMemberDetail(data);
      }
    } catch (err) {
      console.error("Failed to fetch member details", err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedMemberId(null);
    setMemberDetail(null);
  };

  const presentCount = members.filter((m) => m.today_in && !m.today_out).length;
  const doneCount = members.filter((m) => m.today_in && m.today_out).length;
  const absentCount = members.length - presentCount - doneCount;

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.designation && m.designation.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.department && m.department.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchDept = selectedDept === "all" || m.department === selectedDept;
      return matchSearch && matchDept;
    });
  }, [members, searchQuery, selectedDept]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-[#1E6FE0]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="relative overflow-hidden rounded-3xl border border-[#1E6FE0]/25 bg-gradient-to-br from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-5 sm:p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-500/40">
                <Users className="h-3.5 w-3.5" /> GD Foods Factory Team
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                {members.length} Members
              </span>
            </div>
            <h1 className="mt-1.5 text-[22px] sm:text-[26px] font-black tracking-tight text-white">
              {t("teamTitle")} & Directory
            </h1>
            <p className="text-[13px] text-slate-300">
              Tap any member card to view live attendance, leave balances, contact details & role scorecards.
            </p>
          </div>
        </div>

        {/* Quick Team Summary */}
        <div className="relative z-10 mt-5 grid grid-cols-3 gap-2.5 sm:gap-4 pt-4 border-t border-white/10">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold text-emerald-300">Present On-Duty</p>
            <p className="text-[20px] font-black text-white">{presentCount}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold text-blue-300">Shift Completed</p>
            <p className="text-[20px] font-black text-white">{doneCount}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold text-slate-300">Upcoming Leaves</p>
            <p className="text-[20px] font-black text-amber-300">{leaves.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs & Filters Bar */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-2xl bg-[#EEF2F7] p-1.5 w-full sm:w-auto dark:bg-[#1E293B]">
          {canViewAttendance && (
            <button
              type="button"
              onClick={() => setTab("today")}
              className={classNames(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition",
                tab === "today"
                  ? "bg-white text-[#172334] shadow-sm dark:bg-[#0F172A] dark:text-white"
                  : "text-[#8A97A8] hover:text-[#172334] dark:text-slate-400"
              )}
            >
              <MapPin className="h-4 w-4 text-[#16B878]" /> {t("todayAttendance")}
              <span className="rounded-full bg-[#E1F8EF] px-2 py-0.5 text-[10.5px] font-black text-[#06613E] dark:bg-emerald-950/40 dark:text-emerald-300">
                {presentCount + doneCount}/{members.length}
              </span>
            </button>
          )}
          {canViewLeaves && (
            <button
              type="button"
              onClick={() => setTab("leaves")}
              className={classNames(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition",
                tab === "leaves"
                  ? "bg-white text-[#172334] shadow-sm dark:bg-[#0F172A] dark:text-white"
                  : "text-[#8A97A8] hover:text-[#172334] dark:text-slate-400"
              )}
            >
              <CalendarDays className="h-4 w-4 text-[#1E6FE0]" /> {t("upcomingLeaves")}
              <span className="rounded-full bg-[#E7F1FF] px-2 py-0.5 text-[10.5px] font-black text-[#1E6FE0] dark:bg-blue-950/40 dark:text-[#38BDF8]">
                {leaves.length}
              </span>
            </button>
          )}
        </div>

        {/* Search & Dept Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[190px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchMember")}
              className="h-10 w-full rounded-xl border border-[#E3EAF1] bg-white pl-9 pr-3 text-[13px] text-[#172334] outline-none focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0F172A] dark:text-white"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="h-10 rounded-xl border border-[#E3EAF1] bg-white px-3 text-[12.5px] font-bold text-[#172334] outline-none focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0F172A] dark:text-white"
          >
            <option value="all">{t("allDepartments")}</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === "today" ? (
        /* Member Cards Grid */
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((m) => {
            const present = m.today_in && !m.today_out;
            const done = m.today_in && m.today_out;
            const canOff =
              canEditWeeklyOff &&
              (viewerRole === "super_admin" ||
                viewerRole === "admin" ||
                (viewerRole === "manager" &&
                  m.role !== "super_admin" &&
                  viewerScope === departmentScope(m.department)));

            const isYellow = m.staff_type === "yellow_card";

            return (
              <div
                key={m.id}
                onClick={() => handleOpenMember(m.id)}
                className="group relative cursor-pointer rounded-3xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-sm transition hover:border-[#1E6FE0]/50 hover:shadow-md active:scale-[0.99] dark:border-[#1E293B] dark:bg-[#0F172A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar name={m.name} color={m.color} size={48} src={avatarSrc(m.id, m.avatar)} />
                      {present && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#16B878] ring-2 ring-white dark:ring-[#0F172A]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[15px] font-black text-[#0F172A] dark:text-white group-hover:text-[#1E6FE0] transition">
                          {m.name}
                        </p>
                        {isYellow && (
                          <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            Yellow Card
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[12.5px] text-[#64748B] dark:text-[#94A3B8] font-medium">
                        {m.designation || m.role.replace("_", " ")}
                      </p>
                      <p className="mt-0.5 text-[11.5px] font-bold text-[#1E6FE0] dark:text-[#38BDF8]">
                        {m.department || "Factory Staff"}
                      </p>
                    </div>
                  </div>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#1E6FE0] dark:bg-slate-800/60 dark:group-hover:bg-blue-950/40 transition">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>

                <div className="mt-4 border-t border-[#F1F5F9] pt-3 flex flex-wrap items-center justify-between gap-2 dark:border-[#1E293B]">
                  {present && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E1F8EF] px-2.5 py-1 text-[11.5px] font-bold text-[#06613E] dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> In {formatTime(m.today_in!)}
                    </span>
                  )}
                  {done && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F1FC] px-2.5 py-1 text-[11.5px] font-bold text-[#1E6FE0] dark:bg-blue-950/40 dark:text-[#38BDF8]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Out {formatTime(m.today_out!)}
                    </span>
                  )}
                  {!m.today_in && (
                    <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[11.5px] font-semibold text-[#8A97A8] dark:bg-slate-800 dark:text-slate-400">
                      {t("notInYet")}
                    </span>
                  )}

                  <div onClick={(e) => e.stopPropagation()}>
                    {canOff ? (
                      <select
                        className="h-7 rounded-lg border border-[#E3EAF1] bg-[#F8FAFD] px-2 py-0 text-[11px] font-bold text-[#172334] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                        value={m.weekly_off ?? 6}
                        onChange={async (e) => {
                          const weekly_off = Number(e.target.value);
                          setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, weekly_off } : x)));
                          await fetch("/api/team/weekly-off", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ user_id: m.id, weekly_off }),
                          });
                        }}
                      >
                        {WEEKDAYS.map((d) => (
                          <option key={d.value} value={d.value}>
                            Off: {translateWeekday(prefs.language, d.value)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-bold text-[#8A97A8] dark:bg-slate-800 dark:text-slate-400">
                        Off: {translateWeekday(prefs.language, m.weekly_off ?? 6)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Upcoming Leaves Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {leaves.length === 0 ? (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A] sm:col-span-2">
              <CalendarDays className="mx-auto h-10 w-10 text-[#C5D0DC] mb-2" />
              <p className="text-[16px] font-bold text-[#172334] dark:text-white">{t("noUpcomingLeaves")}</p>
              <p className="text-[13px] text-[#8A97A8] mt-1">{t("approvedLeavesSub")}</p>
            </div>
          ) : (
            leaves.map((l) => (
              <div
                key={l.id}
                className="rounded-3xl border border-[#E2E8F0] bg-white flex items-center gap-4 p-5 shadow-sm hover:shadow-md transition dark:border-[#1E293B] dark:bg-[#0F172A]"
              >
                <div
                  className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-sm font-black"
                  style={{ backgroundColor: l.leave_type_color || "#1E6FE0" }}
                >
                  <span className="text-[16px] leading-none">{l.days}d</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-black text-[#0F172A] dark:text-white">{l.user_name}</p>
                  <p className="text-[13px] text-[#617083] dark:text-[#94A3B8]">
                    {translateLeaveName(prefs.language, l.leave_type_name)} · {formatDate(l.start_date)}
                    {l.start_date !== l.end_date ? ` → ${formatDate(l.end_date)}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🚀 NATIVE MOBILE BOTTOM SHEET / QUICK PROFILE DRAWER                      */}
      {/* ========================================================================= */}
      {selectedMemberId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
          <div
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-[32px] sm:rounded-3xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A] animate-slide-up"
            style={{ overscrollBehavior: "contain" }}
          >
            {/* Top Grab Handle on Mobile */}
            <div className="mx-auto -mt-2 mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />

            {/* Header / Close button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[12px] font-black uppercase tracking-wider text-slate-400">
                Staff Profile & Insights
              </span>
              <button
                onClick={handleCloseDrawer}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {drawerLoading || !memberDetail ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Spinner className="h-8 w-8 text-[#1E6FE0]" />
                <p className="mt-2 text-[13px] font-medium text-slate-500">Loading profile details...</p>
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {/* 1. Member Profile Banner */}
                <div className="flex items-start gap-4">
                  <Avatar
                    name={memberDetail.user.name}
                    color={memberDetail.user.color}
                    size={64}
                    src={avatarSrc(memberDetail.user.id, memberDetail.user.avatar)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="truncate text-[18px] font-black text-[#0F172A] dark:text-white">
                        {memberDetail.user.name}
                      </h3>
                      {memberDetail.user.staff_type === "yellow_card" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          Yellow Card Staff
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-[#1E6FE0] dark:bg-blue-950/50 dark:text-[#38BDF8]">
                          Official Tops Staff
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                      {memberDetail.user.designation || memberDetail.user.role.replace("_", " ")}
                    </p>
                    <p className="mt-0.5 text-[12px] font-bold text-[#1E6FE0] dark:text-[#38BDF8]">
                      {memberDetail.user.department} Department
                    </p>
                  </div>
                </div>

                {/* 2. Direct Contact Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {memberDetail.user.phone ? (
                    <>
                      <a
                        href={`tel:${memberDetail.user.phone}`}
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 py-2.5 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
                      >
                        <Phone className="h-4 w-4" /> Call
                      </a>
                      <a
                        href={`https://wa.me/${memberDetail.user.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-green-50 py-2.5 text-[12px] font-bold text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 transition"
                      >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    </>
                  ) : (
                    <div className="col-span-2 rounded-2xl bg-slate-50 py-2.5 text-center text-[12px] font-bold text-slate-400 dark:bg-slate-800/40">
                      No Phone Number
                    </div>
                  )}
                  <a
                    href={`mailto:${memberDetail.user.email}`}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-blue-50 py-2.5 text-[12px] font-bold text-[#1E6FE0] hover:bg-blue-100 dark:bg-blue-950/40 dark:text-[#38BDF8] transition"
                  >
                    <Mail className="h-4 w-4" /> Email
                  </a>
                </div>

                {/* 3. Today's Attendance & Shift Status */}
                <div className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-4 dark:border-slate-800 dark:bg-[#0B132B]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-black text-slate-500 uppercase tracking-wider">
                      Today's Factory Attendance
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      Off: {translateWeekday(prefs.language, memberDetail.user.weekly_off ?? 6)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    {memberDetail.todayAttendance.isPresent ? (
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[14px] font-black text-emerald-600 dark:text-emerald-400">
                          Present (In: {formatTime(memberDetail.todayAttendance.in!)})
                        </span>
                      </div>
                    ) : memberDetail.todayAttendance.isCompleted ? (
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-blue-500" />
                        <span className="text-[14px] font-black text-[#1E6FE0] dark:text-[#38BDF8]">
                          Shift Done ({formatTime(memberDetail.todayAttendance.in!)} - {formatTime(memberDetail.todayAttendance.out!)})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-slate-300" />
                        <span className="text-[14px] font-bold text-slate-500">
                          Not In Yet / Off Duty
                        </span>
                      </div>
                    )}

                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {memberDetail.monthStats.onTimeRate}% On-Time This Month
                    </span>
                  </div>
                </div>

                {/* 4. Leave Balances Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-black text-[#0F172A] dark:text-white flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-[#1E6FE0]" /> Current Leave Balances
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {memberDetail.user.staff_type === "yellow_card" ? "Earned Leave Accrual (1.25/mo)" : "Annual Quota"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {memberDetail.balances.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-[#0F172A]"
                      >
                        <p className="truncate text-[11px] font-bold text-slate-500">{b.name}</p>
                        <p className="mt-1 text-[18px] font-black" style={{ color: b.color || "#1E6FE0" }}>
                          {b.balance} <span className="text-[11px] font-bold text-slate-400">days left</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Used: {b.used} / {b.days_per_year}d
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Recent Leave History */}
                {memberDetail.recentLeaves.length > 0 && (
                  <div>
                    <span className="text-[13px] font-black text-[#0F172A] dark:text-white block mb-2">
                      Recent Leave Requests
                    </span>
                    <div className="space-y-1.5">
                      {memberDetail.recentLeaves.map((lr) => (
                        <div
                          key={lr.id}
                          className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-[12px] dark:bg-slate-800/50"
                        >
                          <div>
                            <span className="font-bold text-[#0F172A] dark:text-white">{lr.leave_type_name}</span>
                            <span className="text-slate-400 ml-1.5">({lr.days} day{lr.days > 1 ? "s" : ""})</span>
                            <p className="text-[11px] text-slate-500 font-medium">{formatDate(lr.start_date)}</p>
                          </div>
                          <span
                            className={classNames(
                              "rounded-full px-2.5 py-0.5 text-[10px] font-black",
                              lr.status === "approved"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : lr.status === "rejected"
                                ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            )}
                          >
                            {lr.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Official Staff KRA Score Summary */}
                {memberDetail.kraSummary && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/30 flex items-center justify-between">
                    <div>
                      <span className="flex items-center gap-1.5 text-[12px] font-black text-[#1E6FE0] dark:text-[#38BDF8]">
                        <Award className="h-4 w-4" /> Official Staff KRA Score
                      </span>
                      <p className="text-[11.5px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {memberDetail.kraSummary.approved} of {memberDetail.kraSummary.total} goals evaluated
                      </p>
                    </div>
                    <span className="text-[17px] font-black text-amber-500">
                      {memberDetail.kraSummary.score ? `${memberDetail.kraSummary.score} / 5.0 ⭐` : "In Progress"}
                    </span>
                  </div>
                )}

                {/* 7. Action Shortcuts for Admins */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href={`/id-card?userId=${memberDetail.user.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-[#0F172A] py-2.5 text-[12px] font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-[#0F172A] transition"
                  >
                    <IdCard className="h-4 w-4" /> View ID Badge
                  </Link>

                  {memberDetail.user.staff_type === "official" && (
                    <Link
                      href={`/kra`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-[#1E6FE0] py-2.5 text-[12px] font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
                    >
                      <Award className="h-4 w-4" /> KRA Goals
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
