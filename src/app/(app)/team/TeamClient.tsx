"use client";

import { useState, useEffect } from "react";
import { MapPin, CalendarDays } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner, EmptyState } from "@/components/ui";
import { classNames, formatDate, formatTime } from "@/lib/utils";
import { WEEKDAYS, departmentScope, weeklyOffLabel } from "@/lib/staff";

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
  const [members, setMembers] = useState<Member[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "leaves">(canViewAttendance ? "today" : "leaves");

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.users);
        setLeaves(d.leaves);
        setLoading(false);
      });
  }, []);

  const presentCount = members.filter((m) => m.today_in && !m.today_out).length;
  const doneCount = members.filter((m) => m.today_in && m.today_out).length;
  const absentCount = members.length - presentCount - doneCount;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-[26px] font-bold tracking-tight text-[#172334]">Team</h1>
        <p className="mt-1 text-[14px] text-[#8A97A8]">Who is in today and upcoming leaves.</p>
      </div>

      <div className="flex rounded-[14px] bg-[#EEF2F7] p-1">
        {canViewAttendance && (
          <button
            type="button"
            onClick={() => setTab("today")}
            className={classNames(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[13px] font-semibold",
              tab === "today" ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8]"
            )}
          >
            <MapPin className="h-4 w-4" /> Today
          </button>
        )}
        {canViewLeaves && (
          <button
            type="button"
            onClick={() => setTab("leaves")}
            className={classNames(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[13px] font-semibold",
              tab === "leaves" ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8]"
            )}
          >
            <CalendarDays className="h-4 w-4" /> Leaves
          </button>
        )}
      </div>

      {tab === "today" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-[12px] text-[#8A97A8]">Present</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums text-[#16B878]">{presentCount}</p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] text-[#8A97A8]">Completed</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums text-[#1E6FE0]">{doneCount}</p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] text-[#8A97A8]">Not in yet</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums text-[#617083]">{absentCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {members.map((m) => {
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
                <div key={m.id} className="card flex items-start gap-3 p-4">
                  <Avatar name={m.name} color={m.color} size={48} src={avatarSrc(m.id, m.avatar)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-[#172334]">{m.name}</p>
                        <p className="truncate text-[12px] text-[#8A97A8]">
                          {m.designation || m.role} · {m.department || "—"}
                        </p>
                      </div>
                      {present && (
                        <span className="shrink-0 rounded-full bg-[#E1F8EF] px-2.5 py-1 text-[11px] font-semibold text-[#06613E]">
                          In {formatTime(m.today_in!)}
                        </span>
                      )}
                      {done && (
                        <span className="shrink-0 rounded-full bg-[#E8F1FC] px-2.5 py-1 text-[11px] font-semibold text-[#1E6FE0]">
                          Out {formatTime(m.today_out!)}
                        </span>
                      )}
                      {!m.today_in && (
                        <span className="shrink-0 rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[11px] font-semibold text-[#8A97A8]">
                          Not in yet
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {canOff ? (
                        <select
                          className="input h-8 min-h-0 w-[8.5rem] py-0 text-[11px]"
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
                              Off {d.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-full bg-[#F4F7FB] px-2 py-0.5 text-[11px] text-[#8A97A8]">
                          Weekly off {weeklyOffLabel(m.weekly_off)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {leaves.length === 0 ? (
            <div className="card sm:col-span-2">
              <EmptyState
                icon={<CalendarDays className="h-8 w-8" />}
                title="No upcoming leaves"
                subtitle="Approved leaves will appear here."
              />
            </div>
          ) : (
            leaves.map((l) => (
              <div key={l.id} className="card flex items-center gap-3 p-4">
                <div
                  className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[12px] text-white"
                  style={{ backgroundColor: l.leave_type_color || "#1E6FE0" }}
                >
                  <span className="text-[13px] font-bold leading-none">{l.days}d</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#172334]">{l.user_name}</p>
                  <p className="text-[12px] text-[#8A97A8]">
                    {l.leave_type_name} · {formatDate(l.start_date)}
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
