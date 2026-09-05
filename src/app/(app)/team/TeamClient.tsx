"use client";

import { useState, useEffect, useMemo } from "react";
import { MapPin, CalendarDays, Search, Users, CheckCircle2, Clock } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate, formatTime } from "@/lib/utils";
import { WEEKDAYS, departmentScope, weeklyOffLabel, DEPARTMENTS } from "@/lib/staff";
import { usePrefs } from "@/components/PrefsProvider";
import { translateLeaveName } from "@/lib/i18n";

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

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.users || []);
        setLeaves(d.leaves || []);
        setLoading(false);
      });
  }, []);

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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-[#1E6FE0]" />
          <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
            {t("teamTitle")}
          </h1>
        </div>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
          {t("teamSub")}
        </p>
      </div>

      {/* Tabs & Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-[14px] bg-[#EEF2F7] p-1 w-full sm:w-auto">
          {canViewAttendance && (
            <button
              type="button"
              onClick={() => setTab("today")}
              className={classNames(
                "flex items-center justify-center gap-2 rounded-[12px] px-5 py-2.5 text-[13.5px] font-bold transition",
                tab === "today" ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
              )}
            >
              <MapPin className="h-4 w-4 text-[#16B878]" /> {t("todayAttendance")}
              <span className="rounded-full bg-[#E1F8EF] px-2 py-0.5 text-[11px] font-bold text-[#06613E]">
                {presentCount + doneCount}/{members.length}
              </span>
            </button>
          )}
          {canViewLeaves && (
            <button
              type="button"
              onClick={() => setTab("leaves")}
              className={classNames(
                "flex items-center justify-center gap-2 rounded-[12px] px-5 py-2.5 text-[13.5px] font-bold transition",
                tab === "leaves" ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
              )}
            >
              <CalendarDays className="h-4 w-4 text-[#1E6FE0]" /> {t("upcomingLeaves")}
              <span className="rounded-full bg-[#E7F1FF] px-2 py-0.5 text-[11px] font-bold text-[#1E6FE0]">
                {leaves.length}
              </span>
            </button>
          )}
        </div>

        {/* Search & Dept Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchMember")}
              className="h-10 w-full rounded-[12px] border border-[#E3EAF1] bg-white pl-9 pr-3 text-[13px] text-[#172334] outline-none focus:border-[#1E6FE0]"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="h-10 rounded-[12px] border border-[#E3EAF1] bg-white px-3 text-[13px] font-medium text-[#172334] outline-none focus:border-[#1E6FE0]"
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
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card p-4 border-l-4 border-l-[#16B878] flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">{t("currentlyPresent")}</p>
                <p className="mt-1 text-[28px] font-bold tabular-nums text-[#16B878]">{presentCount}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#E1F8EF] text-[#16B878]">
                <Users className="h-5 w-5" />
              </span>
            </div>

            <div className="card p-4 border-l-4 border-l-[#1E6FE0] flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">{t("completedShift")}</p>
                <p className="mt-1 text-[28px] font-bold tabular-nums text-[#1E6FE0]">{doneCount}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#E7F1FF] text-[#1E6FE0]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>

            <div className="card p-4 border-l-4 border-l-[#617083] flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">{t("notInYet")}</p>
                <p className="mt-1 text-[28px] font-bold tabular-nums text-[#617083]">{absentCount}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#F4F7FB] text-[#617083]">
                <Clock className="h-5 w-5" />
              </span>
            </div>
          </div>

          {/* Member Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              return (
                <div key={m.id} className="card p-5 flex flex-col justify-between hover:shadow-pop transition duration-150">
                  <div className="flex items-start gap-3.5">
                    <div className="relative shrink-0">
                      <Avatar name={m.name} color={m.color} size={48} src={avatarSrc(m.id, m.avatar)} />
                      {present && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#16B878] ring-2 ring-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-[#172334]">{m.name}</p>
                      <p className="truncate text-[12.5px] text-[#8A97A8]">
                        {m.designation || m.role.replace("_", " ")}
                      </p>
                      <p className="mt-0.5 text-[11.5px] font-semibold text-[#1E6FE0]">
                        {m.department || "No Department"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[#F0F4F8] pt-3.5 flex flex-wrap items-center justify-between gap-2">
                    {present && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E1F8EF] px-3 py-1 text-[11.5px] font-bold text-[#06613E]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("inTime")} {formatTime(m.today_in!)}
                      </span>
                    )}
                    {done && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F1FC] px-3 py-1 text-[11.5px] font-bold text-[#1E6FE0]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("outTime")} {formatTime(m.today_out!)}
                      </span>
                    )}
                    {!m.today_in && (
                      <span className="rounded-full bg-[#F4F7FB] px-3 py-1 text-[11.5px] font-semibold text-[#8A97A8]">
                        {t("notInYet")}
                      </span>
                    )}

                    {canOff ? (
                      <select
                        className="h-8 rounded-[9px] border border-[#E3EAF1] bg-[#F8FAFD] px-2 py-0 text-[11.5px] font-semibold text-[#172334] outline-none"
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
                            {t("offDay")}: {d.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-semibold text-[#8A97A8]">
                        {t("offDay")}: {weeklyOffLabel(m.weekly_off)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Upcoming Leaves Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {leaves.length === 0 ? (
            <div className="card p-12 text-center sm:col-span-2">
              <CalendarDays className="mx-auto h-10 w-10 text-[#C5D0DC] mb-2" />
              <p className="text-[16px] font-bold text-[#172334]">{t("noUpcomingLeaves")}</p>
              <p className="text-[13px] text-[#8A97A8] mt-1">{t("approvedLeavesSub")}</p>
            </div>
          ) : (
            leaves.map((l) => (
              <div key={l.id} className="card flex items-center gap-4 p-5 hover:shadow-pop transition">
                <div
                  className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] text-white shadow-sm"
                  style={{ backgroundColor: l.leave_type_color || "#1E6FE0" }}
                >
                  <span className="text-[16px] font-bold leading-none">{l.days}d</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-[#172334]">{l.user_name}</p>
                  <p className="text-[13px] text-[#617083]">
                    {translateLeaveName(prefs.language, l.leave_type_name)} · {formatDate(l.start_date)}
                    {l.start_date !== l.end_date ? ` → ${formatDate(l.end_date)}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
