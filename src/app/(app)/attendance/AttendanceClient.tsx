"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  Flame,
  LogIn,
  LogOut,
  MapPin,
  Send,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { Spinner, StatusBadge } from "@/components/ui";
import { classNames, formatDate, formatTime, istParts } from "@/lib/utils";
import { ATTENDANCE_EVENT } from "@/components/PunchWidget";
import { addWorkingDays, isWeeklyOff, weeklyOffLabel } from "@/lib/staff";

type DayStatus = "present" | "half" | "absent" | "weekly_off" | "future" | "empty" | "grace";
type LeaveCover = { start_date: string; end_date: string; status: string };
type Filter = "all" | "present" | "half" | "absent" | "off";

function leaveFlag(date: string, cover: LeaveCover[]): "approved" | "pending" | null {
  let pending = false;
  for (const l of cover) {
    if (l.start_date <= date && date <= l.end_date) {
      if (l.status === "approved") return "approved";
      if (l.status === "pending") pending = true;
    }
  }
  return pending ? "pending" : null;
}

function statusOf(date: string, rec: any, today: string, weeklyOff: number, cover: LeaveCover[]): DayStatus {
  if (date > today) return "future";
  if (rec?.punch_in_at && rec?.punch_out_at) {
    const hours = (rec.punch_out_at - rec.punch_in_at) / 3600000;
    return hours < 4.5 ? "half" : "present";
  }
  if (rec?.punch_in_at) return date === today ? "present" : "half";
  if (isWeeklyOff(date, weeklyOff)) return "weekly_off";
  if (date === today) return "empty";
  const flag = leaveFlag(date, cover);
  if (flag === "approved") return "empty";
  if (flag === "pending") return "grace";
  const deadline = addWorkingDays(date, 2, weeklyOff);
  if (today <= deadline) return "grace";
  return "absent";
}

function workedMinutes(rec: any): number {
  if (!rec?.punch_in_at || !rec?.punch_out_at || rec.punch_out_at <= rec.punch_in_at) return 0;
  return Math.round((rec.punch_out_at - rec.punch_in_at) / 60000);
}

