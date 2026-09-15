"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  ArrowLeftRight,
  Plus,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Building2,
  Send,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";

export default function RosterClient({
  currentUserId,
  role,
  userDept,
}: {
  currentUserId: string;
  role: string;
  userDept: string;
}) {
  const isAdmin = role === "super_admin" || role === "admin";
  const [activeTab, setActiveTab] = useState<"schedule" | "swaps">("schedule");
  const [department, setDepartment] = useState("all");

  // Week calculation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  });

  const [rosters, setRosters] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Swap Modal
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [requesterDate, setRequesterDate] = useState(new Date().toISOString().split("T")[0]);
  const [requesterShiftId, setRequesterShiftId] = useState("sh_general_day");
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split("T")[0]);
  const [targetShiftId, setTargetShiftId] = useState("sh_night");
  const [swapReason, setSwapReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Assign shift modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignShiftId, setAssignShiftId] = useState("sh_general_day");
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split("T")[0]);

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return {
      dateStr: d.toISOString().split("T")[0],
      dayName: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      dayNum: d.getDate(),
      monthShort: d.toLocaleString("en-US", { month: "short" }),
      isToday: d.toISOString().split("T")[0] === new Date().toISOString().split("T")[0],
    };
  });

  const startDateStr = weekDays[0].dateStr;
  const endDateStr = weekDays[6].dateStr;

  const loadRoster = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/roster?startDate=${startDateStr}&endDate=${endDateStr}&department=${department}`);
      const data = await res.json();
      if (data.ok) {
        setRosters(data.rosters || []);
        setShifts(data.shifts || []);
        setUsers(data.users || []);
        if (!targetUserId && data.users.length > 1) {
          const peer = data.users.find((u: any) => u.id !== currentUserId);
          if (peer) setTargetUserId(peer.id);
        }
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const loadSwaps = async () => {
    try {
      const res = await fetch("/api/roster/swap");
      const data = await res.json();
      if (data.ok) {
        setSwaps(data.swaps || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadRoster();
    loadSwaps();
  }, [currentWeekStart, department]);

  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const handleSwapAction = async (id: string, action: string) => {
    try {
      const res = await fetch("/api/roster/swap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.ok) {
        loadSwaps();
        loadRoster();
      }
    } catch {}
  };

  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/roster/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          requesterDate,
          requesterShiftId,
          targetDate,
          targetShiftId,
          reason: swapReason,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSwapModalOpen(false);
        setSwapReason("");
        loadSwaps();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: assignUserId,
          shiftId: assignShiftId,
          date: assignDate,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAssignModalOpen(false);
        loadRoster();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#1E6FE0]/30 bg-gradient-to-br from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-5 sm:p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-0.5 text-[11px] font-black text-blue-300 ring-1 ring-blue-500/40">
                <Clock className="h-3.5 w-3.5" /> Shift Rosters & Mutual Swaps
              </span>
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-white">
              Factory Shift Rostering & Schedule
            </h1>
            <p className="text-[13px] text-slate-300">
              General Day (08:00), Night Shift (19:00), Season Day (07:00), and peer shift exchanges.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSwapModalOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
            >
              <ArrowLeftRight className="h-4 w-4" /> Request Shift Swap
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  setAssignUserId(users[0]?.id || currentUserId);
                  setAssignModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-2xl bg-[#1E6FE0] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:bg-[#1556B8] active:scale-95"
              >
                <Plus className="h-4 w-4" /> Assign Shift
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] dark:bg-[#0B132B]">
          <button
            onClick={() => setActiveTab("schedule")}
            className={classNames(
              "px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition",
              activeTab === "schedule"
                ? "bg-[#1E6FE0] text-white shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]"
            )}
          >
            Weekly Roster
          </button>
          <button
            onClick={() => setActiveTab("swaps")}
            className={classNames(
              "px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition",
              activeTab === "swaps"
                ? "bg-[#1E6FE0] text-white shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]"
            )}
          >
            Swap Requests ({swaps.length})
          </button>
        </div>

        {/* Week Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] hover:bg-[#EEF2F7] active:scale-95 dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-bold text-[#0F172A] dark:text-white">
            {weekDays[0].dayNum} {weekDays[0].monthShort} – {weekDays[6].dayNum} {weekDays[6].monthShort}
          </span>
          <button
            onClick={handleNextWeek}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] hover:bg-[#EEF2F7] active:scale-95 dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12px] font-bold text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
          >
            <option value="all">All Departments</option>
            <option value="Production">Production</option>
            <option value="Quality">Quality</option>
            <option value="Engineering">Engineering</option>
            <option value="Security">Security</option>
            <option value="Agriculture">Agriculture</option>
            <option value="Accounts">Accounts</option>
          </select>
        </div>
      </div>

      {/* 1. WEEKLY ROSTER GRID */}
      {activeTab === "schedule" && (
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-sm overflow-x-auto dark:border-[#1E293B] dark:bg-[#0F172A]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner className="h-8 w-8 text-[#1E6FE0]" />
              <p className="mt-2 text-[13px] font-medium text-[#64748B]">Loading roster schedule...</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F1F5F9] dark:border-[#1E293B]">
                  <th className="py-3 px-3 text-[12px] font-black uppercase text-[#64748B] w-48">Employee</th>
                  {weekDays.map((w) => (
                    <th
                      key={w.dateStr}
                      className={classNames(
                        "py-3 px-2 text-center text-[12px] font-black",
                        w.isToday ? "text-[#1E6FE0]" : "text-[#64748B] dark:text-[#94A3B8]"
                      )}
                    >
                      <p className="text-[11px] font-bold uppercase">{w.dayName}</p>
                      <p className="text-[14px]">{w.dayNum}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {users.map((u) => {
                  return (
                    <tr key={u.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} color={u.color} size={32} src={avatarSrc(u.id, u.avatar)} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-[#0F172A] dark:text-white">{u.name}</p>
                            <p className="truncate text-[11px] text-[#64748B]">{u.department}</p>
                          </div>
                        </div>
                      </td>

                      {weekDays.map((w) => {
                        const assigned = rosters.find((r) => r.user_id === u.id && r.date === w.dateStr);
                        const shiftId = assigned ? assigned.shift_id : u.shift_id || "sh_general_day";
                        const shiftObj = shifts.find((s) => s.id === shiftId);

                        const isNight = shiftId === "sh_night";
                        const isSeason = shiftId === "sh_season_day";

                        return (
                          <td key={w.dateStr} className="py-2.5 px-1.5 text-center">
                            <span
                              className={classNames(
                                "inline-block rounded-xl px-2.5 py-1 text-[11px] font-black shadow-xs",
                                isNight
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                  : isSeason
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                              )}
                              title={`${shiftObj?.name || "General"} (${shiftObj?.start_time || "08:00"})`}
                            >
                              {isNight ? "Night 19:00" : isSeason ? "Season 07:00" : "Day 08:00"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 2. SWAP REQUESTS VIEW */}
      {activeTab === "swaps" && (
        <div className="space-y-3">
          {swaps.length === 0 ? (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
              <ArrowLeftRight className="mx-auto h-12 w-12 text-[#94A3B8]" />
              <h3 className="mt-3 text-[16px] font-bold text-[#0F172A] dark:text-white">No Shift Swap Requests</h3>
              <p className="mt-1 text-[13px] text-[#64748B]">Click "Request Shift Swap" above to exchange shifts with a teammate.</p>
            </div>
          ) : (
            swaps.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-black text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                      Mutual Swap
                    </span>
                    <span
                      className={classNames(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                        s.manager_status === "approved"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : s.manager_status === "rejected" || s.peer_status === "declined"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      )}
                    >
                      {s.manager_status === "approved"
                        ? "✓ Approved"
                        : s.peer_status === "declined"
                        ? "✕ Declined"
                        : s.peer_status === "accepted"
                        ? "⏳ Awaiting Manager Approval"
                        : "⏳ Awaiting Peer Confirmation"}
                    </span>
                  </div>

                  <h4 className="text-[15px] font-bold text-[#0F172A] dark:text-white">
                    <strong>{s.requester_name}</strong> ({s.req_shift_name} on {formatDate(s.requester_date)}) ⇄ <strong>{s.target_name}</strong> ({s.target_shift_name} on {formatDate(s.target_date)})
                  </h4>
                  <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                    Reason: "{s.reason}"
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* If I am the target coworker and it's pending */}
                  {s.target_user_id === currentUserId && s.peer_status === "pending" && (
                    <>
                      <button
                        onClick={() => handleSwapAction(s.id, "peer_accept")}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Accept Swap
                      </button>
                      <button
                        onClick={() => handleSwapAction(s.id, "peer_decline")}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-2 text-[12px] font-bold text-rose-700 hover:bg-rose-100 active:scale-95 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <XCircle className="h-4 w-4" /> Decline
                      </button>
                    </>
                  )}

                  {/* If Admin and peer accepted, Admin can approve */}
                  {isAdmin && s.peer_status === "accepted" && s.manager_status === "pending" && (
                    <>
                      <button
                        onClick={() => handleSwapAction(s.id, "manager_approve")}
                        className="flex items-center gap-1.5 rounded-xl bg-[#1E6FE0] px-3.5 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-[#1556B8] active:scale-95"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve Roster Swap
                      </button>
                      <button
                        onClick={() => handleSwapAction(s.id, "manager_reject")}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-2 text-[12px] font-bold text-rose-700 hover:bg-rose-100 active:scale-95 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SWAP REQUEST MODAL */}
      {swapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Request Shift Swap with Teammate
            </h3>
            <p className="text-[12.5px] text-[#64748B] mt-1">
              Select coworker, your shift date, and their shift date.
            </p>

            <form onSubmit={handleRequestSwap} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Teammate (Coworker) *
                </label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                >
                  {users
                    .filter((u) => u.id !== currentUserId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.department})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    My Shift Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={requesterDate}
                    onChange={(e) => setRequesterDate(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    My Current Shift
                  </label>
                  <select
                    value={requesterShiftId}
                    onChange={(e) => setRequesterShiftId(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  >
                    <option value="sh_general_day">General (08:00)</option>
                    <option value="sh_night">Night (19:00)</option>
                    <option value="sh_season_day">Season (07:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    Teammate's Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    Shift I Want
                  </label>
                  <select
                    value={targetShiftId}
                    onChange={(e) => setTargetShiftId(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  >
                    <option value="sh_night">Night (19:00)</option>
                    <option value="sh_general_day">General (08:00)</option>
                    <option value="sh_season_day">Season (07:00)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Reason for Swap *
                </label>
                <textarea
                  rows={2}
                  required
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="e.g. Urgent family event / medical checkup..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setSwapModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-[13px] font-bold text-white shadow-md active:scale-95 hover:bg-purple-700"
                >
                  {saving ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  Send Swap Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN SHIFT MODAL (Admin only) */}
      {assignModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Assign Staff Shift
            </h3>

            <form onSubmit={handleAssignShift} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Employee *
                </label>
                <select
                  required
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Shift *
                </label>
                <select
                  required
                  value={assignShiftId}
                  onChange={(e) => setAssignShiftId(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                >
                  <option value="sh_general_day">General Day Shift (08:00 - 17:00, 9h)</option>
                  <option value="sh_night">Night Shift (19:00 - 07:00, 12h)</option>
                  <option value="sh_season_day">Season Day Shift (07:00 - 19:00, 12h)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#1E6FE0] px-5 py-2 text-[13px] font-bold text-white shadow-md active:scale-95 hover:bg-[#1556B8]"
                >
                  {saving ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
