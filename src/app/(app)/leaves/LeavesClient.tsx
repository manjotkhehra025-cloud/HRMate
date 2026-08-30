"use client";

import { useState, useEffect } from "react";
import { CalendarDays, Send, Plus, X } from "lucide-react";
import { Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  color: string;
  used: number;
  balance: number;
}
interface LeaveRequest {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  created_at: number;
}

export default function LeavesClient({
  canApply,
  canView,
}: {
  canApply: boolean;
  canView: boolean;
}) {
  const [balance, setBalance] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/leaves");
      const data = await res.json();
      setBalance(data.balance);
      setRequests(data.requests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_type_id: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to apply");
        return;
      }
      setSuccess(`Leave request submitted (${data.days} day${data.days > 1 ? "s" : ""}) ✓`);
      setReason("");
      setShowForm(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flow-gradient overflow-hidden rounded-[18px] p-5 text-white shadow-glow">
        <p className="text-sm text-white/80">Leave balance</p>
        <p className="text-lg font-bold">Track your available leave</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {balance.slice(0, 4).map((b) => (
            <div key={b.id} className="rounded-xl bg-white/95 p-3 text-ink">
              <p className="text-[11px] text-muted">{b.name}</p>
              <p className="text-xl font-bold">{b.balance}</p>
              <p className="text-[11px] text-muted">days</p>
            </div>
          ))}
        </div>
      </div>

    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3">
      {/* Left: balances */}
      <div className="space-y-6 lg:col-span-1">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">All types</h2>
            {canApply && (
              <button
                onClick={() => setShowForm((s) => !s)}
                className="btn-primary px-3 py-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Apply
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {balance.map((b) => {
              const pct = b.days_per_year > 0 ? Math.round((b.balance / b.days_per_year) * 100) : 0;
              return (
                <div key={b.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{b.name}</span>
                    <span className="text-xs text-slate-400">
                      {b.used}/{b.days_per_year} used
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900">{b.balance}</span>
                    <span className="text-xs text-slate-400">days left</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: b.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showForm && canApply && (
          <form onSubmit={submit} className="card space-y-4 p-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Apply for leave</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="label">Leave type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="input"
                required
              >
                <option value="">Select type…</option>
                {balance.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.balance} left)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for leave…"
                className="input min-h-[70px]"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}
            {success && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Spinner className="h-4 w-4" /> : <><Send className="h-4 w-4" /> Submit request</>}
            </button>
          </form>
        )}
      </div>

      {/* Right: requests */}
      <div className="card p-6 lg:col-span-2">
        <h2 className="text-sm font-semibold text-slate-800">My leave requests</h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6 text-brand-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title="No leave requests yet"
              subtitle="When you apply for leave, your requests will show up here."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-4 rounded-2xl border border-slate-100 p-4"
              >
                <div
                  className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: r.leave_type_color }}
                >
                  <span className="text-sm font-bold leading-none">{r.days}</span>
                  <span className="text-[9px] uppercase">days</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{r.leave_type_name}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(r.start_date)} → {formatDate(r.end_date)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
