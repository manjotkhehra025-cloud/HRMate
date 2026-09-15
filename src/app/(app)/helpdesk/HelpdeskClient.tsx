"use client";

import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  MessageSquare,
  ShieldAlert,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lightbulb,
  EyeOff,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";

interface Ticket {
  id: string;
  user_id: string;
  is_anonymous: number;
  category: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  resolution_note: string;
  created_at: number;
  author_name: string;
  author_dept: string;
  author_avatar: string;
}

export default function HelpdeskClient({
  currentUserId,
  role,
  userDept,
}: {
  currentUserId: string;
  role: string;
  userDept: string;
}) {
  const isAdmin = role === "super_admin" || role === "admin";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // New ticket modal
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Facility & Canteen");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Resolve modal
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<"in_progress" | "resolved" | "closed">("resolved");
  const [resolutionNote, setResolutionNote] = useState("");

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/helpdesk");
      const data = await res.json();
      if (data.ok) {
        setTickets(data.tickets || []);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/helpdesk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          is_anonymous: isAnonymous,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setModalOpen(false);
        setTitle("");
        setDescription("");
        setIsAnonymous(false);
        loadTickets();
      }
    } catch {}
    finally {
      setSubmitting(false);
    }
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/helpdesk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTicket.id,
          status: resolutionStatus,
          resolution_note: resolutionNote,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResolveModalOpen(false);
        setSelectedTicket(null);
        setResolutionNote("");
        loadTickets();
      }
    } catch {}
    finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#1E6FE0]/30 bg-gradient-to-br from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-5 sm:p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-500/40">
                <LifeBuoy className="h-3.5 w-3.5" /> Staff Helpdesk & Grievance Box
              </span>
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-white">
              Employee Voice, Safety & Support
            </h1>
            <p className="text-[13px] text-slate-300">
              Submit ideas, factory safety issues, maintenance requests, or confidential grievances.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#1E6FE0] to-[#10B981] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" /> New Ticket / Suggestion
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner className="h-8 w-8 text-[#1E6FE0]" />
            <p className="mt-2 text-[13px] font-medium text-[#64748B]">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
            <Lightbulb className="mx-auto h-12 w-12 text-[#94A3B8]" />
            <h3 className="mt-3 text-[16px] font-bold text-[#0F172A] dark:text-white">No Tickets or Suggestions Yet</h3>
            <p className="mt-1 text-[13px] text-[#64748B]">Have an idea or safety concern? Click the button above to submit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-[#0F172A] dark:bg-slate-800 dark:text-white">
                      {t.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={classNames(
                          "rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase",
                          t.priority === "urgent"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                            : t.priority === "high"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                        )}
                      >
                        {t.priority}
                      </span>
                      <span
                        className={classNames(
                          "rounded-full px-2.5 py-0.5 text-[10.5px] font-bold",
                          t.status === "resolved" || t.status === "closed"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : t.status === "in_progress"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        )}
                      >
                        {t.status === "resolved" ? "✓ Resolved" : t.status === "in_progress" ? "⚙ In Progress" : "⏳ Open"}
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-3 text-[16px] font-black text-[#0F172A] dark:text-white leading-snug">
                    {t.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                    {t.description}
                  </p>

                  {/* Resolution note */}
                  {t.resolution_note && (
                    <div className="mt-3 rounded-2xl bg-emerald-50/70 p-3 text-[12px] border border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/30">
                      <span className="font-bold text-emerald-900 dark:text-emerald-300">Resolution Update: </span>
                      <span className="text-emerald-800 dark:text-emerald-200">{t.resolution_note}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3 dark:border-[#1E293B]">
                  <div className="flex items-center gap-2">
                    {t.is_anonymous ? (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                        <EyeOff className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      </div>
                    ) : (
                      <Avatar name={t.author_name} size={28} src={avatarSrc(t.user_id, t.author_avatar)} />
                    )}
                    <span className="text-[11.5px] font-bold text-[#64748B]">
                      {t.author_name} · {formatDate(new Date(t.created_at).toISOString().split("T")[0])}
                    </span>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setSelectedTicket(t);
                        setResolutionStatus(t.status === "resolved" ? "resolved" : "resolved");
                        setResolutionNote(t.resolution_note || "");
                        setResolveModalOpen(true);
                      }}
                      className="rounded-xl bg-[#0F172A] px-3 py-1.5 text-[11.5px] font-bold text-white shadow-xs active:scale-95 dark:bg-white dark:text-[#0F172A]"
                    >
                      Update Status
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE TICKET MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Submit Helpdesk Ticket / Suggestion
            </h3>
            <p className="text-[12.5px] text-[#64748B] mt-1">
              Your feedback helps make GD Foods factory safer and better.
            </p>

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                >
                  <option value="Facility & Canteen">Facility, Canteen & Drinking Water</option>
                  <option value="Plant Safety & PPE">Plant Safety & PPE Equipment</option>
                  <option value="Machine Maintenance">Machine Maintenance & Electrical</option>
                  <option value="HR & Payroll">HR & Payroll Query</option>
                  <option value="Process Improvement">Process & Productivity Idea</option>
                  <option value="Grievance / Workplace">Confidential Workplace Grievance</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Title / Subject *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Broken water filter on Line 2"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[13px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue, location in plant, or improvement idea..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent / Safety Hazard</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B132B]">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#1E6FE0]"
                    />
                    <span className="text-[12px] font-bold text-[#0F172A] dark:text-white">
                      Anonymous
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-[#1E6FE0] px-5 py-2 text-[13px] font-bold text-white shadow-md active:scale-95 hover:bg-[#1556B8]"
                >
                  {submitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE TICKET MODAL (Admin) */}
      {resolveModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Update Ticket Resolution
            </h3>
            <p className="text-[12.5px] text-[#64748B] mt-1">{selectedTicket.title}</p>

            <form onSubmit={handleResolveTicket} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Status *
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e: any) => setResolutionStatus(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                >
                  <option value="in_progress">In Progress / Under Investigation</option>
                  <option value="resolved">Resolved / Action Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Resolution Note / Action Taken
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Explain what steps were taken to fix or address this..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-[#10B981] px-5 py-2 text-[13px] font-bold text-white shadow-md active:scale-95 hover:bg-[#059669]"
                >
                  {submitting ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
