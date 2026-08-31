"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock3,
  MapPin,
  Sparkles,
  Info,
  X,
} from "lucide-react";
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
          ? `Sent to ${data.approver_name}. Once approved, records will be updated.`
          : "Request submitted successfully."
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

  const selectedRecord = byDate[selected];
  const selectedStatus = statusOf(selected, selectedRecord, today, weeklyOff, leaveCover);

  if (!canView) return null;

  return (
    <div className="space-y-6">
      {/* Top Header - Always visible on Mobile & Desktop */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-[#1E6FE0]" />
              <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
                Attendance & Logs
              </h1>
            </div>
            <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
              Monthly calendar, punch records, grace periods, and manual punch requests.
            </p>
          </div>

          {canManual && (
            <button
              type="button"
              onClick={() => {
                setShowManual((s) => !s);
                if (!showManual) {
                  setTimeout(() => {
                    document.getElementById("manual-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 100);
                }
              }}
              className="flex h-10 sm:h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[13px] sm:text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(30,111,224,0.3)] transition hover:bg-[#1556B8]"
            >
              <Clock className="h-4 w-4" /> {showManual ? "Hide Manual Punch" : "Request Manual Punch"}
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="card p-4 flex items-center justify-between border-l-4 border-l-[#16B878]">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">Present Days</p>
            <p className="mt-1 text-[28px] font-bold tabular-nums text-[#172334]">{stats.present}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#E1F8EF] text-[#16B878]">
            <CheckCircle2 className="h-6 w-6" />
          </span>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-[#D98200]">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">Half Days</p>
            <p className="mt-1 text-[28px] font-bold tabular-nums text-[#172334]">{stats.half}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#FFF4E0] text-[#D98200]">
            <Clock3 className="h-6 w-6" />
          </span>
        </div>

        <div className="card p-4 flex items-center justify-between border-l-4 border-l-[#C52B35]">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">Absent Days</p>
            <p className="mt-1 text-[28px] font-bold tabular-nums text-[#172334]">{stats.absent}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#FDECEC] text-[#C52B35]">
            <AlertCircle className="h-6 w-6" />
          </span>
        </div>
      </div>

      {/* 2-Column Section: Calendar + Manual Form */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Calendar Card */}
        <div className={classNames("card p-5 sm:p-6", showManual ? "lg:col-span-7" : "lg:col-span-12")}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#1E6FE0]" />
              <h2 className="text-[16px] font-bold text-[#172334]">{monthLabel}</h2>
            </div>
            <div className="flex items-center gap-1 rounded-[12px] border border-[#E3EAF1] bg-[#F8FAFD] p-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="rounded-[8px] p-1.5 text-[#617083] transition hover:bg-white hover:text-[#172334] hover:shadow-sm"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setMonth(istParts().monthKey)}
                className="px-2.5 py-1 text-[11.5px] font-bold text-[#1E6FE0] transition hover:underline"
              >
                Current
              </button>
              <button
                onClick={() => shiftMonth(1)}
                className="rounded-[8px] p-1.5 text-[#617083] transition hover:bg-white hover:text-[#172334] hover:shadow-sm"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center text-[11.5px] font-bold uppercase tracking-wider text-[#8A97A8] border-b border-[#F0F4F8] pb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-2 pt-3">
            {days.map((c, i) => {
              if (!c.date) return <div key={i} className="h-11" />;
              const day = Number(c.date.slice(-2));
              const st = statusOf(c.date, byDate[c.date], today, weeklyOff, leaveCover);
              const sel = c.date === selected;
              return (
                <button
                  key={c.date}
                  onClick={() => setSelected(c.date!)}
                  className={classNames(
                    "group relative mx-auto flex h-[42px] w-[42px] flex-col items-center justify-center rounded-[12px] text-[13.5px] font-bold transition-all",
                    sel
                      ? "bg-[#1E6FE0] text-white shadow-[0_4px_12px_rgba(30,111,224,0.35)] scale-105"
                      : "text-[#172334] hover:bg-[#F4F7FB]"
                  )}
                >
                  <span>{day}</span>
                  {st !== "future" && st !== "empty" && (
                    <span
                      className={classNames(
                        "mt-0.5 h-1.5 w-1.5 rounded-full",
                        sel ? "bg-white" : DOT[st]
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F4F8] pt-4 text-[12px] font-medium text-[#617083]">
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-[#16B878]" /> Present
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-[#D98200]" /> Half day
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-[#C52B35]" /> Absent
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-[#1E6FE0]" /> Weekly off
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-[#D98200]" /> Grace period
            </span>
          </div>

          {/* Selected Date Inspector */}
          <div className="mt-4 rounded-[14px] bg-[#F8FAFD] border border-[#E3EAF1] p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#172334]">
                {formatDate(selected)}:
              </span>
              <span
                className={classNames(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                  selectedStatus === "present"
                    ? "bg-[#E1F8EF] text-[#06613E]"
                    : selectedStatus === "half"
                      ? "bg-[#FFF4E0] text-[#D98200]"
                      : selectedStatus === "absent"
                        ? "bg-[#FDECEC] text-[#C52B35]"
                        : selectedStatus === "weekly_off"
                          ? "bg-[#E7F1FF] text-[#1E6FE0]"
                          : selectedStatus === "grace"
                            ? "bg-[#FFF4E0] text-[#D98200]"
                            : "bg-[#F4F7FB] text-[#8A97A8]"
                )}
              >
                {selectedStatus === "grace" ? "Apply Leave (Grace)" : selectedStatus.replace("_", " ")}
              </span>
            </div>

            {selectedRecord?.punch_in_at && (
              <span className="text-[12px] font-medium text-[#617083]">
                Punch In: {formatTime(selectedRecord.punch_in_at)}{" "}
                {selectedRecord.punch_out_at ? `· Out: ${formatTime(selectedRecord.punch_out_at)}` : ""}
              </span>
            )}
          </div>

          {/* Grace Period Alert */}
          {selected < today && selectedStatus === "grace" && (
            <div className="mt-3 flex items-start gap-2.5 rounded-[14px] bg-[#FFF4E0] p-3.5 text-[12.5px] font-medium text-[#995B00] border border-[#F5A623]/30">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D98200]" />
              <div>
                No punch recorded for {formatDate(selected)}. Please submit a leave application by{" "}
                <span className="font-bold">{formatDate(addWorkingDays(selected, 2, weeklyOff))}</span>,
                otherwise it will be marked absent. Weekly offs are excluded.
              </div>
            </div>
          )}
        </div>

        {/* Manual Punch Form (Desktop Sidebar or Toggle) */}
        {showManual && canManual && (
          <form
            id="manual-form"
            onSubmit={submitManual}
            className="card space-y-4 p-5 sm:p-6 lg:col-span-5 animate-fade-in border border-[#E3EAF1] shadow-card"
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div>
                <h3 className="text-[15px] font-bold text-[#172334]">Request Manual Punch</h3>
                <p className="text-[12px] text-[#8A97A8]">Date: {formatDate(selected)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="rounded-lg p-1 text-[#8A97A8] hover:bg-[#EEF2F7] hover:text-[#172334]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {approverFallback ? (
              <p className="rounded-[12px] bg-[#F4F7FB] p-3 text-[12.5px] text-[#617083]">
                Approver management not yet assigned. Super Admin will review this request.
              </p>
            ) : (
              <div>
                <label className="label">Approver</label>
                <select
                  value={mApprover}
                  onChange={(e) => setMApprover(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select Manager / Approver…</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#8A97A8]">
                  Production, Lab, Store, Quality → Senior Manager Production. Electric, Maintenance, Instrument → AGM.
                </p>
              </div>
            )}

            {/* Type Switcher */}
            <div>
              <label className="label">Punch Mode</label>
              <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[#EEF2F7] p-1">
                {(["in", "out", "both"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMKind(k)}
                    className={classNames(
                      "rounded-[9px] py-2 text-[12px] font-bold transition",
                      mKind === k ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
                    )}
                  >
                    {k === "in" ? "Punch In" : k === "out" ? "Punch Out" : "Both"}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time fields */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mKind !== "out" && (
                <>
                  <div>
                    <label className="label">Punch In Date</label>
                    <input
                      type="date"
                      className="input"
                      required
                      value={mInDate}
                      onChange={(e) => setMInDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Punch In Time</label>
                    <input
                      type="time"
                      className="input"
                      required
                      value={mIn}
                      onChange={(e) => setMIn(e.target.value)}
                    />
                  </div>
                </>
              )}

              {mKind !== "in" && (
                <>
                  <div>
                    <label className="label">Punch Out Date</label>
                    <input
                      type="date"
                      className="input"
                      required
                      value={mOutDate}
                      onChange={(e) => setMOutDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Punch Out Time</label>
                    <input
                      type="time"
                      className="input"
                      required
                      value={mOut}
                      onChange={(e) => setMOut(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="label">Reason / Justification</label>
              <textarea
                className="input min-h-[80px]"
                required
                value={mReason}
                onChange={(e) => setMReason(e.target.value)}
                placeholder="Explain why manual entry is requested…"
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Spinner /> : <Send className="h-4 w-4" />} Submit for Approval
            </button>

            {submitMsg && (
              <div className="rounded-[12px] bg-[#E1F8EF] p-3 text-[13px] font-semibold text-[#06613E]">
                {submitMsg}
              </div>
            )}
          </form>
        )}
      </div>

      {/* History Table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#F0F4F8]">
          <div>
            <h3 className="text-[16px] font-bold text-[#172334]">Monthly Attendance Logs</h3>
            <p className="text-[12.5px] text-[#8A97A8]">Detailed day-by-day record of {monthLabel}</p>
          </div>
          {canManual && !showManual && (
            <button
              onClick={() => {
                setShowManual(true);
                setTimeout(() => {
                  document.getElementById("manual-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }}
              className="btn-secondary text-[12.5px] py-1.5"
            >
              <Clock className="h-3.5 w-3.5 text-[#1E6FE0]" /> Manual Request
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-7 w-7 text-[#1E6FE0]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-[#E3EAF1] bg-[#F8FAFD] text-[11px] font-bold uppercase tracking-wider text-[#8A97A8]">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Punch In</th>
                  <th className="px-4 py-3">Punch Out</th>
                  <th className="px-4 py-3">Total Worked</th>
                  <th className="px-6 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F8]">
                {records.map((r) => {
                  const st = statusOf(r.date, r, today, weeklyOff, leaveCover);
                  const source = (r.notes || "").toLowerCase().includes("manual") ? "manual" : "mobile";
                  return (
                    <tr key={r.id} className="transition hover:bg-[#F8FAFD]">
                      <td className="px-6 py-3.5 font-semibold text-[#172334]">
                        {new Date(r.date + "T12:00:00+05:30").toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={classNames(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                            st === "present"
                              ? "bg-[#E1F8EF] text-[#06613E]"
                              : st === "half"
                                ? "bg-[#FFF4E0] text-[#D98200]"
                                : st === "weekly_off"
                                  ? "bg-[#E7F1FF] text-[#1E6FE0]"
                                  : "bg-[#FDECEC] text-[#C52B35]"
                          )}
                        >
                          {st === "grace" ? "Apply Leave" : st.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-[#172334]">
                        {r.punch_in_at ? formatTime(r.punch_in_at) : "—"}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-[#172334]">
                        {r.punch_out_at ? formatTime(r.punch_out_at) : "—"}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-[#172334]">
                        {worked(r.punch_in_at, r.punch_out_at)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="rounded-md bg-[#F4F7FB] border border-[#E3EAF1] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#617083]">
                          {source}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pending Manual Requests */}
        {manualReqs.length > 0 && (
          <div className="border-t border-[#E3EAF1] bg-[#F8FAFD] px-6 py-4">
            <h4 className="text-[13px] font-bold uppercase tracking-wider text-[#8A97A8] mb-2">
              Pending Manual Punch Submissions
            </h4>
            <div className="space-y-2">
              {manualReqs.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-white border border-[#E3EAF1] p-3 text-[13px]"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#1E6FE0]" />
                    <span className="font-semibold text-[#172334]">
                      {m.type === "punch_in" ? "Punch In" : "Punch Out"} on {m.date} at {m.time}
                    </span>
                    {m.approver_name && (
                      <span className="text-[12px] text-[#8A97A8]">→ {m.approver_name}</span>
                    )}
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
