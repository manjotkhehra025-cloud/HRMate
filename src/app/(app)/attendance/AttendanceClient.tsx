"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Send, LogIn, LogOut } from "lucide-react";
import { Spinner, StatusBadge } from "@/components/ui";
import { formatTime, istParts } from "@/lib/utils";
import { ATTENDANCE_EVENT } from "@/components/PunchWidget";
import { classNames } from "@/lib/utils";

type DayStatus = "present" | "half" | "absent" | "weekly_off" | "future" | "empty";

function isSunday(date: string) {
  return new Date(date + "T12:00:00+05:30").getDay() === 0;
}

function statusOf(date: string, rec: any, today: string): DayStatus {
  if (date > today) return "future";
  if (rec?.punch_in_at && rec?.punch_out_at) {
    const hours = (rec.punch_out_at - rec.punch_in_at) / 3600000;
    return hours < 4.5 ? "half" : "present";
  }
  if (rec?.punch_in_at) return date === today ? "present" : "half";
  if (isSunday(date)) return "weekly_off";
  if (date === today) return "empty";
  return "absent";
}

function worked(inAt: number | null, outAt: number | null) {
  if (!inAt || !outAt || outAt <= inAt) return "—";
  const mins = Math.round((outAt - inAt) / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const DOT: Record<string, string> = {
  present: "bg-[#16B878]",
  half: "bg-[#D98200]",
  absent: "bg-[#C52B35]",
  weekly_off: "bg-[#1E6FE0]",
};

export default function AttendanceClient({
  canManual,
  canView,
}: {
  canManual: boolean;
  canView: boolean;
}) {
  const today = istParts().dateKey;
  const [month, setMonth] = useState(() => istParts().monthKey);
  const [selected, setSelected] = useState(today);
  const [records, setRecords] = useState<any[]>([]);
  const [manualReqs, setManualReqs] = useState<any[]>([]);
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
      absent = 0;
    for (const r of records) {
      const st = statusOf(r.date, r, today);
      if (st === "present") present++;
      else if (st === "half") half++;
    }
    const [y, mo] = month.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      if (statusOf(date, byDate[date], today) === "absent") absent++;
    }
    return { present, half, absent };
  }, [records, month, today, byDate]);

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
          : "Sent for approval. After approve, those times replace the day's record."
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

  if (!canView) return null;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg p-2 hover:bg-[#F3F7FB]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-sm font-bold text-ink">{monthLabel}</p>
          <button onClick={() => shiftMonth(1)} className="rounded-lg p-2 hover:bg-[#F3F7FB]">
            <ChevronRight className="h-5 w-5" />
          </button>
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
            const st = statusOf(c.date, byDate[c.date], today);
            const sel = c.date === selected;
            return (
              <button
                key={c.date}
                onClick={() => setSelected(c.date!)}
                className={classNames(
                  "mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm font-semibold",
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
        </div>
      </div>

      <div className="card grid grid-cols-3 divide-x divide-line p-4 text-center">
        <div>
          <p className="text-2xl font-bold text-brand-600">{stats.present}</p>
          <p className="text-xs text-muted">Present</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[#D98200]">{stats.half}</p>
          <p className="text-xs text-muted">Half day</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[#C52B35]">{stats.absent}</p>
          <p className="text-xs text-muted">Absent</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">History</h3>
          {canManual && (
            <button onClick={() => setShowManual((s) => !s)} className="btn-secondary px-3 py-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Manual punch
            </button>
          )}
        </div>
        {showManual && canManual && (
          <form onSubmit={submitManual} className="space-y-3 border-t border-line px-5 py-4">
            <p className="text-xs text-muted">Request for {selected}. Yellow card goes to manager, then Super Admin.</p>
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
          <div className="overflow-x-auto">
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
                  const st = statusOf(r.date, r, today);
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
                                : "bg-rose-50 text-rose-700"
                          )}
                        >
                          {st.replace("_", " ")}
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
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>
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
