"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Send,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Save,
  RefreshCw,
  Award,
  Edit3,
  Check,
  Sliders,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";

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

export default function LeavesClient({
  canApply,
  canView,
  canAdjust = false,
  staffType: initialStaffType,
  currentUserId,
}: {
  canApply: boolean;
  canView: boolean;
  canAdjust?: boolean;
  staffType: string;
  currentUserId?: string;
}) {
  const { t } = usePrefs();
  const [currentStaffType, setCurrentStaffType] = useState(initialStaffType || "official");
  const [balance, setBalance] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
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

  // Category switch loading
  const [switchingCategory, setSwitchingCategory] = useState(false);
  const [categoryNotice, setCategoryNotice] = useState("");

  // Adjustment state for Super Admin / Admin
  const [adjustTargetUser, setAdjustTargetUser] = useState(currentUserId || "");
  const [adjustType, setAdjustType] = useState("");
  const [adjustMode, setAdjustMode] = useState<"set_total" | "delta">("set_total");
  const [adjustNewTotal, setAdjustNewTotal] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustUsers, setAdjustUsers] = useState<any[]>([]);
  const [adjustTypes, setAdjustTypes] = useState<any[]>([]);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustMsg, setAdjustMsg] = useState("");
  const [adjustErr, setAdjustErr] = useState("");

  // Direct Card Edit Modal State
  const [editingCard, setEditingCard] = useState<LeaveType | null>(null);
  const [cardEditMode, setCardEditMode] = useState<"set_total" | "delta">("set_total");
  const [cardNewTotal, setCardNewTotal] = useState("");
  const [cardDelta, setCardDelta] = useState("1");
  const [cardReason, setCardReason] = useState("");
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState("");

  const isYellowCard = currentStaffType === "yellow_card";

  function statusLabel(status: string) {
    if (status === "approved") return t("approved");
    if (status === "pending") return t("pending");
    if (status === "rejected") return t("rejected");
    return status;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/leaves");
      const data = await res.json();
      if (data.staff_type) {
        setCurrentStaffType(data.staff_type);
      }
      setBalance(data.balance || []);
      setRequests(data.requests || []);
      setOpenMissed(data.openMissed || []);
      setApprovers(data.approvers || []);
      setApproverFallback(!!data.approver_fallback);
      if (data.balance?.length > 0) {
        setLeaveType(data.balance[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadAdjustData() {
    if (!canAdjust) return;
    try {
      const res = await fetch("/api/admin/leave-balances");
      if (res.ok) {
        const d = await res.json();
        setAdjustUsers(d.users || []);
        setAdjustTypes(d.types || []);
        if (d.types?.length > 0 && !adjustType) {
          const el = d.types.find((t: any) => t.id === "lt_earned") || d.types[0];
          setAdjustType(el.id);
        }
      }
    } catch {}
  }

  useEffect(() => {
    load();
    if (canAdjust) loadAdjustData();
  }, [canAdjust]);

  // Quick switch own staff category (Yellow Card vs Official)
  async function handleSwitchCategory(newCategory: "yellow_card" | "official") {
    setSwitchingCategory(true);
    setCategoryNotice("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_type: newCategory }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to switch category");
        return;
      }
      setCurrentStaffType(newCategory);
      setCategoryNotice(
        newCategory === "yellow_card"
          ? "Switched to Yellow Card Staff (Strictly 15 EL Leaves) ✓"
          : "Switched to Official Staff (Full Leave Package) ✓"
      );
      await load();
      if (canAdjust) await loadAdjustData();
      setTimeout(() => setCategoryNotice(""), 6000);
    } catch (e: any) {
      alert(e.message || "Network error");
    } finally {
      setSwitchingCategory(false);
    }
  }

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
          ? `Sent to ${data.approver_name} (${data.days} ${t("daysLeft")})`
          : `${t("applyForLeave")} (${data.days} ${t("daysLeft")}) ✓`
      );
      setReason("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setAdjustSaving(true);
    setAdjustMsg("");
    setAdjustErr("");
    try {
      const payload: any = {
        user_id: adjustTargetUser || currentUserId,
        leave_type_id: adjustType,
        reason: adjustReason || "Manual adjustment",
      };
      if (adjustMode === "set_total") {
        payload.set_balance = parseFloat(adjustNewTotal) || 0;
      } else {
        payload.delta = parseFloat(adjustDelta) || 0;
      }

      const res = await fetch("/api/admin/leave-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setAdjustErr(d.error || "Failed to adjust balance");
        return;
      }
      setAdjustMsg("Leave balance updated successfully ✓");
      setAdjustReason("");
      load();
    } catch (e: any) {
      setAdjustErr(e.message || "Adjustment failed");
    } finally {
      setAdjustSaving(false);
    }
  }

  async function submitCardEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCard) return;
    setCardSaving(true);
    setCardError("");
    try {
      const payload: any = {
        user_id: currentUserId,
        leave_type_id: editingCard.id,
        reason: cardReason || `Adjusted ${editingCard.name} balance directly`,
      };
      if (cardEditMode === "set_total") {
        payload.set_balance = parseFloat(cardNewTotal) || 0;
      } else {
        payload.delta = parseFloat(cardDelta) || 0;
      }

      const res = await fetch("/api/admin/leave-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) {
        setCardError(d.error || "Failed to update balance");
        return;
      }
      setCategoryNotice(`${editingCard.name} balance updated ✓`);
      setEditingCard(null);
      await load();
      setTimeout(() => setCategoryNotice(""), 5000);
    } catch (e: any) {
      setCardError(e.message || "Adjustment failed");
    } finally {
      setCardSaving(false);
    }
  }

  function openEditCard(b: LeaveType) {
    setEditingCard(b);
    setCardEditMode("set_total");
    setCardNewTotal(String(b.balance));
    setCardDelta("1");
    setCardReason(`Updated ${b.name} balance`);
    setCardError("");
  }

  const selectedUserObj = adjustUsers.find((u) => u.id === (adjustTargetUser || currentUserId));
  const isTargetYellow = selectedUserObj?.staff_type === "yellow_card";

  if (!canView) return null;

  return (
    <div className="space-y-6">
      {/* Top Main Bar */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-[#1E6FE0]" />
              <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
                {t("leavesManagement")}
              </h1>
            </div>
            <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
              {isYellowCard
                ? t("yellowCardBadge")
                : t("officialStaffBadge")}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canAdjust && (
              <button
                type="button"
                onClick={() => setShowAdjust((a) => !a)}
                className={classNames(
                  "flex h-10 sm:h-11 items-center gap-2 rounded-[12px] px-3.5 sm:px-4 text-[13px] sm:text-[14px] font-bold transition",
                  showAdjust
                    ? "bg-[#1E6FE0] text-white shadow-sm"
                    : "border-2 border-[#1E6FE0] bg-[#E7F1FF] text-[#1E6FE0] hover:bg-[#d5e7ff]"
                )}
              >
                <Settings2 className="h-4 w-4" />
                {showAdjust ? t("cancel") : t("adjustEditDays")}
              </button>
            )}

            {canApply && (
              <button
                type="button"
                onClick={() => {
                  setShowForm((f) => !f);
                  if (!showForm) {
                    setTimeout(() => {
                      document.getElementById("leave-apply")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                  }
                }}
                className="flex h-10 sm:h-11 items-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[13px] sm:text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(30,111,224,0.3)] transition hover:bg-[#1556B8]"
              >
                <Plus className="h-4 w-4" /> {showForm ? t("cancel") : t("applyForLeave")}
              </button>
            )}
          </div>
        </div>

        {/* Super Admin Quick Staff Category Switcher */}
        {canAdjust && (
          <div className="mt-4 pt-4 border-t border-[#F0F4F8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFD] p-3 rounded-[14px]">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-bold text-[#617083]">Category:</span>
              <span
                className={classNames(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold",
                  isYellowCard
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-blue-100 text-blue-900 border border-blue-300"
                )}
              >
                {isYellowCard ? t("yellowCardBadge") : t("officialStaffBadge")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={switchingCategory}
                onClick={() => handleSwitchCategory(isYellowCard ? "official" : "yellow_card")}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-white border border-[#CBD6E2] px-3 py-1.5 text-[12px] font-bold text-[#172334] shadow-sm hover:bg-[#EEF2F7] active:scale-95 transition"
              >
                {switchingCategory ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-[#1E6FE0]" />
                )}
                {isYellowCard ? "Switch to Official Staff" : "Switch to Yellow Card"}
              </button>
            </div>
          </div>
        )}

        {categoryNotice && (
          <div className="mt-3 rounded-[12px] bg-[#E1F8EF] p-3 text-[13px] font-bold text-[#06613E] flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{categoryNotice}</span>
          </div>
        )}
      </div>

      {/* Super Admin Direct Balance Adjuster Module */}
      {showAdjust && canAdjust && (
        <form
          onSubmit={submitAdjustment}
          className="card p-5 sm:p-6 border-2 border-[#1E6FE0] bg-gradient-to-br from-white to-[#F8FAFD] shadow-pop space-y-4 animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-[#E3EAF1] pb-3">
            <div className="flex items-center gap-2.5">
              <Sliders className="h-5 w-5 text-[#1E6FE0]" />
              <div>
                <h2 className="text-[16px] font-bold text-[#172334]">
                  {t("adjustEditDays")}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdjust(false)}
              className="rounded-lg p-1 text-[#8A97A8] hover:bg-[#EEF2F7] hover:text-[#172334]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
            <div>
              <label className="label">{t("employee")}</label>
              <select
                className="input font-semibold"
                value={adjustTargetUser || currentUserId}
                onChange={(e) => setAdjustTargetUser(e.target.value)}
              >
                {adjustUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t("leaves")}</label>
              <select
                className="input font-semibold"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
              >
                {adjustTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{t("daysLeft")}</label>
              <input
                className="input font-bold text-[#1E6FE0]"
                type="number"
                step="0.5"
                value={adjustNewTotal}
                onChange={(e) => setAdjustNewTotal(e.target.value)}
                placeholder="e.g. 10 or 15"
                required
              />
            </div>

            <div>
              <label className="label">{t("reason")}</label>
              <input
                className="input"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Remark"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={adjustSaving}
              className="btn-primary text-xs px-5 py-2.5 flex items-center gap-2"
            >
              {adjustSaving ? <Spinner /> : <Save className="h-4 w-4" />} {t("save")}
            </button>
          </div>
        </form>
      )}

      {/* Direct Card Edit Modal */}
      {editingCard && canAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
          <form
            onSubmit={submitCardEdit}
            className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-pop border border-[#E3EAF1] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: editingCard.color || "#16B878" }}
                />
                <h3 className="text-[17px] font-bold text-[#172334]">
                  {t("edit")} {editingCard.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="rounded-lg p-1 text-[#8A97A8] hover:bg-[#EEF2F7] hover:text-[#172334]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-[14px] bg-[#F4F7FB] p-3.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#617083]">{t("leaveBalance")}:</span>
              <span className="text-[20px] font-black text-[#172334]">
                {editingCard.balance} <span className="text-[12px] font-normal text-[#8A97A8]">{t("daysLeft")}</span>
              </span>
            </div>

            <div>
              <label className="label">{t("daysLeft")}</label>
              <input
                type="number"
                step="0.5"
                className="input font-extrabold text-[18px] text-[#1E6FE0]"
                value={cardNewTotal}
                onChange={(e) => setCardNewTotal(e.target.value)}
                placeholder="e.g. 15"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label">{t("reason")}</label>
              <input
                type="text"
                className="input"
                value={cardReason}
                onChange={(e) => setCardReason(e.target.value)}
                placeholder="Reason"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="rounded-[12px] border border-[#CBD6E2] px-4 py-2.5 text-[13px] font-bold text-[#617083] hover:bg-[#F4F7FB]"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={cardSaving}
                className="btn-primary text-[13px] px-5 py-2.5 flex items-center gap-2"
              >
                {cardSaving ? <Spinner /> : <Check className="h-4 w-4" />} {t("save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Yellow Card Notice Banner */}
      {isYellowCard && (
        <div className="rounded-[16px] bg-gradient-to-r from-amber-50 to-[#FFF9E6] border-2 border-amber-300/80 p-4 sm:p-5 flex items-start gap-3.5 shadow-sm">
          <div className="rounded-full bg-amber-500/20 p-2 text-amber-800 shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div className="text-[13.5px] text-[#5C3B00] leading-relaxed">
            <p className="font-bold text-[15px] text-amber-950">{t("yellowCardPolicyTitle")}</p>
            <p className="mt-0.5">{t("yellowCardPolicySub")}</p>
          </div>
        </div>
      )}

      {/* Leave Balance Cards Grid */}
      <div
        className={classNames(
          "grid gap-3.5",
          isYellowCard ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
        )}
      >
        {balance.map((b) => {
          const total = Math.max(1, b.days_per_year);
          const leftPct = Math.min(100, Math.round((b.balance / total) * 100));
          return (
            <div
              key={b.id}
              className={classNames(
                "card p-5 relative overflow-hidden border shadow-card transition hover:shadow-md flex flex-col justify-between",
                isYellowCard && "border-amber-300/60 bg-gradient-to-br from-white to-amber-50/30"
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <p className="truncate text-[14.5px] font-bold text-[#172334]">{b.name}</p>
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: b.color || "#16B878" }}
                  />
                </div>

                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-[34px] font-extrabold tabular-nums leading-none text-[#172334]">
                    {b.balance}
                  </span>
                  <span className="text-[13px] font-semibold text-[#8A97A8]">{t("daysLeft")}</span>
                </div>

                <p className="mt-2 text-[12px] font-semibold text-[#617083]">
                  {isYellowCard
                    ? `${t("accrued")}: ${b.accrued_days ?? b.balance} · ${t("used")}: ${b.used} / 15`
                    : `${b.balance} ${t("daysLeft")} · ${b.used} ${t("used")}`}
                </p>

                <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-[#E8EEF4]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${leftPct}%`, background: b.color || "#16B878" }}
                  />
                </div>
              </div>

              {/* Super Admin Direct Edit Button */}
              {canAdjust && (
                <div className="mt-4 pt-3 border-t border-[#F0F4F8]">
                  <button
                    type="button"
                    onClick={() => openEditCard(b)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-[10px] bg-[#F4F7FB] border border-[#E3EAF1] py-1.5 text-[12px] font-bold text-[#1E6FE0] transition hover:bg-[#E7F1FF]"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> {t("editBalance")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Grid: Application Form & Requests History */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Application Form */}
        {canApply && (
          <form
            id="leave-apply"
            onSubmit={submit}
            className={classNames(
              "card space-y-4 p-5 sm:p-6 lg:col-span-5 border border-[#E3EAF1] shadow-card",
              !showForm && "hidden lg:block"
            )}
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div>
                <h2 className="text-[16px] font-bold text-[#172334]">{t("applyForLeave")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-[#8A97A8] hover:bg-[#EEF2F7] hover:text-[#172334] lg:hidden"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="label">{t("leaves")}</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="input font-semibold"
                required
              >
                <option value="">Select...</option>
                {balance.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.balance} {t("daysLeft")})
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

            <div>
              <label className="label">{t("reason")}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason..."
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

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-[14px]">
              {submitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} {t("applyForLeave")}
            </button>
          </form>
        )}

        {/* Requests List */}
        <div className={classNames("card p-5 sm:p-6 border border-[#E3EAF1] shadow-card", canApply ? "lg:col-span-7" : "lg:col-span-12")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F4F8] pb-3">
            <div>
              <h2 className="text-[16px] font-bold text-[#172334]">{t("myLeaveRequests")}</h2>
              <p className="text-[12px] text-[#8A97A8]">{t("historyStatus")}</p>
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
                  {s === "all" ? t("all") : s === "pending" ? t("pending") : s === "approved" ? t("approved") : t("rejected")}
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
              <p className="text-[14px] font-semibold text-[#172334]">{t("noNotifications")}</p>
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
