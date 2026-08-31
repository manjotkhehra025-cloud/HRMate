"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarDays, Send, Plus, X, AlertTriangle, CheckCircle2, Clock, Filter, ShieldAlert } from "lucide-react";
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
  accrued_days?: number;
  accrual_rate?: string;
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
  approver_name?: string;
}

type ApproverOpt = { id: string; name: string; label: string };

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
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [approverId, setApproverId] = useState("");
  const [approvers, setApprovers] = useState<ApproverOpt[]>([]);
  const [approverFallback, setApproverFallback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openMissed, setOpenMissed] = useState<{ date: string; deadline: string }[]>([]);

  const isYellowCard = staffType === "yellow_card";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/leaves");
      const data = await res.json();
      setBalance(data.balance || []);
      setRequests(data.requests || []);
      setOpenMissed(data.openMissed || []);
      setApprovers(data.approvers || []);
      setApproverFallback(!!data.approver_fallback);
      if (data.balance?.length === 1) {
        setLeaveType(data.balance[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Calculate day count between start and end date
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const filteredRequests = useMemo(() => {
    if (filterStatus === "all") return requests;
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

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
          approver_id: approverId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to apply");
        return;
      }
      setSuccess(
        data.approver_name
          ? `Sent to ${data.approver_name} (${data.days} day${data.days > 1 ? "s" : ""})`
          : `Leave request submitted (${data.days} day${data.days > 1 ? "s" : ""}) ✓`
      );
      setReason("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (!canView) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="hidden items-center justify-between lg:flex">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#172334]">Leaves Management</h1>
          <p className="mt-1 text-[14px] text-[#8A97A8]">
            {isYellowCard
              ? "Yellow card staff quota: 15 days Earned Leave (EL) per year, accrued at 1.25 days per month."
              : "Check available leave quotas, submit new applications, and track past requests."}
          </p>
        </div>
        {canApply && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              document.getElementById("leave-apply")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(30,111,224,0.3)] transition hover:bg-[#1556B8]"
          >
            <Plus className="h-4 w-4" /> Apply For Leave
          </button>
        )}
      </div>

      {/* Yellow Card Notice Banner if Yellow Card */}
      {isYellowCard && (
        <div className="rounded-[14px] bg-[#E7F1FF] border border-[#1E6FE0]/30 p-4 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-[#1E6FE0] shrink-0" />
          <p className="text-[13.5px] font-medium text-[#0A2037]">
            <span className="font-bold">Yellow Card Policy:</span> You are eligible for{" "}
            <span className="font-bold text-[#1E6FE0]">15 days of Earned Leave (EL) per year</span> (accrued at{" "}
            <span className="font-bold text-[#16B878]">1.25 days per month</span>).
          </p>
        </div>
      )}

      {/* Leave Balance Cards */}
      <div className={classNames("grid gap-3.5", isYellowCard ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4")}>
        {balance.map((b) => {
          const total = Math.max(1, b.days_per_year);
          const leftPct = Math.min(100, Math.round((b.balance / total) * 100));
          return (
            <div key={b.id} className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="truncate text-[14px] font-bold text-[#172334]">{b.name}</p>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: b.color || "#16B878" }}
                />
              </div>
              <p className="mt-2 text-[32px] font-bold tabular-nums leading-none text-[#172334]">
                {b.balance} <span className="text-[13px] font-normal text-[#8A97A8]">days left</span>
              </p>
              <p className="mt-2 text-[12px] font-semibold text-[#8A97A8]">
                {isYellowCard
                  ? `Accrued: ${b.accrued_days ?? b.balance} days (1.25/mo) · Used: ${b.used} of 15`
                  : b.reset_period === "month"
                    ? `${b.balance} remaining this month`
                    : b.id === "lt_comp"
                      ? `${b.balance} earned on weekly off`
                      : `${b.balance} left · ${b.used} used of ${b.days_per_year}`}
              </p>
              <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-[#E8EEF4]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${leftPct}%`, background: b.color || "#16B878" }}
                />
              </div>
              {b.reset_period === "month" && (
                <p className="mt-2 text-[11px] text-[#8A97A8]">Lapses at month end</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Missed Punch Grace Alert */}
      {openMissed.length > 0 && canApply && (
        <div className="rounded-[16px] bg-[#FFF4E0] border border-[#F5A623]/40 p-4 text-[#995B00]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#D98200] mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[14px]">Action Required: Apply Leave within 2 Days</p>
              <ul className="mt-1 space-y-1 text-[13px]">
                {openMissed.map((m) => (
                  <li key={m.date}>
                    No punch recorded on <span className="font-semibold">{formatDate(m.date)}</span>. Apply by{" "}
                    <span className="font-semibold">{formatDate(m.deadline)}</span> to prevent absent status.
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] bg-[#D98200] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-[#b56d00]"
                onClick={() => {
                  setShowForm(true);
                  setStartDate(openMissed[0].date);
                  setEndDate(openMissed[0].date);
                }}
              >
                Apply for this date now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Application Form */}
        {canApply && (
          <form
            id="leave-apply"
            onSubmit={submit}
            className={classNames(
              "card space-y-4 p-5 sm:p-6 lg:col-span-5",
              !showForm && "hidden lg:block"
            )}
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div>
                <h2 className="text-[16px] font-bold text-[#172334]">Apply For Leave</h2>
                <p className="text-[12px] text-[#8A97A8]">
                  {isYellowCard ? "Yellow Card (Earned Leave)" : "Submit request for manager review"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-[#8A97A8] hover:text-[#172334] lg:hidden"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="label">Leave Category</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="input"
                required
              >
                <option value="">Select Leave Type…</option>
                {balance.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.balance} days available)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            {calculatedDays > 0 && (
              <div className="rounded-[12px] bg-[#E7F1FF] px-3.5 py-2 text-[12.5px] font-semibold text-[#1E6FE0]">
                Duration: {calculatedDays} day{calculatedDays > 1 ? "s" : ""}
              </div>
            )}

            <div>
              <label className="label">Send Approval To</label>
              {approverFallback ? (
                <p className="rounded-[12px] bg-[#F4F7FB] p-3 text-[12.5px] text-[#617083]">
                  Senior Manager / AGM not assigned yet. Super Admin will approve.
                </p>
              ) : (
                <select
                  value={approverId}
                  onChange={(e) => setApproverId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select Approver…</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-[11px] text-[#8A97A8]">
                Production, Lab, Store, Quality → Senior Manager Production. Electric, Maintenance, Instrument → AGM.
              </p>
            </div>

            <div>
              <label className="label">Reason / Notes</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State the reason for leave…"
                className="input min-h-[84px]"
                required
              />
            </div>

            {error && (
              <div className="rounded-[12px] bg-[#FDECEC] p-3 text-[13px] font-semibold text-[#C52B35]">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-[12px] bg-[#E1F8EF] p-3 text-[13px] font-semibold text-[#06613E]">
                {success}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Submit Leave Request
            </button>
          </form>
        )}

        {/* Requests List */}
        <div className={classNames("card p-5 sm:p-6", canApply ? "lg:col-span-7" : "lg:col-span-12")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F4F8] pb-3">
            <div>
              <h2 className="text-[16px] font-bold text-[#172334]">My Leave Requests</h2>
              <p className="text-[12px] text-[#8A97A8]">History and real-time status</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 rounded-[12px] bg-[#EEF2F7] p-1 text-[11.5px] font-bold">
              {(["all", "pending", "approved", "rejected"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={classNames(
                    "rounded-[8px] px-2.5 py-1 capitalize transition",
                    filterStatus === s ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-7 w-7 text-[#1E6FE0]" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-[#8A97A8]">
              <CalendarDays className="mx-auto h-9 w-9 text-[#C5D0DC] mb-2" />
              <p className="text-[14px] font-semibold text-[#172334]">No leave requests found</p>
              <p className="text-[12px] text-[#8A97A8] mt-1">Submitted requests will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F0F4F8] pt-2">
              {filteredRequests.map((r) => (
                <li key={r.id} className="flex items-start gap-4 py-4 transition hover:bg-[#F8FAFD] rounded-[12px] px-2">
                  <div
                    className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] text-white shadow-sm"
                    style={{ backgroundColor: r.leave_type_color || "#16B878" }}
                  >
                    <span className="text-[16px] font-bold leading-none">{r.days}</span>
                    <span className="text-[9px] uppercase font-semibold">days</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[14px] font-bold text-[#172334]">
                        {r.leave_type_name}{" "}
                        <span className="font-medium text-[#8A97A8]">
                          ({formatDate(r.start_date)}
                          {r.start_date !== r.end_date ? ` → ${formatDate(r.end_date)}` : ""})
                        </span>
                      </p>
                      <span className={classNames("rounded-full px-2.5 py-0.5 text-[11px] font-bold", statusPill(r.status))}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#617083]">{r.reason}</p>
                    {r.approver_name && (
                      <p className="mt-1 text-[11.5px] font-medium text-[#8A97A8]">
                        Submitted to: {r.approver_name}
                      </p>
                    )}
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
