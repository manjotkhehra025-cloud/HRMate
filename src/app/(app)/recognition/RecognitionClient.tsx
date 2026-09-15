"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  Trophy,
  Sparkles,
  Star,
  Plus,
  Flame,
  ShieldCheck,
  Heart,
  Medal,
  CheckCircle2,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";

interface WorkerAward {
  id: string;
  user_id: string;
  user_name: string;
  department: string;
  designation: string;
  color: string;
  avatar: string;
  award_type: string;
  period: string;
  title: string;
  citation: string;
  awarded_by_name: string;
  created_at: number;
}

export default function RecognitionClient({
  currentUserId,
  role,
  userDept,
}: {
  currentUserId: string;
  role: string;
  userDept: string;
}) {
  const isAdmin = role === "super_admin" || role === "admin";
  const [awards, setAwards] = useState<WorkerAward[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [awardType, setAwardType] = useState("Star Worker of the Month");
  const [period, setPeriod] = useState("September 2026");
  const [awardTitle, setAwardTitle] = useState("Star Worker of the Month 🌟");
  const [citation, setCitation] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/recognition");
      const data = await res.json();
      if (data.ok) {
        setAwards(data.awards || []);
        setUsers(data.users || []);
        if (!selectedUserId && data.users?.length > 0) {
          setSelectedUserId(data.users[0].id);
        }
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGiveAward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/recognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          award_type: awardType,
          period,
          title: awardTitle,
          citation,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setModalOpen(false);
        setCitation("");
        loadData();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#0B192C] via-[#2A1D07] to-[#0B192C] p-5 sm:p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-0.5 text-[11px] font-black text-amber-300 ring-1 ring-amber-500/40">
                <Trophy className="h-3.5 w-3.5" /> GD Foods Factory Recognition & Awards
              </span>
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-white">
              Star Workers & Factory Heroes 🏆
            </h1>
            <p className="text-[13px] text-slate-300">
              Celebrating exceptional safety records, shift output champions, perfect attendance, and factory stars.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-[13px] font-bold text-slate-900 shadow-lg transition hover:brightness-110 active:scale-95 shrink-0"
            >
              <Award className="h-4 w-4" /> Present Recognition Award
            </button>
          )}
        </div>
      </div>

      {/* Awards Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner className="h-8 w-8 text-amber-500" />
            <p className="mt-2 text-[13px] font-medium text-[#64748B]">Loading factory awards...</p>
          </div>
        ) : awards.length === 0 ? (
          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
            <Trophy className="mx-auto h-12 w-12 text-[#94A3B8]" />
            <h3 className="mt-3 text-[16px] font-bold text-[#0F172A] dark:text-white">No Awards Presented Yet</h3>
            <p className="mt-1 text-[13px] text-[#64748B]">Admins can present monthly Star Worker and Perfect Attendance recognition.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {awards.map((a) => (
              <div
                key={a.id}
                className="relative overflow-hidden rounded-3xl border-2 border-amber-400/40 bg-gradient-to-br from-white via-[#FFFDF5] to-[#FEF3C7]/20 p-6 shadow-md dark:border-amber-500/30 dark:bg-gradient-to-br dark:from-[#0F172A] dark:via-[#1A1813] dark:to-[#0F172A]"
              >
                {/* Decorative Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-black text-amber-700 dark:text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  {a.period}
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <Avatar name={a.user_name} color={a.color} size={54} src={avatarSrc(a.user_id, a.avatar)} />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[11px] shadow-sm">
                      🏆
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white leading-tight">
                      {a.user_name}
                    </h3>
                    <p className="text-[12.5px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      {a.department} · {a.designation}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/80 p-4 border border-amber-200 shadow-xs dark:border-amber-500/20 dark:bg-[#0B132B]/80">
                  <div className="flex items-center gap-2 text-[14px] font-black text-amber-900 dark:text-amber-300">
                    <Medal className="h-4 w-4 text-amber-500" />
                    {a.title}
                  </div>
                  <p className="mt-2 text-[13px] italic text-slate-700 dark:text-slate-300 leading-relaxed">
                    "{a.citation}"
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11.5px] font-bold text-slate-500">
                  <span>Awarded by: {a.awarded_by_name}</span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <ShieldCheck className="h-3.5 w-3.5" /> GD Foods Official Honor
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GIVE AWARD MODAL */}
      {modalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Present Recognition Award 🏆
            </h3>
            <p className="text-[12.5px] text-[#64748B] mt-1">
              Recognize outstanding performance, safety adherence, or dedication.
            </p>

            <form onSubmit={handleGiveAward} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Employee *
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.department} · {u.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    Award Category *
                  </label>
                  <select
                    value={awardType}
                    onChange={(e) => {
                      setAwardType(e.target.value);
                      setAwardTitle(`${e.target.value} 🌟`);
                    }}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  >
                    <option value="Star Worker of the Month">Star Worker of the Month</option>
                    <option value="100% Perfect Attendance">100% Perfect Attendance</option>
                    <option value="Safety Champion">Plant Safety Champion</option>
                    <option value="Quality & Zero Defects">Zero Defect Hero</option>
                    <option value="Machine Master">Machine Uptime Master</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                    Period *
                  </label>
                  <input
                    type="text"
                    required
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="e.g. September 2026"
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2 text-[12px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Award Title *
                </label>
                <input
                  type="text"
                  required
                  value={awardTitle}
                  onChange={(e) => setAwardTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[13px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Citation / Praise Remarks *
                </label>
                <textarea
                  rows={3}
                  required
                  value={citation}
                  onChange={(e) => setCitation(e.target.value)}
                  placeholder="For outstanding dedication, 100% batch quality, and upholding highest plant safety standards..."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
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
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2 text-[13px] font-bold text-slate-900 shadow-md active:scale-95 hover:brightness-110"
                >
                  {saving ? <Spinner className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                  Present & Post Award
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
