"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Send } from "lucide-react";
import { Spinner, StatusBadge } from "@/components/ui";
import { formatDate, formatTime, istParts } from "@/lib/utils";
import { ATTENDANCE_EVENT } from "@/components/PunchWidget";
import { classNames } from "@/lib/utils";
import { addWorkingDays, isWeeklyOff } from "@/lib/staff";

type DayStatus = "present" | "half" | "absent" | "weekly_off" | "future" | "empty" | "grace";
type LeaveCover = { start_date: string; end_date: string; status: string };

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

function worked(inAt: number | null, outAt: number | null) {
  if (!inAt || !outAt || outAt <= inAt) return "—";
  const mins = Math.round((outAt - inAt) / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isLate(date: string, punchIn: number | null, workStart: string) {
  if (!punchIn || !workStart) return false;
  const t = /^\d{2}:\d{2}$/.test(workStart) ? `${workStart}:00` : workStart;
  const start = new Date(`${date}T${t}+05:30`).getTime();
  if (!Number.isFinite(start)) return false;
  return punchIn > start;
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
    <svg viewBox="0 0 100 32" className="mt-3 h-9 w-full" preserveAspectRatio="none">
      <polyline fill={`${color}22`} stroke="none" points={area} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

const DOT: Record<string, string> = {
  present: "bg-[#16B878]",
  half: "bg-[#D98200]",
  absent: "bg-[#C52B35]",
  weekly_off: "bg-[#1E6FE0]",
  grace: "bg-[#D98200]",
};

const PILL: Record<string, string> = {
  present: "bg-[#E1F8EF] text-[#06613E]",
  half: "bg-amber-50 text-amber-800",
  absent: "bg-rose-50 text-rose-700",
  weekly_off: "bg-[#E8F1FC] text-[#1E6FE0]",
  grace: "bg-amber-50 text-amber-800",
  empty: "bg-[#F4F7FB] text-[#8A97A8]",
  future: "bg-[#F4F7FB] text-[#8A97A8]",
};

function statusLabel(st: DayStatus) {
  if (st === "weekly_off") return "Weekly off";
  if (st === "grace") return "Apply leave";
  if (st === "half") return "Half day";
  if (st === "empty") return "—";
  if (st === "future") return "—";
  return st.charAt(0).toUpperCase() + st.slice(1);
}

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
  const [month, setMonth] = useState(() => istParts().monthKey);
  const [selected, setSelected] = useState(today);
  const [records, setRecords] = useState<any[]>([]);
  const [manualReqs, setManualReqs] = useState<any[]>([]);
  const [weeklyOff, setWeeklyOff] = useState(6);
  const [leaveCover, setLeaveCover] = useState<LeaveCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

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
    for (let d = 1; d <= last; d++) {
      cells.push({ date: `${month}-${String(d).padStart(2, "0")}` });
    }
    return cells;
  }, [month]);

  const stats = useMemo(() => {
    let present = 0,
      half = 0,
      absent = 0,
      late = 0,
      minutes = 0;
    const [y, mo] = month.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    const presentSpark: number[] = [];
    const lateSpark: number[] = [];
    const hourSpark: number[] = [];
    for (let d = 1; d <= last; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      const rec = byDate[date];
      const st = statusOf(date, rec, today, weeklyOff, leaveCover);
      if (st === "present") present++;
      else if (st === "half") half++;
      else if (st === "absent") absent++;
      const lateDay = isLate(date, rec?.punch_in_at || null, workStart);
      if (lateDay) late++;
      let hrs = 0;
      if (rec?.punch_in_at && rec?.punch_out_at && rec.punch_out_at > rec.punch_in_at) {
        const mins = Math.round((rec.punch_out_at - rec.punch_in_at) / 60000);
        minutes += mins;
        hrs = mins / 60;
      }
      if (date <= today) {
        presentSpark.push(st === "present" || st === "half" ? 1 : 0);
        lateSpark.push(lateDay ? 1 : 0);
        hourSpark.push(hrs);
      }
    }
    return { present, half, absent, late, minutes, presentSpark, lateSpark, hourSpark };
  }, [records, month, today, byDate, weeklyOff, leaveCover, workStart]);

  const recentDays = useMemo(() => {
    const [y, mo] = month.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    const out: { date: string; st: DayStatus }[] = [];
    for (let d = last; d >= 1 && out.length < 8; d--) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      if (date > today) continue;
      out.push({ date, st: statusOf(date, byDate[date], today, weeklyOff, leaveCover) });
    }
    return out;
  }, [month, today, byDate, weeklyOff, leaveCover]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    const next = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    setMonth(next);
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
  const hoursLabel = `${Math.floor(stats.minutes / 60)}h ${stats.minutes % 60}m`;

  if (!canView) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[13px] text-[#8A97A8]">Present days</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[#1E6FE0]">{stats.present}</p>
          <p className="mt-1.5 text-[12px] text-[#8A97A8]">{stats.half} half day</p>
          <Spark color="#1E6FE0" values={stats.presentSpark.length ? stats.presentSpark : [0]} />
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-[#8A97A8]">Late</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[#16B878]">{stats.late}</p>
          <p className="mt-1.5 text-[12px] text-[#8A97A8]">after {workStart || "shift start"}</p>
          <Spark color="#16B878" values={stats.lateSpark.length ? stats.lateSpark : [0]} />
        </div>
        <div className="card p-4">
          <p className="text-[13px] text-[#8A97A8]">Hours this month</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[#F5A623]">{hoursLabel}</p>
          <p className="mt-1.5 text-[12px] text-[#8A97A8]">{stats.absent} absent</p>
          <Spark color="#F5A623" values={stats.hourSpark.length ? stats.hourSpark : [0]} />
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#172334]">This month</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} className="rounded-lg p-2 hover:bg-[#F3F7FB]" aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-bold text-ink">{monthLabel}</p>
            <button type="button" onClick={() => shiftMonth(1)} className="rounded-lg p-2 hover:bg-[#F3F7FB]" aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((c, i) => {
            if (!c.date) return <div key={i} />;
            const day = Number(c.date.slice(-2));
            const st = statusOf(c.date, byDate[c.date], today, weeklyOff, leaveCover);
            const sel = c.date === selected;
            return (
              <button
                key={c.date}
                type="button"
                onClick={() => setSelected(c.date!)}
                className={classNames(
                  "mx-auto flex h-[36px] w-[36px] flex-col items-center justify-center rounded-full text-sm font-semibold",
                  sel ? "bg-brand-500 text-white" : "text-ink hover:bg-[#F3F7FB]"
                )}
              >
                {day}
                {st !== "future" && st !== "empty" && (
                  <span className={classNames("mt-0.5 h-1 w-1 rounded-full", sel ? "bg-white" : DOT[st])} />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#16B878]" /> Present
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#D98200]" /> Half day
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#C52B35]" /> Absent
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#1E6FE0]" /> Weekly off
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#D98200]" /> Apply leave
          </span>
        </div>
        {selected < today && statusOf(selected, byDate[selected], today, weeklyOff, leaveCover) === "grace" && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            No punch on this day. Apply leave by {formatDate(addWorkingDays(selected, 2, weeklyOff))} or it
            will be marked absent. Your weekly off is not counted.
          </p>
        )}

        <ul className="mt-4 divide-y divide-[#F0F4F8] lg:hidden">
          {recentDays.map((r) => (
            <li key={r.date} className="flex items-center justify-between py-2.5">
              <span className="text-[13px] font-medium text-[#172334]">
                {new Date(r.date + "T12:00:00+05:30").toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className={classNames("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", PILL[r.st])}>
                {statusLabel(r.st)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[#172334]">History</h3>
          {canManual && (
            <button type="button" onClick={() => setShowManual((s) => !s)} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Manual punch
            </button>
          )}
        </div>
        {showManual && canManual && (
          <form onSubmit={submitManual} className="space-y-3 border-t border-line px-5 py-4">
            <p className="text-xs text-muted">
              Request for {selected}. Production / Lab go to Senior Manager. Electric (official and yellow card) go to AGM.
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {(["in", "out", "both"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMKind(k)}
                  className={`rounded-lg py-2 text-xs font-semibold ${mKind === k ? "bg-white shadow-sm" : "text-muted"}`}
                >
                  {k === "in" ? "Punch in" : k === "out" ? "Punch out" : "Both"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {mKind !== "out" && (
                <input type="time" className="input" value={mIn} onChange={(e) => setMIn(e.target.value)} />
              )}
              {mKind !== "in" && (
                <input type="time" className="input" value={mOut} onChange={(e) => setMOut(e.target.value)} />
              )}
            </div>
            <textarea className="input min-h-[70px]" required value={mReason} onChange={(e) => setMReason(e.target.value)} placeholder="Reason" />
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Spinner /> : <Send className="h-4 w-4" />} Submit for approval
            </button>
            {submitMsg && <p className="text-sm text-emerald-700">{submitMsg}</p>}
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6 text-brand-500" />
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ touchAction: "pan-x pan-y" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-[11px] font-semibold uppercase tracking-table text-muted">
                  <th className="px-5 py-2">Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Punch in</th>
                  <th className="px-3 py-2">Punch out</th>
                  <th className="px-3 py-2">Worked</th>
                  <th className="px-5 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const st = statusOf(r.date, r, today, weeklyOff, leaveCover);
                  const source = (r.notes || "").toLowerCase().includes("manual") ? "manual" : "mobile";
                  return (
                    <tr key={r.id} className="border-b border-line/70">
                      <td className="px-5 py-2.5 font-medium">
                        {new Date(r.date + "T12:00:00+05:30").toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={classNames(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            st === "present"
                              ? "bg-emerald-50 text-emerald-700"
                              : st === "half"
                                ? "bg-amber-50 text-amber-700"
                                : st === "weekly_off"
                                  ? "bg-[#E8F1FC] text-[#1E6FE0]"
                                  : "bg-rose-50 text-rose-700"
                          )}
                        >
                          {st === "grace" ? "apply leave" : st.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{r.punch_in_at ? formatTime(r.punch_in_at) : "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.punch_out_at ? formatTime(r.punch_out_at) : "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{worked(r.punch_in_at, r.punch_out_at)}</td>
                      <td className="px-5 py-2.5 text-xs text-muted">{source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {manualReqs.length > 0 && (
          <div className="space-y-2 border-t border-line px-5 py-4">
            {manualReqs.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 break-words">
                  {m.type === "punch_in" ? "In" : "Out"} {m.date} · {m.time}
                  {m.stage === "manager" ? " · manager" : m.stage === "final" && m.status === "pending" ? " · Super Admin" : ""}
                </span>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
