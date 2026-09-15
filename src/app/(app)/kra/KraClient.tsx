"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Target,
  Sparkles,
  Award,
  CheckCircle2,
  TrendingUp,
  Plus,
  Edit3,
  User,
  Users,
  Building2,
  Calendar,
  Send,
  Star,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Info,
  Trash2,
  Zap,
  Check,
  Search,
  Activity,
  AlertCircle,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames } from "@/lib/utils";

interface KraItem {
  id: string;
  user_id: string;
  user_name: string;
  user_dept: string;
  user_desig: string;
  period: string;
  title: string;
  description: string;
  weightage: number;
  target_metric: string;
  self_score: number | null;
  self_remarks: string;
  manager_score: number | null;
  manager_remarks: string;
  status: "draft" | "submitted" | "approved";
  created_at: number;
}

interface StaffOverview {
  id: string;
  name: string;
  department: string;
  designation: string;
  color: string;
  avatar: string;
  staff_type: string;
  total_kras: number;
  approved_kras: number;
  submitted_kras: number;
  avg_self_score: number | null;
  avg_manager_score: number | null;
}

interface TemplateItem {
  id: string;
  department: string;
  designation: string;
  title: string;
  description: string;
  weightage: number;
  target_metric: string;
}

export default function KraClient({
  currentUserId,
  role,
  userDept,
}: {
  currentUserId: string;
  role: string;
  userDept: string;
}) {
  const isSuperAdmin = role === "super_admin";
  const isAdmin = isSuperAdmin || role === "admin";

  const [activeTab, setActiveTab] = useState<"my_kras" | "team_kras" | "templates">("my_kras");
  const [selectedPeriod, setSelectedPeriod] = useState("2026-Q1");
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [staffSearch, setStaffSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const [kras, setKras] = useState<KraItem[]>([]);
  const [staffList, setStaffList] = useState<StaffOverview[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [isYellowCard, setIsYellowCard] = useState(false);
  const [liveAttendance, setLiveAttendance] = useState<{ attendancePct: number; score: number; count: number } | null>(null);

  // Self assessment modal
  const [assessModalOpen, setAssessModalOpen] = useState(false);
  const [assessingKra, setAssessingKra] = useState<KraItem | null>(null);
  const [selfScore, setSelfScore] = useState<number>(4);
  const [selfRemarks, setSelfRemarks] = useState("");

  // Manager review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingKra, setReviewingKra] = useState<KraItem | null>(null);
  const [managerScore, setManagerScore] = useState<number>(4);
  const [managerRemarks, setManagerRemarks] = useState("");

  // Super Admin assign KRA modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<"single" | "department" | "all">("single");
  const [assignTargetUserId, setAssignTargetUserId] = useState(currentUserId);
  const [assignDept, setAssignDept] = useState("Production");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formWeightage, setFormWeightage] = useState(25);
  const [formMetric, setFormMetric] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/kra?userId=${selectedUserId}&period=${selectedPeriod}`);
      const data = await res.json();
      if (data.ok) {
        setKras(data.kras || []);
        setIsYellowCard(data.isYellowCard || false);
        setLiveAttendance(data.liveAttendanceStats || null);
        if (data.staffOverview) setStaffList(data.staffOverview);
      }
    } catch (e) {
      console.error("KRA load error", e);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/kra/templates?department=all`);
      const data = await res.json();
      if (data.ok) {
        setTemplates(data.templates || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, [selectedUserId, selectedPeriod]);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Performance Score Calculations
  const totalWeightage = useMemo(() => kras.reduce((acc, k) => acc + (k.weightage || 0), 0), [kras]);
  const averageScore = useMemo(() => {
    const scored = kras.filter((k) => k.manager_score || k.self_score);
    if (scored.length === 0) return 0;
    const sum = scored.reduce((acc, k) => acc + (k.manager_score ?? k.self_score ?? 0), 0);
    return Math.round((sum / scored.length) * 10) / 10;
  }, [kras]);

  const handleSelfAssess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessingKra) return;
    try {
      setSaving(true);
      const res = await fetch("/api/kra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: assessingKra.id,
          action: "self_assess",
          self_score: selfScore,
          self_remarks: selfRemarks,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAssessModalOpen(false);
        loadData();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  const handleManagerReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingKra) return;
    try {
      setSaving(true);
      const res = await fetch("/api/kra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reviewingKra.id,
          action: "manager_review",
          manager_score: managerScore,
          manager_remarks: managerRemarks,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReviewModalOpen(false);
        loadData();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  const handleCreateKRA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      let targetIds: string[] = [];

      if (assignTarget === "single") {
        targetIds = [assignTargetUserId];
      } else if (assignTarget === "department") {
        targetIds = staffList.filter((s) => s.department === assignDept).map((s) => s.id);
      } else {
        targetIds = staffList.map((s) => s.id);
      }

      const res = await fetch("/api/kra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: targetIds,
          title: formTitle,
          description: formDesc,
          weightage: formWeightage,
          target_metric: formMetric,
          period: selectedPeriod,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setAssignModalOpen(false);
        setFormTitle("");
        setFormDesc("");
        setFormMetric("");
        loadData();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  const handleBulkAutoGenerate = async () => {
    if (!confirm(`Are you sure you want to auto-generate & assign role-specific KRAs with live attendance scoring for all Official Staff for ${selectedPeriod}?`)) return;
    try {
      setBulkGenerating(true);
      const res = await fetch("/api/kra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_auto_generate",
          period: selectedPeriod,
          department: deptFilter,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        alert(`✓ Successfully auto-assigned ${data.count} tailored KRAs across ${data.usersCount} Official Staff members!`);
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBulkGenerating(false);
    }
  };

  const applyTemplate = (t: TemplateItem) => {
    setFormTitle(t.title);
    setFormDesc(t.description);
    setFormWeightage(t.weightage);
    setFormMetric(t.target_metric);
    setAssignDept(t.department);
    setAssignModalOpen(true);
  };

  const filteredStaff = staffList.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.department.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.designation.toLowerCase().includes(staffSearch.toLowerCase());
    const matchDept = deptFilter === "all" || s.department === deptFilter;
    return matchSearch && matchDept;
  });

  const selectedUserObj = staffList.find((s) => s.id === selectedUserId);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#1E6FE0]/30 bg-gradient-to-br from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-5 sm:p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-500/40">
                <Target className="h-3.5 w-3.5" /> Official Staff Key Result Areas (KRAs)
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                {selectedPeriod}
              </span>
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-white">
              Official Staff Performance & Appraisal System
            </h1>
            <p className="text-[13px] text-slate-300">
              Role targets, shift output SLAs, auto-attendance scoring, employee self-assessment, and manager reviews.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-2xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-[12.5px] font-bold text-white backdrop-blur-md outline-none"
            >
              <option value="2026-Q1" className="bg-[#0B192C]">Q1 2026 (Jan - Mar)</option>
              <option value="2026-Q2" className="bg-[#0B192C]">Q2 2026 (Apr - Jun)</option>
              <option value="2026-Q3" className="bg-[#0B192C]">Q3 2026 (Jul - Sep)</option>
              <option value="2026-Q4" className="bg-[#0B192C]">Q4 2026 (Oct - Dec)</option>
              <option value="2026-Annual" className="bg-[#0B192C]">Annual 2026</option>
            </select>

            {isAdmin && (
              <>
                <button
                  onClick={handleBulkAutoGenerate}
                  disabled={bulkGenerating}
                  className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2.5 text-[12.5px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
                  title="Auto-assign KRAs to Official Staff based on Designation + Attendance"
                >
                  {bulkGenerating ? <Spinner className="h-4 w-4" /> : <Zap className="h-4 w-4 text-amber-300" />}
                  Auto-Sync Official Staff KRAs
                </button>

                <button
                  onClick={() => {
                    setFormTitle("");
                    setFormDesc("");
                    setFormMetric("");
                    setAssignModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#1E6FE0] to-[#10B981] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95"
                >
                  <Plus className="h-4 w-4" /> Assign KRA Goal
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats in Banner */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-white/10">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold text-slate-300">Active Goals</p>
            <p className="text-[20px] font-black text-white">{kras.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold text-slate-300">Total Weightage</p>
            <p className="text-[20px] font-black text-emerald-400">{totalWeightage}%</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold text-slate-300">Performance Score</p>
            <p className="text-[20px] font-black text-amber-300">
              {averageScore > 0 ? `${averageScore} / 5.0 ⭐` : "Pending"}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold text-slate-300">Auto Attendance Score</p>
            <p className="text-[16px] font-black text-emerald-300 mt-0.5 flex items-center gap-1">
              <Activity className="h-4 w-4" />
              {liveAttendance ? `${liveAttendance.score}/5 (${liveAttendance.attendancePct}%)` : "100% On-Time"}
            </p>
          </div>
        </div>
      </div>

      {/* Yellow Card Worker Notice (if applicable) */}
      {isYellowCard && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 flex items-start gap-3">
          <AlertCircle className="h-6 w-6 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <h4 className="text-[15px] font-black">Yellow Card Staff Notice</h4>
            <p className="text-[13px] mt-0.5 leading-relaxed">
              As per GD Foods factory policy, <strong>Key Result Areas (KRAs)</strong> and performance appraisal matrices strictly apply to <strong>Official Staff members</strong>. Yellow card staff performance is tracked via direct shift attendance and output logs.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-2 dark:border-[#1E293B]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("my_kras");
              setSelectedUserId(currentUserId);
            }}
            className={classNames(
              "rounded-xl px-4 py-2 text-[13px] font-bold transition",
              activeTab === "my_kras" && selectedUserId === currentUserId
                ? "bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-[#0F172A]"
                : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]"
            )}
          >
            My Role KRAs & Self-Assess
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab("team_kras")}
              className={classNames(
                "rounded-xl px-4 py-2 text-[13px] font-bold transition",
                activeTab === "team_kras"
                  ? "bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-[#0F172A]"
                  : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]"
              )}
            >
              Official Staff Evaluation ({staffList.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab("templates")}
            className={classNames(
              "rounded-xl px-4 py-2 text-[13px] font-bold transition",
              activeTab === "templates"
                ? "bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-[#0F172A]"
                : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]"
            )}
          >
            Role Templates ({templates.length})
          </button>
        </div>

        {selectedUserId !== currentUserId && (
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 dark:bg-blue-950/40">
            <span className="text-[12px] font-bold text-[#1E6FE0]">
              Viewing: <strong>{selectedUserObj?.name}</strong> ({selectedUserObj?.designation || "Official Staff"})
            </span>
            <button
              onClick={() => setSelectedUserId(currentUserId)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-900 underline ml-1"
            >
              Back to Mine
            </button>
          </div>
        )}
      </div>

      {/* 1. MY KRAS VIEW */}
      {activeTab === "my_kras" && !isYellowCard && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner className="h-8 w-8 text-[#1E6FE0]" />
              <p className="mt-2 text-[13px] font-medium text-[#64748B]">Loading your goals...</p>
            </div>
          ) : kras.length === 0 ? (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
              <Target className="mx-auto h-12 w-12 text-[#94A3B8]" />
              <h3 className="mt-3 text-[16px] font-bold text-[#0F172A] dark:text-white">No KRA Goals Assigned Yet</h3>
              <p className="mt-1 text-[13px] text-[#64748B]">Click "Assign KRA Goal" or "Auto-Sync" above to generate role-tailored targets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {kras.map((k, idx) => (
                <div
                  key={k.id}
                  className="relative flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition hover:shadow-md dark:border-[#1E293B] dark:bg-[#0F172A]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-[#1E6FE0] dark:bg-blue-950/40 dark:text-[#38BDF8]">
                        Goal #{idx + 1} · {k.weightage}% Weightage
                      </span>
                      <span
                        className={classNames(
                          "rounded-full px-2.5 py-0.5 text-[10.5px] font-bold",
                          k.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : k.status === "submitted"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        )}
                      >
                        {k.status === "approved"
                          ? "✓ Evaluated"
                          : k.status === "submitted"
                          ? "⏳ In Review"
                          : "📝 Self-Assess"}
                      </span>
                    </div>

                    <h3 className="mt-3 text-[16px] font-black text-[#0F172A] dark:text-white leading-snug">
                      {k.title}
                    </h3>
                    <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                      {k.description}
                    </p>

                    <div className="mt-3 rounded-2xl bg-[#F8FAFC] p-3 text-[12px] border border-[#E2E8F0] dark:border-[#1E293B] dark:bg-[#0B132B]">
                      <span className="font-bold text-[#0F172A] dark:text-white">Target Metric / SLA: </span>
                      <span className="text-[#1E6FE0] font-semibold">{k.target_metric}</span>
                    </div>

                    {/* Scores Section */}
                    <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                      <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900/50">
                        <p className="text-[10.5px] font-bold text-[#64748B]">Employee Self-Rating</p>
                        <p className="text-[14px] font-black text-[#0F172A] dark:text-white">
                          {k.self_score !== null ? `${k.self_score} / 5.0 ⭐` : "Pending input"}
                        </p>
                        {k.self_remarks && <p className="text-[11px] text-[#64748B] truncate mt-0.5">"{k.self_remarks}"</p>}
                      </div>

                      <div className="rounded-xl bg-emerald-50/50 p-2.5 dark:bg-emerald-950/20">
                        <p className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">Manager Grade</p>
                        <p className="text-[14px] font-black text-emerald-800 dark:text-emerald-300">
                          {k.manager_score !== null ? `${k.manager_score} / 5.0 ⭐` : "Pending review"}
                        </p>
                        {k.manager_remarks && <p className="text-[11px] text-emerald-600 truncate mt-0.5">"{k.manager_remarks}"</p>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3 dark:border-[#1E293B]">
                    <button
                      onClick={() => {
                        setAssessingKra(k);
                        setSelfScore(k.self_score || 4);
                        setSelfRemarks(k.self_remarks || "");
                        setAssessModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-3.5 py-2 text-[12px] font-bold text-white transition active:scale-95 dark:bg-white dark:text-[#0F172A]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {k.self_score !== null ? "Edit Self Assessment" : "Fill Self Assessment"}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setReviewingKra(k);
                          setManagerScore(k.manager_score || k.self_score || 4);
                          setManagerRemarks(k.manager_remarks || "");
                          setReviewModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-[#10B981] px-3.5 py-2 text-[12px] font-bold text-white transition active:scale-95"
                      >
                        <Award className="h-3.5 w-3.5" /> Grade & Feedback
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. STAFF EVALUATION LIST (Admin View) */}
      {activeTab === "team_kras" && isAdmin && (
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-[16px] font-black text-[#0F172A] dark:text-white">
                Official Staff KRA & Performance Scorecard ({selectedPeriod})
              </h3>
              <p className="text-[12px] text-[#64748B]">Super Admin can review, assign custom KRAs, and finalize quarterly grades.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff, designation..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-[12px] text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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

          <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
            {filteredStaff.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={s.name} color={s.color} size={42} src={avatarSrc(s.id, s.avatar)} />
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-black text-[#0F172A] dark:text-white">{s.name}</p>
                    <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                      {s.department} · {s.designation || "Staff"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-[#0F172A] dark:text-white">
                      {s.total_kras > 0 ? `${s.approved_kras} / ${s.total_kras} Evaluated` : "0 Goals Set"}
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Score: {s.avg_manager_score ? `${s.avg_manager_score.toFixed(1)} / 5.0 ⭐` : s.total_kras > 0 ? "Self-Assessing" : "Not Assigned"}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setAssignTargetUserId(s.id);
                      setAssignTarget("single");
                      setAssignDept(s.department || "Production");
                      setAssignModalOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-[11.5px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Assign KRA
                  </button>

                  <button
                    onClick={() => {
                      setSelectedUserId(s.id);
                      setActiveTab("my_kras");
                    }}
                    className="flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-[11.5px] font-bold text-[#1E6FE0] hover:bg-blue-100 dark:bg-blue-950/40 dark:text-[#38BDF8]"
                  >
                    View Goals <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. DEPARTMENT TEMPLATES VIEW */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-blue-50 p-4 text-[13px] text-[#1E6FE0] dark:bg-blue-950/40 dark:text-[#38BDF8] flex items-start gap-2.5">
            <Info className="h-5 w-5 shrink-0 mt-0.5" />
            <span>
              These ready-made KRA goal templates are tailored specifically for each GD Foods factory designation (Operators, Technicians, Chemists, Supervisors, Sentry Guards, Agro Officers). Click <strong>"Use Template to Assign"</strong> to instantly push them to employees.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold text-[#0F172A] dark:bg-slate-800 dark:text-white">
                      {t.department} · {t.designation}
                    </span>
                    <span className="text-[11px] font-black text-emerald-600">{t.weightage}%</span>
                  </div>

                  <h4 className="mt-3 text-[15px] font-black text-[#0F172A] dark:text-white leading-snug">
                    {t.title}
                  </h4>
                  <p className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                    {t.description}
                  </p>

                  <div className="mt-3 rounded-xl bg-[#F8FAFC] p-2.5 text-[11.5px] border border-[#E2E8F0] dark:border-[#1E293B] dark:bg-[#0B132B]">
                    <span className="font-bold text-[#0F172A] dark:text-white">Target SLA: </span>
                    <span className="text-[#1E6FE0]">{t.target_metric}</span>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => applyTemplate(t)}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1E6FE0] py-2 text-[12px] font-bold text-white shadow-sm hover:bg-[#1556B8] active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" /> Use Template to Assign
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SELF ASSESSMENT MODAL */}
      {assessModalOpen && assessingKra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Fill Self-Assessment
            </h3>
            <p className="text-[12.5px] text-[#64748B] mt-1 font-medium">{assessingKra.title}</p>

            <form onSubmit={handleSelfAssess} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  Self-Rating Score (1 to 5 Stars): <span className="text-[#1E6FE0]">{selfScore} / 5</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={selfScore}
                  onChange={(e) => setSelfScore(parseFloat(e.target.value))}
                  className="w-full accent-[#1E6FE0]"
                />
                <div className="flex justify-between text-[11px] font-bold text-[#64748B] px-1 mt-1">
                  <span>1 (Poor)</span>
                  <span>3 (Target Met)</span>
                  <span>5 (Exceeded)</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  Achievement Notes & Evidence *
                </label>
                <textarea
                  rows={3}
                  required
                  value={selfRemarks}
                  onChange={(e) => setSelfRemarks(e.target.value)}
                  placeholder="Describe your output, batches completed, downtime reduced, etc."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 text-[13px] text-[#0F172A] outline-none focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setAssessModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#0F172A] px-5 py-2 text-[13px] font-bold text-white shadow-md active:scale-95 dark:bg-white dark:text-[#0F172A]"
                >
                  {saving ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  Submit Self Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MANAGER REVIEW MODAL */}
      {reviewModalOpen && reviewingKra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Manager Grade & Final Approval
            </h3>
            <p className="text-[12.5px] text-[#64748B] mt-1 font-medium">{reviewingKra.title}</p>

            <div className="my-3 rounded-2xl bg-blue-50/70 p-3 text-[12px] dark:bg-blue-950/40">
              <p className="font-bold text-[#0F172A] dark:text-white">Employee Self-Score: {reviewingKra.self_score} / 5 ⭐</p>
              <p className="text-[#64748B] dark:text-slate-300 mt-0.5">"{reviewingKra.self_remarks}"</p>
            </div>

            <form onSubmit={handleManagerReview} className="space-y-4">
              <div>
                <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  Manager Score (1 to 5 Stars): <span className="text-emerald-600 font-black">{managerScore} / 5</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={managerScore}
                  onChange={(e) => setManagerScore(parseFloat(e.target.value))}
                  className="w-full accent-[#10B981]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  Feedback & Performance Remarks
                </label>
                <textarea
                  rows={3}
                  value={managerRemarks}
                  onChange={(e) => setManagerRemarks(e.target.value)}
                  placeholder="Excellent output, keep up the high hygiene standards..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 text-[13px] text-[#0F172A] outline-none focus:border-[#10B981] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#10B981] px-5 py-2 text-[13px] font-bold text-white shadow-md active:scale-95"
                >
                  {saving ? <Spinner className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                  Approve & Finalize Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. SUPER ADMIN ASSIGN KRA MODAL */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Assign Custom KRA Performance Goal
            </h3>

            <form onSubmit={handleCreateKRA} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Assign Target
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setAssignTarget("single")}
                    className={classNames(
                      "py-1.5 text-[11.5px] font-bold rounded-xl transition",
                      assignTarget === "single"
                        ? "bg-[#1E6FE0] text-white"
                        : "bg-[#F1F5F9] text-[#64748B] dark:bg-[#1E293B]"
                    )}
                  >
                    1 Official Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignTarget("department")}
                    className={classNames(
                      "py-1.5 text-[11.5px] font-bold rounded-xl transition",
                      assignTarget === "department"
                        ? "bg-[#1E6FE0] text-white"
                        : "bg-[#F1F5F9] text-[#64748B] dark:bg-[#1E293B]"
                    )}
                  >
                    Department
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignTarget("all")}
                    className={classNames(
                      "py-1.5 text-[11.5px] font-bold rounded-xl transition",
                      assignTarget === "all"
                        ? "bg-[#1E6FE0] text-white"
                        : "bg-[#F1F5F9] text-[#64748B] dark:bg-[#1E293B]"
                    )}
                  >
                    All Staff
                  </button>
                </div>

                {assignTarget === "single" && (
                  <select
                    value={assignTargetUserId}
                    onChange={(e) => setAssignTargetUserId(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.department} · {s.designation || "Official Staff"})
                      </option>
                    ))}
                  </select>
                )}

                {assignTarget === "department" && (
                  <select
                    value={assignDept}
                    onChange={(e) => setAssignDept(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  >
                    <option value="Production">Production</option>
                    <option value="Quality">Quality</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Security">Security</option>
                    <option value="Agriculture">Agriculture</option>
                    <option value="Accounts">Accounts</option>
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  KRA Goal Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Daily Shift Batch Output or Testing SLA"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[13px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    Weightage (%)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    required
                    value={formWeightage}
                    onChange={(e) => setFormWeightage(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    Period
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedPeriod}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F1F5F9] px-3 py-2 text-[13px] text-[#64748B] outline-none dark:border-[#334155] dark:bg-[#1E293B] dark:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Target Metric / Success SLA *
                </label>
                <input
                  type="text"
                  required
                  value={formMetric}
                  onChange={(e) => setFormMetric(e.target.value)}
                  placeholder="e.g. >= 95% output, 100% testing SLA, or < 0.5% scrap"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[13px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Description / Performance Standards
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Details and standards to follow during shifts..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
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
                  {saving ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  Send KRA to Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
