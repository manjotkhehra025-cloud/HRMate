"use client";

import { useState, useEffect } from "react";
import {
  IdCard,
  QrCode,
  Sparkles,
  Download,
  RotateCw,
  Phone,
  Droplet,
  ShieldCheck,
  Building2,
  Clock,
  Plus,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Check,
  Printer,
  CalendarDays,
  UserCheck,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { generateQrSvg } from "@/lib/qrcode";
import { classNames, formatDate, timeAgo } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  designation: string;
  color: string;
  avatar?: string;
  emp_code?: string;
  blood_group?: string;
  emergency_contact?: string;
  shift_name?: string;
  created_at?: number;
}

interface GatePass {
  id: string;
  date: string;
  type: string;
  time_out: string;
  time_in: string;
  reason: string;
  status: string;
  approver_name?: string;
  created_at: number;
}

export default function IdCardClient({ user: initialUser }: { user: UserProfile }) {
  const { t } = usePrefs();
  const [profile, setProfile] = useState<UserProfile>(initialUser);
  const [factory, setFactory] = useState({ name: "GD Foods Mfg. (I) Pvt. Ltd.", address: "" });
  const [verifyUrl, setVerifyUrl] = useState("");
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tab State: ID Card vs Gate Pass
  const [activeTab, setActiveTab] = useState<"card" | "gate_pass">("card");

  // Gate Pass State
  const [passes, setPasses] = useState<GatePass[]>([]);
  const [approvers, setApprovers] = useState<any[]>([]);
  const [showGatePassModal, setShowGatePassModal] = useState(false);
  const [gpDate, setGpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gpType, setGpType] = useState("duty");
  const [gpTimeOut, setGpTimeOut] = useState("14:00");
  const [gpTimeIn, setGpTimeIn] = useState("16:00");
  const [gpReason, setGpReason] = useState("");
  const [gpApproverId, setGpApproverId] = useState("");
  const [gpSubmitting, setGpSubmitting] = useState(false);
  const [gpSuccess, setGpSuccess] = useState("");
  const [gpError, setGpError] = useState("");

  // Edit Card Details State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBlood, setEditBlood] = useState("B+");
  const [editEmergency, setEditEmergency] = useState("");
  const [editEmpCode, setEditEmpCode] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function loadData() {
    try {
      const [cardRes, passRes] = await Promise.all([
        fetch("/api/id-card"),
        fetch("/api/gate-pass"),
      ]);

      if (cardRes.ok) {
        const d = await cardRes.json();
        if (d.user) {
          setProfile(d.user);
          setEditBlood(d.user.blood_group || "B+");
          setEditEmergency(d.user.emergency_contact || "");
          setEditEmpCode(d.user.emp_code || "");
        }
        if (d.factory) setFactory(d.factory);
        if (d.verifyUrl) setVerifyUrl(d.verifyUrl);
      }

      if (passRes.ok) {
        const pd = await passRes.json();
        setPasses(pd.passes || []);
        setApprovers(pd.approvers || []);
        if (pd.approvers?.length > 0 && !gpApproverId) {
          setGpApproverId(pd.approvers[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitGatePass(e: React.FormEvent) {
    e.preventDefault();
    setGpSubmitting(true);
    setGpSuccess("");
    setGpError("");
    try {
      const res = await fetch("/api/gate-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: gpDate,
          type: gpType,
          time_out: gpTimeOut,
          time_in: gpTimeIn,
          reason: gpReason,
          approver_id: gpApproverId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGpError(data.error || "Failed to submit gate pass");
        return;
      }
      setGpSuccess("Gate pass request submitted successfully ✓");
      setGpReason("");
      setShowGatePassModal(false);
      loadData();
    } catch (e: any) {
      setGpError(e.message || "Failed to submit gate pass");
    } finally {
      setGpSubmitting(false);
    }
  }

  async function saveCardDetails(e: React.FormEvent) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch("/api/id-card", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blood_group: editBlood,
          emergency_contact: editEmergency,
          emp_code: editEmpCode,
        }),
      });
      if (res.ok) {
        setShowEditModal(false);
        loadData();
      }
    } finally {
      setEditSaving(false);
    }
  }

  const qrSvg = generateQrSvg(verifyUrl || `https://gdfoods.duckdns.org/verify?emp=${profile.emp_code || profile.id}`);

  const photo = avatarSrc(profile.id, profile.avatar);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="rounded-[22px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0F172A] to-[#1E6FE0] text-white shadow-md">
              <IdCard className="h-6 w-6 text-[#10B981]" />
            </div>
            <div>
              <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
                Digital ID Card & Gate Pass
              </h1>
              <p className="mt-0.5 text-[12.5px] sm:text-[13.5px] text-[#617083]">
                Official G.D. Foods Employee Badge, NFC/QR Verification & Gate Security.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-[#CBD6E2] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#172334] shadow-sm hover:bg-[#F8FAFD] active:scale-95 transition"
            >
              <Printer className="h-4 w-4 text-[#1E6FE0]" /> Print ID Card
            </button>
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#1E6FE0] px-3.5 py-2 text-[12.5px] font-bold text-white shadow-md hover:bg-[#1556B8] active:scale-95 transition"
            >
              <Edit3 className="h-4 w-4" /> Edit Details
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: ID Card / Gate Pass */}
      <div className="flex rounded-[14px] bg-[#EEF2F7] p-1 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab("card")}
          className={classNames(
            "flex flex-1 items-center justify-center gap-2 rounded-[12px] py-2.5 text-[13.5px] font-bold transition",
            activeTab === "card" ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
          )}
        >
          <IdCard className="h-4 w-4 text-[#1E6FE0]" /> Employee ID Badge
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gate_pass")}
          className={classNames(
            "flex flex-1 items-center justify-center gap-2 rounded-[12px] py-2.5 text-[13.5px] font-bold transition",
            activeTab === "gate_pass" ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
          )}
        >
          <QrCode className="h-4 w-4 text-[#10B981]" /> Digital Gate Pass ({passes.length})
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === "card" ? (
        <div className="flex flex-col items-center justify-center gap-5">
          {/* Flip Card Container */}
          <div className="relative w-full max-w-sm" style={{ perspective: "1200px" }}>
            <div
              className={classNames(
                "relative w-full rounded-[28px] text-white shadow-2xl transition-all duration-700 [transform-style:preserve-3d]",
                isFlipped ? "[transform:rotateY(180deg)]" : ""
              )}
              style={{ minHeight: "530px" }}
            >
              {/* ==================== FRONT SIDE ==================== */}
              <div
                className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[28px] border-2 border-white/20 bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1C2541] p-6 shadow-2xl [backface-visibility:hidden]"
              >
                {/* Background Hologram Mesh Glow */}
                <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#10B981]/20 blur-2xl" />
                <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-[#3B82F6]/20 blur-2xl" />

                {/* Top Card Header */}
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-black shadow-sm">
                        GD
                      </div>
                      <div>
                        <p className="text-[13px] font-black tracking-wider text-white">G.D. FOODS</p>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-emerald-400">Mfg. (I) Pvt. Ltd.</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" /> VERIFIED
                    </span>
                  </div>

                  {/* Photo & Identity */}
                  <div className="mt-5 flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="h-28 w-28 rounded-2xl p-1 bg-gradient-to-tr from-[#10B981] via-[#3B82F6] to-emerald-300 shadow-lg">
                        <div className="h-full w-full overflow-hidden rounded-xl bg-[#0F172A] flex items-center justify-center">
                          <Avatar
                            name={profile.name}
                            color={profile.color}
                            size={104}
                            src={photo}
                          />
                        </div>
                      </div>
                      <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-[#10B981] ring-2 ring-[#0F172A]" />
                    </div>

                    <h2 className="mt-3 text-[20px] font-black tracking-tight text-white">{profile.name}</h2>
                    <p className="text-[13px] font-semibold text-emerald-400">{profile.designation || profile.role.replace("_", " ")}</p>
                    <span className="mt-1 rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-bold text-slate-300">
                      {profile.department || "Operations"}
                    </span>
                  </div>
                </div>

                {/* Badge Meta Specs Grid */}
                <div className="my-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 border border-white/10 p-3 text-left">
                  <div>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-400 block">EMP CODE</span>
                    <span className="text-[13px] font-extrabold text-white font-mono">{profile.emp_code}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-400 block">BLOOD GROUP</span>
                    <span className="text-[13px] font-extrabold text-rose-400 flex items-center gap-1">
                      <Droplet className="h-3 w-3" /> {profile.blood_group || "B+"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-400 block">SHIFT</span>
                    <span className="text-[12px] font-bold text-slate-200">{profile.shift_name || "General Shift"}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-400 block">STATUS</span>
                    <span className="text-[12px] font-bold text-emerald-400">Active Staff</span>
                  </div>
                </div>

                {/* Bottom QR Code & Security Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="text-[10px] text-slate-400">
                    <p className="font-bold text-slate-200">SCAN FOR ENTRY / PASS</p>
                    <p className="text-[9px]">Authorized by G.D. Foods HR</p>
                  </div>
                  <div
                    className="h-14 w-14 rounded-xl bg-white p-1 shadow-md"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                </div>
              </div>

              {/* ==================== BACK SIDE ==================== */}
              <div
                className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[28px] border-2 border-white/20 bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#0B132B] p-6 shadow-2xl [transform:rotateY(180deg)] [backface-visibility:hidden]"
              >
                <div>
                  <div className="border-b border-white/10 pb-2.5 text-center">
                    <p className="text-[13px] font-bold text-emerald-400">TERMS & CONDITIONS</p>
                    <p className="text-[10px] text-slate-400">Official Property of GD Foods Mfg. (I) Pvt. Ltd.</p>
                  </div>

                  <div className="mt-4 space-y-3 text-[11.5px] text-slate-300">
                    <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-400" /> Factory Location
                      </p>
                      <p className="mt-1 text-[11px] text-slate-300">{factory.name}</p>
                      <p className="text-[10.5px] text-slate-400">{factory.address || "Industrial Area Phase II, GD Foods Plant"}</p>
                    </div>

                    <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-emerald-400" /> Emergency Helpline
                      </p>
                      <p className="mt-1 text-[12px] font-mono font-bold text-white">
                        {profile.emergency_contact || "+91 98765 43210"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/5 p-2.5 border border-white/10 text-[10px] text-slate-400 leading-relaxed">
                      • This card is strictly non-transferable and must be displayed inside factory premises.
                      <br />• If found, please return to Security Gate or HR Office.
                    </div>
                  </div>
                </div>

                {/* Authorized Signatory */}
                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-[9px] uppercase font-bold text-slate-400">Security Checksum</p>
                    <p className="text-[10px] font-mono text-emerald-400">GDF-SEC-{profile.id.slice(0, 6)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-serif font-black text-white italic">GD Foods HR</p>
                    <p className="text-[9px] font-bold uppercase text-slate-400">Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Flip Card Action Button */}
          <button
            type="button"
            onClick={() => setIsFlipped((f) => !f)}
            className="flex items-center gap-2 rounded-2xl bg-white border border-[#CBD6E2] px-5 py-2.5 text-[13px] font-bold text-[#172334] shadow-md hover:bg-[#F8FAFD] active:scale-95 transition"
          >
            <RotateCw className="h-4 w-4 text-[#1E6FE0]" /> Flip to {isFlipped ? "Front Side" : "Back Side"}
          </button>
        </div>
      ) : (
        /* ==================== GATE PASS TAB ==================== */
        <div className="space-y-5 max-w-3xl mx-auto">
          {/* Gate Pass Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E3EAF1] shadow-sm">
            <div>
              <h2 className="text-[16px] font-bold text-[#172334]">My Gate Passes</h2>
              <p className="text-[12.5px] text-[#8A97A8]">Exit permissions & factory duty passes</p>
            </div>
            <button
              type="button"
              onClick={() => setShowGatePassModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-md active:scale-95 transition"
            >
              <Plus className="h-4 w-4" /> Request Gate Pass
            </button>
          </div>

          {passes.length === 0 ? (
            <div className="card p-12 text-center border border-[#E3EAF1]">
              <QrCode className="mx-auto h-10 w-10 text-[#C5D0DC] mb-2" />
              <p className="text-[16px] font-bold text-[#172334]">No Gate Passes Requested</p>
              <p className="text-[13px] text-[#8A97A8] mt-1">
                Apply for official duty, personal permission, or material dispatch pass.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {passes.map((p) => (
                <div
                  key={p.id}
                  className="card p-5 border border-[#E3EAF1] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0F172A] to-[#1E6FE0] text-white shadow-sm font-bold">
                      <QrCode className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[#172334] capitalize">{p.type} Gate Pass</span>
                        <span
                          className={classNames(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                            p.status === "approved"
                              ? "bg-[#E1F8EF] text-[#06613E]"
                              : p.status === "pending"
                                ? "bg-[#FFF4E0] text-[#D98200]"
                                : "bg-[#FDECEC] text-[#C52B35]"
                          )}
                        >
                          {p.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-[#617083]">
                        <span className="font-semibold text-[#172334]">Exit:</span> {p.time_out} |{" "}
                        <span className="font-semibold text-[#172334]">Return:</span> {p.time_in} · {formatDate(p.date)}
                      </p>
                      <p className="mt-1 text-[12px] text-[#8A97A8]">&ldquo;{p.reason}&rdquo;</p>
                      {p.approver_name && (
                        <p className="mt-1 text-[11.5px] font-semibold text-[#1E6FE0]">
                          Approver: {p.approver_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {p.status === "approved" && (
                    <div className="self-end sm:self-auto rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-center text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto mb-0.5" />
                      ENTRY VERIFIED
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== REQUEST GATE PASS MODAL ==================== */}
      {showGatePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={submitGatePass}
            className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl border border-[#E3EAF1] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#10B981]" />
                <h3 className="text-[17px] font-bold text-[#172334]">Request Digital Gate Pass</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGatePassModal(false)}
                className="rounded-lg p-1 text-[#8A97A8] hover:bg-[#EEF2F7]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Pass Type</label>
                <select
                  className="input font-semibold"
                  value={gpType}
                  onChange={(e) => setGpType(e.target.value)}
                >
                  <option value="duty">Official Duty / Client Visit</option>
                  <option value="personal">Personal Permission</option>
                  <option value="material">Material / Sample Dispatch</option>
                </select>
              </div>

              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={gpDate}
                  onChange={(e) => setGpDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Exit Time</label>
                <input
                  type="time"
                  className="input"
                  value={gpTimeOut}
                  onChange={(e) => setGpTimeOut(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Expected Return Time</label>
                <input
                  type="time"
                  className="input"
                  value={gpTimeIn}
                  onChange={(e) => setGpTimeIn(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label flex items-center gap-1.5 font-bold text-[#172334]">
                <UserCheck className="h-4 w-4 text-[#1E6FE0]" /> Approver (Send Request To)
              </label>
              <select
                className="input font-semibold"
                value={gpApproverId}
                onChange={(e) => setGpApproverId(e.target.value)}
                required
              >
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label || a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Purpose / Reason</label>
              <textarea
                className="input min-h-[72px]"
                placeholder="Reason for leaving factory premises..."
                value={gpReason}
                onChange={(e) => setGpReason(e.target.value)}
                required
              />
            </div>

            {gpError && (
              <div className="rounded-xl bg-rose-50 p-3 text-[13px] font-bold text-rose-700">
                {gpError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#F0F4F8]">
              <button
                type="button"
                onClick={() => setShowGatePassModal(false)}
                className="rounded-xl border border-[#CBD6E2] px-4 py-2.5 text-[13px] font-bold text-[#617083]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={gpSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-md active:scale-95"
              >
                {gpSubmitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Submit Gate Pass
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== EDIT CARD DETAILS MODAL ==================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={saveCardDetails}
            className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl border border-[#E3EAF1] space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-[#1E6FE0]" />
                <h3 className="text-[17px] font-bold text-[#172334]">Edit ID Card Specs</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-[#8A97A8] hover:bg-[#EEF2F7]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="label">Employee ID / Badge Code</label>
              <input
                className="input font-mono font-bold"
                value={editEmpCode}
                onChange={(e) => setEditEmpCode(e.target.value)}
                placeholder="e.g. GDF-1024"
              />
            </div>

            <div>
              <label className="label">Blood Group</label>
              <select
                className="input font-bold"
                value={editBlood}
                onChange={(e) => setEditBlood(e.target.value)}
              >
                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Emergency Contact Helpline</label>
              <input
                className="input font-mono"
                value={editEmergency}
                onChange={(e) => setEditEmergency(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#F0F4F8]">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-xl border border-[#CBD6E2] px-4 py-2.5 text-[13px] font-bold text-[#617083]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex items-center gap-1.5 rounded-xl bg-[#1E6FE0] px-5 py-2.5 text-[13px] font-bold text-white shadow-md active:scale-95"
              >
                {editSaving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Save ID Details
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
