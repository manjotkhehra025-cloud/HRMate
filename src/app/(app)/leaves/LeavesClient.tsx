"use client";

import { useState, useEffect } from "react";
import { CalendarDays, Send, Plus, X } from "lucide-react";
import { Spinner, EmptyState } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  color: string;
  used: number;
  balance: number;
  reset_period?: string;
  period_label?: string;
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

function statusPill(status: string) {
  if (status === "approved") return "bg-[#E1F8EF] text-[#06613E]";
  if (status === "pending") return "bg-[#FFF1E8] text-[#C2410C]";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-[#F4F7FB] text-[#617083]";
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  return status;
}

export default function LeavesClient({
  canApply,
  canView,
  staffType,
}: {
  canApply: boolean;
  canView: boolean;
  staffType: string;
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
  const [openMissed, setOpenMissed] = useState<{ date: string; deadline: string }[]>([]);
  const visibleBalance =
    staffType === "yellow_card" ? balance.filter((b) => b.id !== "lt_comp") : balance;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/leaves");
      const data = await res.json();
      setBalance(data.balance);
      setRequests(data.requests);
      setOpenMissed(data.openMissed || []);
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
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (!canView) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#172334] lg:text-[30px]">Leaves</h1>
          <p className="mt-1 text-[14px] text-[#8A97A8]">Balances, apply, and track requests.</p>
        </div>
        {canApply && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[14px] font-semibold text-white lg:hidden"
          >
            <Plus className="h-4 w-4" /> Apply leave
          </button>
        )}
        {canApply && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              document.getElementById("leave-apply")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="hidden h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[14px] font-semibold text-white lg:flex"
          >
            <Plus className="h-4 w-4" /> Apply leave
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {visibleBalance.map((b) => {
          const total = Math.max(1, b.days_per_year);
          const leftPct = Math.min(100, Math.round((b.balance / total) * 100));
          const hint =
            b.reset_period === "month"
              ? `${b.balance} left this month`
              : b.id === "lt_comp"
                ? `${b.balance} left · earned on weekly off`
                : `${b.balance} left / ${b.used} used`;
          return (
            <div key={b.id} className="card p-4">
              <p className="truncate text-[13px] font-semibold text-[#172334]">{b.name}</p>
              <p className="mt-1 text-[13px] text-[#8A97A8]">{hint}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E8EEF4]">
                <div className="h-full rounded-full" style={{ width: `${leftPct}%`, background: b.color || "#1E6FE0" }} />
              </div>
              {b.reset_period === "month" && (
                <p className="mt-2 text-[11px] text-[#8A97A8]">Unused lapses at month-end</p>
              )}
            </div>
          );
        })}
      </div>

      {openMissed.length > 0 && canApply && (
        <div className="rounded-[14px] bg-[#F5A623] px-4 py-3 text-sm font-medium text-[#172334]">
          <p className="font-semibold">Apply leave in 2 days</p>
          <ul className="mt-1 space-y-1 text-[13px] font-normal">
            {openMissed.map((m) => (
              <li key={m.date}>
                No punch on {formatDate(m.date)}. Apply by {formatDate(m.deadline)} or you will be marked absent.
                Weekly off is not counted.
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-xs font-bold underline"
            onClick={() => {
              setShowForm(true);
              setStartDate(openMissed[0].date);
              setEndDate(openMissed[0].date);
            }}
          >
            Apply now
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {canApply && (
          <form
            id="leave-apply"
            onSubmit={submit}
            className={classNames("card space-y-4 p-5 lg:col-span-2", !showForm && "hidden lg:block")}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#172334]">Apply for leave</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-[#8A97A8] hover:text-[#172334] lg:hidden"
                aria-label="Close"
              >
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
                {visibleBalance.map((b) => (
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

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
            {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Submit
            </button>
          </form>
        )}

        <div className={classNames("card p-5", canApply ? "lg:col-span-3" : "lg:col-span-5")}>
          <h2 className="text-[15px] font-semibold text-[#172334]">My requests</h2>
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
            <ul className="mt-3 divide-y divide-[#F0F4F8]">
              {requests.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-3">
                  <div
                    className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[12px] text-white"
                    style={{ backgroundColor: r.leave_type_color || "#1E6FE0" }}
                  >
                    <span className="text-sm font-bold leading-none">{r.days}</span>
                    <span className="text-[9px] uppercase">days</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-[#172334]">
                        {r.leave_type_name}{" "}
                        <span className="font-medium text-[#8A97A8]">
                          {formatDate(r.start_date)}
                          {r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ""}
                        </span>
                      </p>
                      <span className={classNames("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", statusPill(r.status))}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-words text-[13px] text-[#617083]">{r.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
