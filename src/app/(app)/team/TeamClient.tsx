"use client";

import { useState, useEffect } from "react";
import { Users, MapPin, CalendarDays } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner, EmptyState } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 sm:w-96">
        {canViewAttendance && (
          <button
            onClick={() => setTab("today")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Today ({members.length})
            </span>
          </button>
        )}
        {canViewLeaves && (
          <button
            onClick={() => setTab("leaves")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "leaves" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Leaves
            </span>
          </button>
        )}
      </div>

      {tab === "today" ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Present" value={presentCount} tone="text-emerald-600 bg-emerald-50" />
            <StatCard label="Completed" value={doneCount} tone="text-sky-600 bg-sky-50" />
            <StatCard label="Not in yet" value={absentCount} tone="text-slate-500 bg-slate-100" />
          </div>

          <div className="card divide-y divide-slate-50">
            {members.map((m) => {
              const present = m.today_in && !m.today_out;
              const done = m.today_in && m.today_out;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-2 p-4 sm:gap-3">
                  <Avatar name={m.name} color={m.color} size={40} />
                  <div className="min-w-0 flex-1 basis-36">
                    <p className="truncate text-sm font-semibold text-slate-800">{m.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {m.designation || m.role} · {m.department} · Off {weeklyOffLabel(m.weekly_off)}
                    </p>
                  </div>
                  {canEditWeeklyOff &&
                    (viewerRole === "super_admin" ||
                      viewerRole === "admin" ||
                      (viewerRole === "manager" &&
                        m.role !== "super_admin" &&
                        viewerScope === departmentScope(m.department))) && (
                    <select
                      className="input h-9 min-h-0 w-[7.5rem] shrink-0 py-1 text-xs"
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
                          {d.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {present && (
                    <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      In · {formatTime(m.today_in!)}
                    </span>
                  )}
                  {done && (
                    <span className="badge bg-sky-50 text-sky-700 ring-1 ring-sky-600/20">
                      Out · {formatTime(m.today_out!)}
                    </span>
                  )}
                  {!m.today_in && (
                    <span className="badge bg-slate-100 text-slate-500">Not in yet</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card p-6">
          {leaves.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title="No upcoming leaves"
              subtitle="Approved leaves will appear here."
            />
          ) : (
            <div className="space-y-3">
              {leaves.map((l) => (
                <div key={l.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 p-4">
                  <div
                    className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: l.leave_type_color }}
                  >
                    <span className="text-xs font-bold">{l.days}d</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{l.user_name}</p>
                    <p className="text-xs text-slate-500">
                      {l.leave_type_name} · {formatDate(l.start_date)} → {formatDate(l.end_date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone.split(" ")[0]}`}>{value}</p>
    </div>
  );
}