function duration(mins: number) {
  if (!mins) return "—";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isLate(date: string, punchIn: number | null, workStart: string) {
  if (!punchIn || !workStart) return false;
  const t = /^\d{2}:\d{2}$/.test(workStart) ? `${workStart}:00` : workStart;
  const start = new Date(`${date}T${t}+05:30`).getTime();
  if (!Number.isFinite(start)) return false;
  return punchIn > start;
}

function longDate(date: string) {
  return new Date(date + "T12:00:00+05:30").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function shortDate(date: string) {
  return new Date(date + "T12:00:00+05:30").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* ---------------------------------------------------------------- visuals */

const TINT: Record<DayStatus, string> = {
  present: "bg-[#E4F7EE] text-[#06613E]",
  half: "bg-[#FFF2DC] text-[#9A5700]",
  absent: "bg-[#FDECEC] text-[#B4232D]",
  weekly_off: "bg-[#EAF1FC] text-[#1E6FE0]",
  grace: "bg-white text-[#C97A00] ring-1 ring-dashed ring-[#EFCB8E]",
  empty: "bg-slate-50 text-muted",
  future: "text-muted/50",
};

const CHIP: Record<DayStatus, string> = {
  present: "bg-[#E4F7EE] text-[#06613E] ring-1 ring-[#07945D]/20",
  half: "bg-[#FFF2DC] text-[#9A5700] ring-1 ring-[#D98200]/25",
  absent: "bg-[#FDECEC] text-[#B4232D] ring-1 ring-[#C52B35]/20",
  weekly_off: "bg-[#EAF1FC] text-[#1E6FE0] ring-1 ring-[#1E6FE0]/20",
  grace: "bg-[#FFF2DC] text-[#9A5700] ring-1 ring-[#D98200]/25",
  empty: "bg-slate-100 text-muted ring-1 ring-line",
  future: "bg-slate-100 text-muted ring-1 ring-line",
};

const ACCENT: Record<DayStatus, string> = {
  present: "#16B878",
  half: "#F5A623",
  absent: "#C52B35",
  weekly_off: "#1E6FE0",
  grace: "#F5A623",
  empty: "#8A97A8",
  future: "#8A97A8",
};

function statusLabel(st: DayStatus, leave: "approved" | "pending" | null) {
  if (st === "weekly_off") return "Weekly off";
  if (leave === "approved") return "On leave";
  if (leave === "pending") return "Leave pending";
  if (st === "grace") return "No punch";
  if (st === "half") return "Half day";
  if (st === "empty" || st === "future") return "—";
  return st.charAt(0).toUpperCase() + st.slice(1);
}

function chipClass(st: DayStatus, leave: "approved" | "pending" | null) {
  if (leave === "approved") return "bg-[#F1EEFF] text-[#5B3FD1] ring-1 ring-[#7B61FF]/25";
  if (leave === "pending") return "bg-[#F1EEFF] text-[#5B3FD1] ring-1 ring-dashed ring-[#7B61FF]/40";
  return CHIP[st];
}

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
    <svg viewBox="0 0 100 32" className="mt-2.5 h-8 w-full" preserveAspectRatio="none">
      <polyline fill={`${color}1F`} stroke="none" points={area} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function StatCard({
  color,
  icon,
  label,
  value,
  sub,
  spark,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  spark?: number[];
}) {
  return (
    <div className="kpi-card" style={{ ["--kpi" as any]: color }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-kicker text-muted">{label}</p>
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-chip"
          style={{ background: `${color}1A`, color }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-1.5 text-[25px] font-bold leading-none tracking-kpi tabular-nums text-ink">{value}</p>
      <p className="mt-1.5 truncate text-[11.5px] text-muted">{sub}</p>
      {spark && spark.length > 0 && <Spark color={color} values={spark} />}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ page */

export default function AttendanceClient({
  canManual,
  canView,
  workStart,
}: {
  canManual: boolean;
  canView: boolean;
  workStart: string;
}) {
  const today = istParts().dateKey;
  const thisMonth = istParts().monthKey;
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState(today);
  const [records, setRecords] = useState<any[]>([]);
  const [manualReqs, setManualReqs] = useState<any[]>([]);
  const [weeklyOff, setWeeklyOff] = useState(6);
  const [leaveCover, setLeaveCover] = useState<LeaveCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const [mKind, setMKind] = useState<"in" | "out" | "both">("in");
  const [mIn, setMIn] = useState("09:00");
  const [mOut, setMOut] = useState("18:00");
  const [mReason, setMReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/history?month=${month}`);
      const data = await res.json();
      setRecords(data.records || []);
      setManualReqs(data.manualRequests || []);
      if (typeof data.weekly_off === "number") setWeeklyOff(data.weekly_off);
      setLeaveCover(data.leaveCover || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(ATTENDANCE_EVENT, onChange);
    return () => window.removeEventListener(ATTENDANCE_EVENT, onChange);
  }, [month]);

  const byDate = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of records) m[r.date] = r;
    return m;
  }, [records]);

  const days = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    const startWeekday = new Date(`${month}-01T12:00:00+05:30`).getDay();
    const cells: { date: string | null }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
    for (let d = 1; d <= last; d++) cells.push({ date: `${month}-${String(d).padStart(2, "0")}` });
    return cells;
  }, [month]);

  const stats = useMemo(() => {
    let present = 0,
      half = 0,
      absent = 0,
      late = 0,
      offs = 0,
      minutes = 0,
      workedDays = 0,
      streak = 0;
    const [y, mo] = month.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    const presentSpark: number[] = [];
    const lateSpark: number[] = [];
    const hourSpark: number[] = [];
    const offSpark: number[] = [];
    const statusByDate: Record<string, DayStatus> = {};

    for (let d = 1; d <= last; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      const rec = byDate[date];
      const st = statusOf(date, rec, today, weeklyOff, leaveCover);
      statusByDate[date] = st;
      if (st === "present") present++;
      else if (st === "half") half++;
      else if (st === "absent") absent++;
      if (st === "weekly_off") offs++;
      const lateDay = isLate(date, rec?.punch_in_at || null, workStart);
      if (lateDay) late++;
      const mins = workedMinutes(rec);
      if (mins) {
        minutes += mins;
        workedDays++;
      }
      if (date <= today) {
        presentSpark.push(st === "present" || st === "half" ? 1 : 0);
        lateSpark.push(lateDay ? 1 : 0);
        hourSpark.push(mins / 60);
        offSpark.push(st === "weekly_off" ? 1 : 0);
      }
    }

    // Streak = consecutive present/half days walking back from the last day that
    // can have a punch. Weekly offs and today (before punching) are skipped, they
    // don't break the run.
    const lastDate = `${month}-${String(last).padStart(2, "0")}`;
    let cursor = today < lastDate ? today : lastDate;
    if (cursor.startsWith(month)) {
      let guard = 0;
      while (cursor.startsWith(month) && guard++ < 40) {
        const st = statusByDate[cursor];
        if (st === "present" || st === "half") streak++;
        else if (st !== "weekly_off" && !(cursor === today && st === "empty")) break;
        const d = Number(cursor.slice(-2)) - 1;
        if (d < 1) break;
        cursor = `${month}-${String(d).padStart(2, "0")}`;
      }
    }

    return {
      present,
      half,
      absent,
      late,
      offs,
      minutes,
      workedDays,
      streak,
      presentSpark,
      lateSpark,
      hourSpark,
      offSpark,
    };
  }, [records, month, today, byDate, weeklyOff, leaveCover, workStart]);

  const rows = useMemo(
    () =>
      records.map((r) => ({
        rec: r,
        st: statusOf(r.date, r, today, weeklyOff, leaveCover),
        leave: leaveFlag(r.date, leaveCover),
        mins: workedMinutes(r),
        late: isLate(r.date, r.punch_in_at || null, workStart),
      })),
    [records, today, weeklyOff, leaveCover, workStart]
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, present: 0, half: 0, absent: 0, off: 0 };
    for (const r of rows) {
      if (r.st === "present") c.present++;
      else if (r.st === "half") c.half++;
      else if (r.st === "absent") c.absent++;
      else if (r.st === "weekly_off") c.off++;
    }
    return c;
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "off") return rows.filter((r) => r.st === "weekly_off");
    return rows.filter((r) => r.st === filter);
  }, [rows, filter]);

  const detail = useMemo(() => {
    const rec = byDate[selected];
    const st = statusOf(selected, rec, today, weeklyOff, leaveCover);
    return {
      date: selected,
      rec,
      st,
      leave: leaveFlag(selected, leaveCover),
      mins: workedMinutes(rec),
      late: isLate(selected, rec?.punch_in_at || null, workStart),
      deadline: addWorkingDays(selected, 2, weeklyOff),
      shiftHours: rec?.shift_hours ? Number(rec.shift_hours) : 8,
      shiftName: rec?.shift_name || "",
      gps: rec?.punch_in_lat != null ? { lat: rec.punch_in_lat, lng: rec.punch_in_lng } : null,
      source: (rec?.notes || "").toLowerCase().includes("manual") ? "Manual entry" : "GPS punch",
    };
  }, [selected, byDate, today, weeklyOff, leaveCover, workStart]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    const next = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    setMonth(next);
    setSelected(`${next}-01`);
  }

  function openManual(kind: "in" | "out" | "both" = "in") {
    setMKind(kind);
    setSubmitMsg("");
    setShowManual(true);
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selected,
          punch_in: mKind === "out" ? undefined : mIn || undefined,
          punch_out: mKind === "in" ? undefined : mOut || undefined,
          reason: mReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.error || "Failed to submit");
        return;
      }
      setMReason("");
      setSubmitMsg(
        data.stage === "manager"
          ? "Sent to your department manager, then Super Admin."
          : data.stage === "scope"
            ? "Sent to your department manager."
            : "Sent to Super Admin. After approve, those times replace the day's record."
      );
      load();
    } finally {
      setSubmitting(false);
    }
  }

  const monthLabel = new Date(month + "-01T12:00:00+05:30").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const avgMinutes = stats.workedDays ? Math.round(stats.minutes / stats.workedDays) : 0;

  if (!canView) return null;

  return (
    <div className="space-y-4 pb-2 sm:space-y-5">
      {/* ── month KPIs ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          color="#1E6FE0"
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Present"
          value={stats.present}
          sub={`${stats.half} half · ${stats.absent} absent`}
          spark={stats.presentSpark}
        />
        <StatCard
          color="#16B878"
          icon={<Timer className="h-4 w-4" />}
          label="Hours"
          value={
            <>
              {Math.floor(stats.minutes / 60)}
              <span className="text-[15px] font-bold text-muted">h</span>
            </>
          }
          sub={stats.workedDays ? `avg ${duration(avgMinutes)} / day` : "No punches yet"}
          spark={stats.hourSpark}
        />
        <StatCard
          color="#F5A623"
          icon={<AlarmClock className="h-4 w-4" />}
          label="Late in"
          value={stats.late}
          sub={workStart ? `after ${workStart}` : "no shift start set"}
          spark={stats.lateSpark}
        />
        <StatCard
          color="#7B61FF"
          icon={<Coffee className="h-4 w-4" />}
          label="Weekly off"
          value={stats.offs}
          sub={`every ${weeklyOffLabel(weeklyOff)}`}
          spark={stats.offSpark}
        />
      </section>

      {/* ── calendar + day detail ──────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Monthly overview</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Tap a day to see punches · weekly off {weeklyOffLabel(weeklyOff)}
              </p>
              {stats.streak >= 2 && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#FFF2DC] px-2.5 py-1 text-[11px] font-bold text-[#9A5700] ring-1 ring-[#D98200]/25">
                  <Flame className="h-3 w-3" /> {stats.streak} day streak
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-full border border-line bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-white hover:text-ink"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[7.5rem] text-center text-[13px] font-bold text-ink">{monthLabel}</span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-white hover:text-ink"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {month !== thisMonth && (
                <button
                  type="button"
                  onClick={() => {
                    setMonth(thisMonth);
                    setSelected(today);
                  }}
                  className="ml-0.5 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-bold text-brand-600 shadow-card"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-bold uppercase tracking-kicker text-muted sm:gap-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d.slice(0, 1)}
                <span className="hidden sm:inline">{d.slice(1)}</span>
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
            {days.map((c, i) => {
              if (!c.date) return <div key={i} />;
              const day = Number(c.date.slice(-2));
              const st = statusOf(c.date, byDate[c.date], today, weeklyOff, leaveCover);
              const leave = leaveFlag(c.date, leaveCover);
              const sel = c.date === selected;
              const isToday = c.date === today;
              return (
                <button
                  key={c.date}
                  type="button"
                  onClick={() => setSelected(c.date!)}
                  className={classNames(
                    "relative flex h-10 flex-col items-center justify-center rounded-[11px] text-[13px] font-bold transition active:scale-[0.96] sm:h-11",
                    sel
                      ? "bg-brand-500 text-white shadow-glow"
                      : leave === "approved"
                        ? "bg-[#F1EEFF] text-[#5B3FD1]"
                        : TINT[st],
                    isToday && !sel && "ring-2 ring-brand-500/50"
                  )}
                  aria-label={`${formatDate(c.date)} — ${statusLabel(st, leave)}`}
                  aria-pressed={sel}
                >
                  {day}
                  {st === "grace" && !sel && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#F5A623]" />
                  )}
                  {leave === "approved" && !sel && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#7B61FF]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-[11px] font-medium text-muted">
            {[
              ["Present", "#16B878"],
              ["Half day", "#F5A623"],
              ["Absent", "#C52B35"],
              ["Weekly off", "#1E6FE0"],
              ["On leave", "#7B61FF"],
              ["Punch missing", "#EFCB8E"],
            ].map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-[4px]" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* selected day */}
        <div className="card flex flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-kicker text-muted">
                {selected === today ? "Today" : longDate(detail.date).split(",")[0]}
              </p>
              <h3 className="mt-0.5 truncate text-[17px] font-bold tracking-[-0.3px] text-ink">
                {formatDate(detail.date)}
              </h3>
            </div>
            <Chip className={chipClass(detail.st, detail.leave)}>{statusLabel(detail.st, detail.leave)}</Chip>
          </div>

          {loading ? (
            <div className="mt-4 space-y-2.5" aria-busy="true">
              <div className="h-[52px] animate-pulse rounded-[12px] bg-slate-50" />
              <div className="h-[52px] animate-pulse rounded-[12px] bg-slate-50" />
              <div className="h-[76px] animate-pulse rounded-[12px] bg-slate-50" />
            </div>
          ) : detail.rec?.punch_in_at || detail.rec?.punch_out_at ? (
            <>
              <div className="mt-4 space-y-0">
                <Timeline
                  icon={<LogIn className="h-3.5 w-3.5" />}
                  tone="#16B878"
                  label="Punch in"
                  time={detail.rec?.punch_in_at ? formatTime(detail.rec.punch_in_at) : "—"}
                  note={detail.late ? "Late arrival" : detail.rec?.punch_in_at ? "On time" : ""}
                  noteTone={detail.late ? "#C52B35" : "#07945D"}
                  last={!detail.rec?.punch_out_at}
                />
                <Timeline
                  icon={<LogOut className="h-3.5 w-3.5" />}
                  tone="#1E6FE0"
                  label="Punch out"
                  time={detail.rec?.punch_out_at ? formatTime(detail.rec.punch_out_at) : "—"}
                  note={detail.rec?.punch_out_at ? `worked ${duration(detail.mins)}` : "still working"}
                  noteTone="#617083"
                  last
                />
              </div>

              <div className="mt-4 rounded-[12px] bg-slate-50 p-3">
                <div className="flex items-center justify-between text-[11.5px] font-semibold text-muted">
                  <span>Shift progress</span>
                  <span className="tabular-nums text-ink">{duration(detail.mins)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-line">
                  <div
                    className="h-full rounded-full flow-gradient transition-all"
                    style={{ width: `${Math.min(100, (detail.mins / 60 / detail.shiftHours) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  {detail.shiftName ? `${detail.shiftName} shift · ` : ""}
                  target {detail.shiftHours}h · {detail.source}
                  {detail.gps && (
                    <>
                      {" · "}
                      <a
                        className="font-semibold text-brand-600"
                        href={`https://www.google.com/maps?q=${detail.gps.lat},${detail.gps.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        view location
                      </a>
                    </>
                  )}
                </p>
              </div>
            </>
          ) : detail.st === "weekly_off" ? (
            <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-[12px] bg-[#EAF1FC] px-4 py-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#1E6FE0]">
                <Coffee className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[13.5px] font-bold text-[#1556B8]">Your weekly off</p>
              <p className="mt-1 text-[12px] text-[#3E6EA8]">
                {weeklyOffLabel(weeklyOff)} is not counted as absent and needs no punch.
              </p>
            </div>
          ) : detail.st === "future" ? (
            <p className="mt-4 flex-1 rounded-[12px] bg-slate-50 px-4 py-8 text-center text-[12.5px] text-muted">
              This day is still ahead — punches will show up here once you are on the floor.
            </p>
          ) : detail.leave === "approved" ? (
            <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-[12px] bg-[#F1EEFF] px-4 py-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#5B3FD1]">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[13.5px] font-bold text-[#4C33B5]">On approved leave</p>
              <p className="mt-1 text-[12px] text-[#6B57C9]">No punch needed — your leave covers this day.</p>
            </div>
          ) : detail.leave === "pending" ? (
            <div className="mt-4 flex-1 rounded-[12px] border border-dashed border-[#C9BCF5] bg-[#F7F5FF] p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#5B3FD1]">
                <Clock className="h-4 w-4" /> Leave awaiting approval
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-[#6B57C9]">
                A leave request covers this day. Until it is approved, get it cleared by {formatDate(detail.deadline)}
                so the day is not marked absent.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex-1 rounded-[12px] border border-dashed border-[#EFCB8E] bg-[#FFFBF2] p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#9A5700]">
                <TriangleAlert className="h-4 w-4" /> No punch recorded
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-[#8A6212]">
                {detail.date === today
                  ? "Punch in from the factory to mark today present."
                  : `Apply leave by ${formatDate(detail.deadline)} or this day is marked absent.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canManual && detail.date <= today && (
                  <button
                    type="button"
                    onClick={() => openManual("both")}
                    className="btn-secondary h-9 px-3 py-0 text-[12px]"
                  >
                    <Clock className="h-3.5 w-3.5" /> Manual punch
                  </button>
                )}
                <Link href="/leaves" className="btn-primary h-9 px-3 py-0 text-[12px]">
                  Apply leave
                </Link>
              </div>
            </div>
          )}

          {detail.rec && (detail.rec.punch_in_at || detail.rec.punch_out_at) && canManual && (
            <button
              type="button"
              onClick={() => openManual(detail.rec.punch_out_at ? "in" : "out")}
              className="mt-3 inline-flex items-center gap-1.5 self-start text-[12px] font-semibold text-brand-600"
            >
              <Clock className="h-3.5 w-3.5" /> Request a correction
            </button>
          )}
        </div>
      </section>

      {/* ── history ────────────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-brand-500" />
            <h3 className="text-[15px] font-semibold text-ink">Punch history</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-muted">
              {monthLabel}
            </span>
          </div>
          {canManual && (
            <button
              type="button"
              onClick={() => openManual("in")}
              className="btn-secondary h-9 shrink-0 px-3 py-0 text-[12px]"
            >
              <Clock className="h-3.5 w-3.5" /> Manual punch
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 py-3 sm:px-5" style={{ scrollbarWidth: "none" }}>
          {(
            [
              ["all", "All"],
              ["present", "Present"],
              ["half", "Half day"],
              ["absent", "Absent"],
              ["off", "Weekly off"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={classNames(
                "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                filter === key
                  ? "bg-brand-500 text-white shadow-glow"
                  : "bg-slate-50 text-muted hover:bg-slate-100 hover:text-ink"
              )}
            >
              {label}
              <span className={classNames("ml-1.5 tabular-nums", filter === key ? "text-white/75" : "text-muted/70")}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6 text-brand-500" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-50 text-muted">
              <ClipboardList className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[13.5px] font-semibold text-ink">Nothing here yet</p>
            <p className="mt-1 text-[12.5px] text-muted">
              {filter === "all"
                ? "Your punches for this month will appear in this list."
                : "No days match this filter for the selected month."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            <li className="hidden grid-cols-[7.5rem_6.5rem_5.5rem_5.5rem_5.5rem_1fr] gap-3 px-5 pb-2 pt-1 text-[10.5px] font-bold uppercase tracking-table text-muted sm:grid">
              <span>Date</span>
              <span>Status</span>
              <span>Punch in</span>
              <span>Punch out</span>
              <span>Worked</span>
              <span>Source</span>
            </li>
            {visibleRows.map(({ rec, st, leave, mins, late }) => (
              <li
                key={rec.id}
                className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 py-3 transition hover:bg-slate-50 sm:grid-cols-[7.5rem_6.5rem_5.5rem_5.5rem_5.5rem_1fr] sm:items-center sm:px-5"
              >
                <button
                  type="button"
                  onClick={() => setSelected(rec.date)}
                  className="col-span-1 flex items-center gap-1.5 text-left text-[13px] font-semibold text-ink"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: ACCENT[st] }}
                    aria-hidden
                  />
                  {shortDate(rec.date)}
                  {rec.date === today && (
                    <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-brand-600">
                      today
                    </span>
                  )}
                </button>
                <span className="col-span-1 justify-self-start sm:justify-self-start">
                  <Chip className={chipClass(st, leave)}>{statusLabel(st, leave)}</Chip>
                </span>
                <span className="text-[12.5px] tabular-nums text-ink">
                  <span className="text-muted sm:hidden">In · </span>
                  {rec.punch_in_at ? formatTime(rec.punch_in_at) : "—"}
                  {late && <span className="ml-1 text-[10.5px] font-bold text-[#C52B35]">late</span>}
                </span>
                <span className="text-[12.5px] tabular-nums text-ink">
                  <span className="text-muted sm:hidden">Out · </span>
                  {rec.punch_out_at ? formatTime(rec.punch_out_at) : "—"}
                </span>
                <span className="text-[12.5px] font-semibold tabular-nums text-ink">
                  <span className="font-normal text-muted sm:hidden">Worked · </span>
                  {duration(mins)}
                </span>
                <span className="col-span-2 flex items-center gap-1.5 text-[11.5px] text-muted sm:col-span-1">
                  <MapPin className="h-3 w-3" />
                  {(rec.notes || "").toLowerCase().includes("manual") ? "Manual entry" : "GPS punch"}
                  {rec.shift_name && <span className="text-muted/70">· {rec.shift_name}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}

        {manualReqs.length > 0 && (
          <div className="space-y-2 border-t border-line bg-slate-50 px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-kicker text-muted">Manual punch requests</p>
            {manualReqs.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line bg-white px-3 py-2.5"
              >
                <span className="min-w-0 break-words text-[12.5px] text-ink">
                  <span className="font-semibold">{m.type === "punch_in" ? "Punch in" : "Punch out"}</span>{" "}
                  {formatDate(m.date)} · {m.time}
                  <span className="text-muted">
                    {m.stage === "manager"
                      ? " · with manager"
                      : m.stage === "scope"
                        ? " · with manager"
                        : m.stage === "final" && m.status === "pending"
                          ? " · with Super Admin"
                          : ""}
                  </span>
                </span>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── manual punch dialog ────────────────────────────────────── */}
      {showManual && canManual && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-[#081C33]/50 backdrop-blur-[2px]"
            onClick={() => setShowManual(false)}
            aria-hidden
          />
          <form
            onSubmit={submitManual}
            className="animate-slide-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-dialog border border-line bg-white p-5 shadow-pop sm:max-w-[27rem] sm:rounded-dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-bold tracking-[-0.3px] text-ink">Manual punch request</h3>
                <p className="mt-0.5 text-[12px] text-muted">
                  For <span className="font-semibold text-ink">{formatDate(selected)}</span> — needs approval before it
                  updates your record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-slate-100 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1 rounded-[12px] bg-slate-100 p-1">
              {(
                [
                  ["in", "Punch in"],
                  ["out", "Punch out"],
                  ["both", "Both"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMKind(k)}
                  className={classNames(
                    "rounded-[9px] py-2 text-[12px] font-semibold transition",
                    mKind === k ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {mKind !== "out" && (
                <label className="block">
                  <span className="label">Punch in time</span>
                  <input type="time" className="input" value={mIn} onChange={(e) => setMIn(e.target.value)} />
                </label>
              )}
              {mKind !== "in" && (
                <label className="block">
                  <span className="label">Punch out time</span>
                  <input type="time" className="input" value={mOut} onChange={(e) => setMOut(e.target.value)} />
                </label>
              )}
            </div>

            <label className="mt-3 block">
              <span className="label">Reason</span>
              <textarea
                className="input min-h-[84px] resize-y"
                required
                value={mReason}
                onChange={(e) => setMReason(e.target.value)}
                placeholder="Forgot to punch — was on the production floor from 9 AM."
              />
            </label>

            <p className="mt-2 flex items-start gap-1.5 rounded-[12px] bg-slate-50 px-3 py-2.5 text-[11.5px] leading-[1.5] text-muted">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              Production / Lab go to the Senior Manager. Electric (official and yellow card) go to the AGM, then Super
              Admin.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? <Spinner /> : <Send className="h-4 w-4" />} Submit for approval
              </button>
            </div>
            {submitMsg && (
              <p
                className={classNames(
                  "mt-3 rounded-[12px] px-3 py-2.5 text-[12px]",
                  submitMsg.toLowerCase().includes("failed") ||
                    submitMsg.toLowerCase().includes("error") ||
                    submitMsg.toLowerCase().includes("already")
                    ? "bg-[#FDECEC] text-[#B4232D]"
                    : "bg-[#E4F7EE] text-[#06613E]"
                )}
              >
                {submitMsg}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- fragments */

function Timeline({
  icon,
  tone,
  label,
  time,
  note,
  noteTone,
  last,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  time: string;
  note?: string;
  noteTone?: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ background: `${tone}1A`, color: tone }}
        >
          {icon}
        </span>
        {!last && <span className="my-0.5 w-px flex-1 bg-line" />}
      </div>
      <div className={classNames("min-w-0 flex-1", last ? "pb-0" : "pb-3")}>
        <p className="text-[11px] font-bold uppercase tracking-kicker text-muted">{label}</p>
        <p className="mt-0.5 text-[18px] font-bold leading-tight tabular-nums text-ink">{time}</p>
        {note && (
          <p className="mt-0.5 text-[11.5px] font-semibold" style={{ color: noteTone }}>
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
