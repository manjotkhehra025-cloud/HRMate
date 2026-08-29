"use client";

import { useState, useEffect } from "react";
import { CalendarDays, Clock, Send, History, Info } from "lucide-react";
import { Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";

interface Record {
  id: string;
  date: string;
  punch_in_at: number | null;
  punch_out_at: number | null;
  notes: string;
}
interface ManualReq {
  id: string;
  date: string;
  type: string;
  time: string;
  reason: string;
  status: string;
  created_at: number;
}

export default function AttendanceClient({
  canManual,
  canView,
}: {
  canManual: boolean;
  canView: boolean;
}) {
  const [tab, setTab] = useState<"history" | "manual">(canView ? "history" : "manual");
  const [records, setRecords] = useState<Record[]>([]);
  const [manualReqs, setManualReqs] = useState<ManualReq[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  // Manual form
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mType, setMType] = useState("punch_in");
  const [mTime, setMTime] = useState("09:00");
  const [mReason, setMReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/history?month=${month}`);
      const data = await res.json();
      setRecords(data.records);
      setManualReqs(data.manualRequests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: mDate, type: mType, time: mTime, reason: mReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.error || "Failed to submit");
        return;
      }
      setMReason("");
      setSubmitMsg("Request submitted for approval ✓");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {canView && (
          <button
            onClick={() => setTab("history")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "history" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="h-4 w-4" /> History
            </span>
          </button>
        )}
        {canManual && (
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Manual punch
            </span>
          </button>
        )}
      </div>

      {tab === "history" ? (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Monthly records</h3>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input w-auto py-1.5 text-xs"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-brand-500" />
            </div>
          ) : records.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<CalendarDays className="h-8 w-8" />}
                title="No records this month"
                subtitle="Your punch history for this month will appear here."
              />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Punch In</th>
                    <th className="pb-2 pr-4">Punch Out</th>
                    <th className="pb-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-4 font-medium text-slate-700">{formatDate(r.date)}</td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {r.punch_in_at ? formatTime(r.punch_in_at) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {r.punch_out_at ? formatTime(r.punch_out_at) : "—"}
                      </td>
                      <td className="py-2.5 text-xs text-slate-400">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {manualReqs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800">Manual punch requests</h3>
              <div className="mt-3 space-y-2">
                {manualReqs.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {m.type === "punch_in" ? "Punch In" : "Punch Out"} · {formatDate(m.date)} ·{" "}
                        {m.time}
                      </p>
                      <p className="text-xs text-slate-500">{m.reason}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submitManual} className="mt-5 space-y-4">
          <div className="rounded-xl bg-brand-50/60 p-3 text-xs text-brand-700">
            <span className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Forgot to punch, or had a GPS issue? Submit a manual punch request — it needs
              approval from your manager/admin.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={mDate}
                onChange={(e) => setMDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value)}
                className="input"
              >
                <option value="punch_in">Punch In</option>
                <option value="punch_out">Punch Out</option>
              </select>
            </div>
            <div>
              <label className="label">Time</label>
              <input
                type="time"
                value={mTime}
                onChange={(e) => setMTime(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Reason</label>
            <textarea
              value={mReason}
              onChange={(e) => setMReason(e.target.value)}
              placeholder="Explain why you need a manual punch…"
              className="input min-h-[80px]"
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <Spinner className="h-4 w-4" /> : <><Send className="h-4 w-4" /> Submit for approval</>}
          </button>

          {submitMsg && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{submitMsg}</p>
          )}
        </form>
      )}
    </div>
  );
}
