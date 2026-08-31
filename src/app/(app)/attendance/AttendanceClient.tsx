"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Send, LogIn, LogOut } from "lucide-react";
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

const DOT: Record<string, string> = {
  present: "bg-[#16B878]",
  half: "bg-[#D98200]",
  absent: "bg-[#C52B35]",
  weekly_off: "bg-[#1E6FE0]",
  grace: "bg-[#D98200]",
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
  const [weeklyOff, setWeeklyOff] = useState(6);
  const [leaveCover, setLeaveCover] = useState<LeaveCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

  const [mKind, setMKind] = useState<"in" | "out" | "both">("in");
  const [mIn, setMIn] = useState("09:00");
  const [mOut, setMOut] = useState("18:00");
  const [mInDate, setMInDate] = useState(today);
  const [mOutDate, setMOutDate] = useState(today);
  const [mReason, setMReason] = useState("");
  const [mApprover, setMApprover] = useState("");
  const [approvers, setApprovers] = useState<{ id: string; name: string; label: string }[]>([]);
  const [approverFallback, setApproverFallback] = useState(false);
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
      setApprovers(data.approvers || []);
      setApproverFallback(!!data.approver_fallback);
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

  useEffect(() => {
    setMInDate(selected);
    setMOutDate(selected);
  }, [selected]);

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
      const st = statusOf(r.date, r, today, weeklyOff, leaveCover);
      if (st === "present") present++;
      else if (st === "half") half++;
    }
    const [y, mo] = month.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      if (statusOf(date, byDate[date], today, weeklyOff, leaveCover) === "absent") absent++;
    }
    return { present, half, absent };
  }, [records, month, today, byDate, weeklyOff, leaveCover]);

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
          date: mKind === "out" ? mOutDate : mInDate,
          punch_in: mKind === "out" ? undefined : mIn || undefined,
          punch_out: mKind === "in" ? undefined : mOut || undefined,
          punch_in_date: mKind === "out" ? undefined : mInDate,
          punch_out_date: mKind === "in" ? undefined : mOutDate,
          reason: mReason,
          approver_id: mApprover,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.error || "Failed to submit");
        return;
      }
      setMReason("");
      setSubmitMsg(
        data.approver_name
          ? `Sent to ${data.approver_name}. After approve, those times replace the day's record.`
          : "Request sent."
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
            const st = statusOf(c.date, byDate[c.date], today, weeklyOff, leaveCover);
            const sel = c.date === selected;
            return (
              <button
                key={c.date}
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
        {selected < today &&
          statusOf(selected, byDate[selected], today, weeklyOff, leaveCover) === "grace" && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              No punch on this day. Apply leave by {formatDate(addWorkingDays(selected, 2, weeklyOff))} or it
              will be marked absent. Your weekly off is not counted.
            </p>
          )}
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

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">History</h3>
          {canManual && (
            <button onClick={() => setShowManual((s) => !s)} className="btn-secondary shrink-0 px-3 py-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" /> Manual punch
            </button>
          )}
        </div>
        {showManual && canManual && (
          <form onSubmit={submitManual} className="space-y-3 border-t border-line px-5 py-4">
            <p className="text-xs text-muted">Request for {selected}.</p>
            {approverFallback ? (
              <p className="rounded-xl bg-[#F4F7FB] px-3 py-2 text-[13px] text-[#617083]">
                Senior Manager Production / AGM IDs are not created yet. Super Admin will approve.
              </p>
            ) : (
              <div>
                <label className="label">Send for approval to</label>
                <select
                  value={mApprover}
                  onChange={(e) => setMApprover(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select who should approve…</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  Production, Lab, Store, Quality → Senior Manager Production. Electric, Maintenance, Instrument
                  → Assistant General Manager. If one is on leave, pick the other.
                </p>
              </div>
            )}
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
            <div className={mKind === "both" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
              {mKind !== "out" && (
                <div>
                  <label className="label">Punch in date</label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={mInDate}
                    onChange={(e) => setMInDate(e.target.value)}
                  />
                </div>
              )}
              {mKind !== "out" && (
                <div>
                  <label className="label">Punch in time</label>
                  <input type="time" className="input" required value={mIn} onChange={(e) => setMIn(e.target.value)} />
                </div>
              )}
              {mKind !== "in" && (
                <div>
                  <label className="label">Punch out date</label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={mOutDate}
                    onChange={(e) => setMOutDate(e.target.value)}
                  />
                </div>
              )}
              {mKind !== "in" && (
                <div>
                  <label className="label">Punch out time</label>
                  <input type="time" className="input" required value={mOut} onChange={(e) => setMOut(e.target.value)} />
                </div>
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
                  {m.approver_name
                    ? ` · ${m.approver_name}`
                    : m.stage === "manager"
                      ? " · manager"
                      : m.stage === "final" && m.status === "pending"
                        ? " · Super Admin"
                        : ""}
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
