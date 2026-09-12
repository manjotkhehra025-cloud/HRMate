"use client";

import { useState, useEffect } from "react";
import {
  IdCard,
  QrCode,
  RotateCw,
  Plus,
  Send,
  X,
  CheckCircle2,
  Edit3,
  Check,
  Printer,
  Users,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import TopsLogo from "@/components/TopsLogo";
import { Spinner } from "@/components/ui";
import { generateQrDataUrl } from "@/lib/qrcode";
import { classNames, formatDate } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";
import { FACTORY_DEPARTMENTS } from "@/lib/staff";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  designation: string;
  staff_type?: string;
  color: string;
  avatar?: string;
  emp_code?: string;
  blood_group?: string;
  emergency_contact?: string;
  doj?: string;
  dob?: string;
  shift_name?: string;
}

interface CompanyDetails {
  brandName: string;
  factoryName: string;
  factoryAddress: string;
  officeAddress: string;
  officePhone: string;
  officeEmail: string;
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
  const [company, setCompany] = useState<CompanyDetails>({
    brandName: "Tops",
    factoryName: "G.D. Foods Mfg. (I) Pvt. Ltd.",
    factoryAddress: "Khadur Sahib, Khadur Sahib Tahsil, Tarn Taran, Punjab, 143117, India",
    officeAddress:
      "4th Floor, Novotel City Centre Hotel, Plot No. 1 Community Centre, DB Gupta Road, Motia Khan Jhandewalan, New Delhi -110055",
    officePhone: "+91-11-45233333",
    officeEmail: "response@tops.in",
  });

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(initialUser.id);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
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
  const [editName, setEditName] = useState("");
  const [editEmpCode, setEditEmpCode] = useState("");
  const [editStaffType, setEditStaffType] = useState("official");
  const [editDept, setEditDept] = useState("Production");
  const [editSubDept, setEditSubDept] = useState("");
  const [editDesig, setEditDesig] = useState("");
  const [editBlood, setEditBlood] = useState("A+");
  const [editEmergency, setEditEmergency] = useState("");
  const [editDoj, setEditDoj] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editFactoryName, setEditFactoryName] = useState("");
  const [editFactoryAddress, setEditFactoryAddress] = useState("");
  const [editOfficeAddress, setEditOfficeAddress] = useState("");
  const [editOfficePhone, setEditOfficePhone] = useState("");
  const [editOfficeEmail, setEditOfficeEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Full Screen Print / Preview Modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  async function loadCard(targetUserId?: string) {
    setLoading(true);
    try {
      const uId = targetUserId || selectedUserId;
      const [cardRes, passRes] = await Promise.all([
        fetch(`/api/id-card?userId=${uId}`),
        fetch("/api/gate-pass"),
      ]);

      if (cardRes.ok) {
        const d = await cardRes.json();
        if (d.user) {
          setProfile(d.user);
          setEditName(d.user.name || "");
          setEditEmpCode(d.user.emp_code || "");
          setEditStaffType(d.user.staff_type || "official");

          const fullDept = d.user.department || "Production";
          if (fullDept.includes(" - ")) {
            const [mainD, subD] = fullDept.split(" - ");
            setEditDept(mainD);
            setEditSubDept(subD);
          } else {
            setEditDept(fullDept);
            setEditSubDept("");
          }

          setEditDesig(d.user.designation || "");
          setEditBlood(d.user.blood_group || "A+");
          setEditEmergency(d.user.emergency_contact || "+91 95016 06877");
          setEditDoj(d.user.doj || "27 June 2013");
          setEditDob(d.user.dob || "03 March 1974");
        }
        if (d.company) {
          setCompany(d.company);
          setEditFactoryName(d.company.factoryName || "");
          setEditFactoryAddress(d.company.factoryAddress || "");
          setEditOfficeAddress(d.company.officeAddress || "");
          setEditOfficePhone(d.company.officePhone || "");
          setEditOfficeEmail(d.company.officeEmail || "");
        }
        setIsSuperAdmin(!!d.isSuperAdmin);
        if (d.allUsers) setAllUsers(d.allUsers);

        // Generate 100% ISO Scannable QR Code pointing to Public Standalone Verification Record (No website login required)
        const scanPayload = `https://gdfoods.duckdns.org/verify/${d.user.emp_code || d.user.id}`;
        const qrUrl = await generateQrDataUrl(scanPayload, {
          width: 320,
          fgColor: "#000000",
          bgColor: "#FFFFFF",
        });
        setQrDataUrl(qrUrl);
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
    loadCard(selectedUserId);
  }, [selectedUserId]);

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
      loadCard();
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
      const finalDept = editSubDept ? `${editDept} - ${editSubDept}` : editDept;
      const res = await fetch("/api/id-card", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: profile.id,
          name: editName,
          emp_code: editEmpCode,
          staff_type: editStaffType,
          department: finalDept,
          designation: editDesig,
          blood_group: editBlood,
          emergency_contact: editEmergency,
          doj: editDoj,
          dob: editDob,
          factory_name: editFactoryName,
          factory_address: editFactoryAddress,
          office_address: editOfficeAddress,
          office_phone: editOfficePhone,
          office_email: editOfficeEmail,
        }),
      });
      if (res.ok) {
        setShowEditModal(false);
        loadCard(profile.id);
      }
    } finally {
      setEditSaving(false);
    }
  }

  const isYellowCard = profile.staff_type === "yellow_card";
  const photo = avatarSrc(profile.id, profile.avatar);
  const currentDeptConfig = FACTORY_DEPARTMENTS.find((d) => d.name === editDept);

  return (
    <div className="space-y-6 pb-12">
      {/* 3D Hardware Accelerated & Anti-Ghosting CSS Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .id-card-perspective {
          perspective: 1200px;
          -webkit-perspective: 1200px;
        }
        .id-card-inner {
          position: relative;
          width: 100%;
          min-height: 550px;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .id-card-inner.is-flipped {
          transform: rotateY(180deg);
          -webkit-transform: rotateY(180deg);
        }
        .id-card-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden !important;
          backface-visibility: hidden !important;
          -webkit-transform-style: preserve-3d;
          transform-style: preserve-3d;
          border-radius: 28px;
          overflow: hidden;
        }
        .id-card-face-front {
          transform: rotateY(0deg) translateZ(1px);
          -webkit-transform: rotateY(0deg) translateZ(1px);
          z-index: 2;
        }
        .id-card-face-back {
          transform: rotateY(180deg) translateZ(1px);
          -webkit-transform: rotateY(180deg) translateZ(1px);
          z-index: 1;
        }
        /* Extra WebKit Anti-Ghosting Safeguard */
        .id-card-inner:not(.is-flipped) .id-card-face-back {
          opacity: 0;
          pointer-events: none;
        }
        .id-card-inner.is-flipped .id-card-face-front {
          opacity: 0;
          pointer-events: none;
        }
        .id-card-inner.is-flipped .id-card-face-back {
          opacity: 1;
          pointer-events: auto;
          z-index: 10;
        }
        .id-card-inner:not(.is-flipped) .id-card-face-front {
          opacity: 1;
          pointer-events: auto;
          z-index: 10;
        }

        @media print {
          body * { visibility: hidden !important; }
          #printable-id-card, #printable-id-card * { visibility: visible !important; }
          #printable-id-card {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 20px !important;
            background: white !important;
            padding: 20px !important;
          }
          .print-badge {
            width: 54mm !important;
            height: 86mm !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* Screen Header */}
      <div className="rounded-[22px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames(
              "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md",
              isYellowCard
                ? "bg-gradient-to-tr from-[#0F172A] via-[#1E6FE0] to-[#10B981]"
                : "bg-gradient-to-tr from-[#D1122A] to-[#1E6FE0]"
            )}>
              <IdCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
                  {isYellowCard ? "GD Foods Staff ID & Gate Pass" : "Tops Official ID & Gate Pass"}
                </h1>
                {isYellowCard ? (
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10.5px] font-black text-amber-800">
                    🟡 YELLOW CARD
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10.5px] font-black text-emerald-800">
                    TOPS OFFICIAL
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] sm:text-[13.5px] text-[#617083]">
                Official G.D. Foods Badge, ISO Scannable QR Code & Gate Security.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#CBD6E2] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#172334] shadow-sm hover:bg-[#F8FAFD] active:scale-95 transition"
            >
              <Printer className="h-4 w-4 text-[#1E6FE0]" /> Print / View Badge
            </button>
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-md hover:opacity-95 active:scale-95 transition"
            >
              <Edit3 className="h-4 w-4" /> {isSuperAdmin ? "Edit ID & Addresses" : "Edit Details"}
            </button>
          </div>
        </div>

        {/* Super Admin User Switcher (Fit & Responsive on Mobile) */}
        {isSuperAdmin && allUsers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#F0F4F8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
              <Users className="h-4 w-4 text-[#1E6FE0]" />
              <span className="text-[13px] font-bold text-[#172334]">Super Admin Select Employee:</span>
            </div>
            <select
              value={profile.id}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                loadCard(e.target.value);
              }}
              className="w-full sm:max-w-md truncate rounded-xl border border-[#CBD6E2] bg-[#F8FAFD] px-3.5 py-2.5 text-[13px] font-bold text-[#172334] focus:outline-none focus:ring-2 focus:ring-[#1E6FE0]"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.emp_code || u.id}) — {u.department || "Staff"} · {u.staff_type === "yellow_card" ? "🟡 Yellow Card" : "Official"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs Switcher: ID Card / Gate Pass */}
      <div className="flex rounded-[14px] bg-[#EEF2F7] p-1 max-w-md mx-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("card")}
          className={classNames(
            "flex flex-1 items-center justify-center gap-2 rounded-[12px] py-2.5 text-[13.5px] font-bold transition",
            activeTab === "card" ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
          )}
        >
          <IdCard className={classNames("h-4 w-4", isYellowCard ? "text-[#10B981]" : "text-[#D1122A]")} />
          {isYellowCard ? "Yellow Card ID Badge" : "Official Tops ID Card"}
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
        <div className="flex flex-col items-center justify-center gap-5 print:hidden">
          {/* Flip Card Container with Anti-Ghosting */}
          <div className="id-card-perspective relative w-full max-w-sm">
            <div className={classNames("id-card-inner shadow-2xl rounded-[28px]", isFlipped ? "is-flipped" : "")}>
              {/* ==================== FRONT SIDE ==================== */}
              {isYellowCard ? (
                /* 🟡 YELLOW CARD STAFF FRONT (Green & Blue Theme, NO Tops Logo) */
                <div className="id-card-face id-card-face-front flex flex-col justify-between border-2 border-emerald-500/40 bg-[#0B132B] p-6 text-white shadow-2xl">
                  {/* Header: GD Foods Badge & QR Code */}
                  <div className="relative z-10 flex items-start justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-black text-white shadow-md">
                        GD
                      </div>
                      <div>
                        <p className="text-[13px] font-black tracking-wider text-white">G.D. FOODS</p>
                        <p className="text-[9.5px] font-bold uppercase tracking-widest text-emerald-400">Mfg. (I) Pvt. Ltd.</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      {qrDataUrl && (
                        <div className="rounded-lg bg-white p-1 shadow-md">
                          <img src={qrDataUrl} alt="QR" className="h-11 w-11" />
                        </div>
                      )}
                      <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
                        Scan For Details
                      </span>
                    </div>
                  </div>

                  {/* Yellow Card Badge Strip */}
                  <div className="relative z-10 my-1 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-0.5 text-[11px] font-black tracking-wide text-amber-300">
                      🟡 YELLOW CARD STAFF
                    </span>
                  </div>

                  {/* Photo & Identity */}
                  <div className="relative z-10 my-auto flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="h-36 w-32 overflow-hidden rounded-2xl border-2 border-emerald-400/50 bg-[#0F172A] p-1 shadow-lg">
                        <img src={photo} alt={profile.name} className="h-full w-full rounded-xl object-cover" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-amber-400 ring-4 ring-[#0F172A]" />
                    </div>

                    <h2 className="mt-3 text-[22px] font-black tracking-tight text-white leading-tight">
                      {profile.name}
                    </h2>
                    <p className="mt-0.5 text-[15px] font-bold text-emerald-400">
                      {profile.department || "Production"}
                    </p>
                    {profile.designation && (
                      <span className="mt-1 rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-semibold text-slate-300">
                        {profile.designation}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] font-bold">
                    <span className="text-slate-300 font-mono">ID: {profile.emp_code}</span>
                    <span className="text-emerald-400">● VERIFIED CONTRACTOR</span>
                  </div>
                </div>
              ) : (
                /* 🔴 TOPS OFFICIAL STAFF FRONT (Official Red & White Luxury Theme, Authentic Tops Logo) */
                <div className="id-card-face id-card-face-front flex flex-col justify-between border-2 border-slate-200 bg-white p-6 shadow-2xl">
                  {/* Top Header: Tops Logo + Scannable QR Code */}
                  <div className="relative z-10 flex items-start justify-between">
                    <div className="w-12" />
                    <div className="flex flex-col items-center pt-1">
                      <TopsLogo className="h-10 w-auto drop-shadow-sm" />
                    </div>
                    <div className="flex flex-col items-center">
                      {qrDataUrl ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                          <img src={qrDataUrl} alt="Scan QR Code" className="h-14 w-14" />
                        </div>
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center">
                          <Spinner className="h-5 w-5 text-[#1E6FE0]" />
                        </div>
                      )}
                      <span className="mt-1 text-[8.5px] font-black uppercase tracking-wider text-slate-600">
                        Scan For Details
                      </span>
                    </div>
                  </div>

                  {/* Center Employee Photo */}
                  <div className="relative z-10 my-auto flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="h-44 w-36 overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-50 p-1 shadow-md">
                        <img
                          src={photo}
                          alt={profile.name}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      </div>
                      <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#10B981] ring-4 ring-white" />
                    </div>

                    {/* Full Name & Department exactly matching physical card */}
                    <h2 className="mt-3.5 text-[22px] font-black tracking-tight text-slate-900 leading-tight">
                      {profile.name}
                    </h2>
                    <p className="mt-1 text-[16px] font-bold text-slate-700">
                      {profile.department || profile.designation || "Engineering"}
                    </p>
                  </div>

                  {/* Bottom Footer */}
                  <div className="relative z-10 flex items-center justify-between border-t border-slate-100 pt-2 text-[10.5px] font-bold text-slate-400">
                    <span>ID: {profile.emp_code}</span>
                    <span className="text-emerald-600 font-extrabold">● ACTIVE EMPLOYEE</span>
                  </div>
                </div>
              )}

              {/* ==================== BACK SIDE ==================== */}
              {isYellowCard ? (
                /* 🟡 YELLOW CARD STAFF BACK (Green & Blue Navy Theme, Solid Background, No Ghosting) */
                <div className="id-card-face id-card-face-back flex flex-col justify-between border-2 border-emerald-500/40 bg-[#0B132B] p-6 text-white shadow-2xl">
                  <div className="relative z-10 space-y-2.5 text-left text-[12px] leading-snug">
                    <div className="border-b border-white/10 pb-2 text-center">
                      <p className="text-[13px] font-black text-amber-400">YELLOW CARD CONTRACTOR BADGE</p>
                      <p className="text-[10px] text-slate-400">{company.factoryName}</p>
                    </div>

                    <div className="space-y-1 font-semibold text-white/95">
                      <p><span className="text-slate-400 font-bold">Employee ID :</span> <span className="font-bold">{profile.emp_code}</span></p>
                      <p><span className="text-slate-400 font-bold">DOJ :</span> {profile.doj || "27 June 2013"}</p>
                      <p><span className="text-slate-400 font-bold">DOB :</span> {profile.dob || "03 March 1974"}</p>
                      <p><span className="text-slate-400 font-bold">Blood Group :</span> <span className="font-black text-amber-400">{profile.blood_group || "A+"}</span></p>
                      <p><span className="text-slate-400 font-bold">In Case of Emergency Contact :</span> <span className="font-mono font-bold">{profile.emergency_contact || "9914850317"}</span></p>
                    </div>

                    {/* Instructions */}
                    <div className="rounded-xl bg-white/5 p-2.5 text-[10px] text-slate-300 space-y-1 border border-white/10">
                      <p className="font-bold uppercase tracking-wider text-amber-300">Instructions:</p>
                      <p>1. This badge is property of {company.factoryName} (Yellow Card Category).</p>
                      <p>2. Must be displayed on duty. Quota is strictly 15 EL only.</p>
                      <p>3. Loss must be reported immediately to Security Gate / HR.</p>
                    </div>

                    {/* Return Address */}
                    <div className="rounded-xl bg-white/5 p-2.5 text-[9.5px] text-slate-300 space-y-0.5 border border-white/10">
                      <p className="font-bold text-white">Factory Location :</p>
                      <p className="font-bold text-emerald-400">{company.factoryName}</p>
                      <p className="text-slate-300">{company.factoryAddress}</p>
                      <p className="text-slate-400 font-mono">Emergency: {profile.emergency_contact}</p>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-slate-400">
                    <span>G.D. FOODS MFG. (I) PVT. LTD.</span>
                    <span className="font-bold text-emerald-400">SECURITY VERIFIED</span>
                  </div>
                </div>
              ) : (
                /* 🔴 TOPS OFFICIAL STAFF BACK (Official Red Card with Tops Logo, Solid Background, No Ghosting) */
                <div className="id-card-face id-card-face-back flex flex-col justify-between border-2 border-red-700 bg-[#D1122A] p-6 text-white shadow-2xl">
                  <div className="relative z-10 space-y-2.5 text-left text-[12px] leading-snug">
                    <div className="space-y-1 font-semibold text-white/95">
                      <p><span className="text-white/80 font-bold">Employee ID :</span> <span className="font-bold">{profile.emp_code}</span></p>
                      <p><span className="text-white/80 font-bold">DOJ :</span> {profile.doj || "27 June 2013"}</p>
                      <p><span className="text-white/80 font-bold">DOB :</span> {profile.dob || "03 March 1974"}</p>
                      <p><span className="text-white/80 font-bold">Blood Group :</span> <span className="font-black text-white">{profile.blood_group || "A+"}</span></p>
                      <p><span className="text-white/80 font-bold">In Case of Emergency Contact :</span> <span className="font-mono font-bold">{profile.emergency_contact || "9914850317"}</span></p>
                    </div>

                    {/* Official Card Instructions */}
                    <div className="rounded-xl bg-white/10 p-2.5 text-[10px] text-white/95 space-y-1 leading-normal border border-white/15">
                      <p className="font-bold uppercase tracking-wider text-white">Instructions:</p>
                      <p>1. This card is the property of {company.factoryName} and should returned upon request.</p>
                      <p>2. It Should always be worn & displayed by the respective employee while on duty.</p>
                      <p>3. The loss of this card must be reported immediately to the issuing authority.</p>
                    </div>

                    {/* Return Address */}
                    <div className="rounded-xl bg-white/10 p-2.5 text-[9.5px] text-white/95 space-y-0.5 border border-white/15">
                      <p className="font-bold text-white">If found please return it to :</p>
                      <p className="font-black text-white">{company.factoryName}</p>
                      <p className="text-white/85 leading-tight">{company.officeAddress}</p>
                      <p className="text-white/90 font-mono">Ph. : {company.officePhone}</p>
                      <p className="text-white/90">Email : {company.officeEmail}</p>
                    </div>
                  </div>

                  {/* Bottom Tops Logo */}
                  <div className="relative z-10 flex items-center justify-center pt-2">
                    <TopsLogo className="h-8 w-auto" showOutline />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Flip Card Action Button */}
          <button
            type="button"
            onClick={() => setIsFlipped((f) => !f)}
            className="flex items-center gap-2 rounded-2xl bg-white border border-[#CBD6E2] px-6 py-3 text-[14px] font-black text-[#172334] shadow-md hover:bg-[#F8FAFD] active:scale-95 transition"
          >
            <RotateCw className={classNames("h-4 w-4", isYellowCard ? "text-[#10B981]" : "text-[#D1122A]")} />
            Flip to {isFlipped ? "Front Side (Photo & Name)" : "Back Side (Details & Rules)"}
          </button>
        </div>
      ) : (
        /* ==================== GATE PASS TAB ==================== */
        <div className="space-y-5 max-w-3xl mx-auto print:hidden">
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

      {/* ==================== FULL SCREEN PRINT / BADGE PREVIEW MODAL ==================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl border border-slate-300 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-[#1E6FE0]" />
                <h3 className="text-[17px] font-bold text-slate-900">Print / Download ID Badge</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Side-by-side Front and Back badge preview */}
            <div className="my-6 flex flex-col md:flex-row items-center justify-center gap-6">
              {/* Front Badge */}
              <div className="w-[200px] h-[310px] rounded-[14px] border border-slate-300 overflow-hidden shadow-lg relative flex flex-col justify-between p-3 text-center bg-white">
                {isYellowCard ? (
                  <div className="absolute inset-0 bg-[#0B132B] p-3 text-white flex flex-col justify-between">
                    <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                      <span className="text-[9px] font-black text-emerald-400">G.D. FOODS</span>
                      {qrDataUrl && <img src={qrDataUrl} alt="QR" className="h-7 w-7 bg-white p-0.5 rounded" />}
                    </div>
                    <div className="flex flex-col items-center my-auto">
                      <img src={photo} alt={profile.name} className="h-20 w-16 object-cover rounded border border-emerald-400" />
                      <p className="text-[11px] font-black mt-1 text-white">{profile.name}</p>
                      <p className="text-[9px] font-bold text-emerald-400">{profile.department}</p>
                    </div>
                    <div className="text-[7px] text-amber-300 font-bold border-t border-white/10 pt-1">🟡 YELLOW CARD STAFF</div>
                  </div>
                ) : (
                  <>
                    <div className="absolute -left-6 -top-6 h-20 w-28 rounded-full bg-[#D1122A] -z-0" />
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="w-4" />
                      <TopsLogo className="h-6 w-auto" />
                      {qrDataUrl && <img src={qrDataUrl} alt="QR" className="h-7 w-7 border p-0.5 rounded" />}
                    </div>
                    <div className="relative z-10 flex flex-col items-center my-auto">
                      <img src={photo} alt={profile.name} className="h-24 w-20 object-cover rounded border border-slate-300" />
                      <p className="text-[11px] font-black mt-1 text-slate-900 leading-tight">{profile.name}</p>
                      <p className="text-[9px] font-bold text-slate-700">{profile.department}</p>
                    </div>
                    <div className="text-[7px] text-slate-400 border-t pt-1">TOPS OFFICIAL ID</div>
                  </>
                )}
              </div>

              {/* Back Badge */}
              <div className={classNames(
                "w-[200px] h-[310px] rounded-[14px] border overflow-hidden shadow-lg relative flex flex-col justify-between p-3 text-left",
                isYellowCard ? "bg-[#0B132B] text-white border-slate-700" : "bg-[#D1122A] text-white border-red-800"
              )}>
                <div className="space-y-1 text-[7.5px] leading-tight">
                  <p><strong>Employee ID :</strong> {profile.emp_code}</p>
                  <p><strong>DOJ :</strong> {profile.doj}</p>
                  <p><strong>DOB :</strong> {profile.dob}</p>
                  <p><strong>Blood Group :</strong> {profile.blood_group}</p>
                  <p><strong>Emergency Contact :</strong> {profile.emergency_contact}</p>
                  <div className="border-t border-white/20 pt-1 text-[6.5px] space-y-0.5">
                    <p className="font-bold">Instructions:</p>
                    <p>1. Property of {company.factoryName}.</p>
                    <p>2. Display while on duty.</p>
                  </div>
                  <div className="border-t border-white/20 pt-1 text-[6px]">
                    <p className="font-bold">Return to: {company.factoryName}</p>
                    <p>{company.officeAddress}</p>
                  </div>
                </div>
                {!isYellowCard && (
                  <div className="flex justify-center pt-1">
                    <TopsLogo className="h-5 w-auto" showOutline />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-[13px] font-bold text-slate-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#1E6FE0] px-5 py-2.5 text-[13px] font-bold text-white shadow-md hover:bg-[#1556B8] active:scale-95"
              >
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT ID CARD & ADDRESS MODAL ==================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <form
            onSubmit={saveCardDetails}
            className="w-full max-w-xl rounded-[24px] bg-white p-6 shadow-2xl border border-[#E3EAF1] space-y-4 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#F0F4F8] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-[#1E6FE0]" />
                <div>
                  <h3 className="text-[17px] font-bold text-[#172334]">
                    {isSuperAdmin ? `Edit ID Card — ${profile.name}` : "Edit Personal ID Info"}
                  </h3>
                  <p className="text-[11.5px] text-[#8A97A8]">Fill employee card, department, & company details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-[#8A97A8] hover:bg-[#EEF2F7]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Employee Specific Details */}
            <div className="space-y-3">
              <h4 className="text-[12.5px] font-black uppercase tracking-wider text-[#1E6FE0]">
                1. Employee Badge Details
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    className="input font-bold"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={!isSuperAdmin}
                    required
                  />
                </div>

                <div>
                  <label className="label">Employee ID (e.g. NS000001)</label>
                  <input
                    className="input font-mono font-bold"
                    value={editEmpCode}
                    onChange={(e) => setEditEmpCode(e.target.value)}
                    disabled={!isSuperAdmin}
                    placeholder="NS000001"
                    required
                  />
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="label">Staff Category</label>
                    <select
                      className="input font-bold"
                      value={editStaffType}
                      onChange={(e) => setEditStaffType(e.target.value)}
                    >
                      <option value="official">Official Staff (Tops ID Card)</option>
                      <option value="yellow_card">🟡 Yellow Card / Third Party (15 EL Only)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Department (6 Factory Departments)</label>
                  {isSuperAdmin ? (
                    <select
                      className="input font-semibold"
                      value={editDept}
                      onChange={(e) => {
                        setEditDept(e.target.value);
                        const cfg = FACTORY_DEPARTMENTS.find((d) => d.name === e.target.value);
                        if (cfg?.subDepartments && cfg.subDepartments.length > 0) {
                          setEditSubDept(cfg.subDepartments[0]);
                        } else {
                          setEditSubDept("");
                        }
                      }}
                    >
                      {FACTORY_DEPARTMENTS.map((d) => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="input font-medium bg-[#F8FAFD]" value={editDept} disabled />
                  )}
                </div>

                {/* Sub-department selector if department has sub-units */}
                {isSuperAdmin && currentDeptConfig?.subDepartments && currentDeptConfig.subDepartments.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="label text-[#1E6FE0] font-bold">
                      Sub-Department ({editDept})
                    </label>
                    <select
                      className="input font-bold text-[#1E6FE0] border-[#1E6FE0]/40"
                      value={editSubDept}
                      onChange={(e) => setEditSubDept(e.target.value)}
                    >
                      {currentDeptConfig.subDepartments.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Designation (Manual Custom Entry)</label>
                  <input
                    className="input font-medium"
                    value={editDesig}
                    onChange={(e) => setEditDesig(e.target.value)}
                    disabled={!isSuperAdmin}
                    placeholder="e.g. Senior Officer, Assistant Manager, Operator"
                  />
                </div>

                <div>
                  <label className="label">Date of Joining (DOJ)</label>
                  <input
                    className="input font-semibold"
                    value={editDoj}
                    onChange={(e) => setEditDoj(e.target.value)}
                    disabled={!isSuperAdmin}
                    placeholder="e.g. 27 June 2013"
                  />
                </div>

                <div>
                  <label className="label">Date of Birth (DOB)</label>
                  <input
                    className="input font-semibold"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    disabled={!isSuperAdmin}
                    placeholder="e.g. 03 March 1974"
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
                  <label className="label">Emergency Contact Phone</label>
                  <input
                    className="input font-mono font-bold"
                    value={editEmergency}
                    onChange={(e) => setEditEmergency(e.target.value)}
                    placeholder="9914850317"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Super Admin Company & Address Settings */}
            {isSuperAdmin && (
              <div className="space-y-3 pt-3 border-t border-[#F0F4F8]">
                <h4 className="text-[12.5px] font-black uppercase tracking-wider text-emerald-600">
                  2. Company & Factory Address Settings
                </h4>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Company Name</label>
                    <input
                      className="input font-bold"
                      value={editFactoryName}
                      onChange={(e) => setEditFactoryName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">Office Phone Number</label>
                    <input
                      className="input font-mono"
                      value={editOfficePhone}
                      onChange={(e) => setEditOfficePhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Factory Address (Location)</label>
                  <input
                    className="input font-medium"
                    value={editFactoryAddress}
                    onChange={(e) => setEditFactoryAddress(e.target.value)}
                    placeholder="Khadur Sahib, Tarn Taran, Punjab"
                  />
                </div>

                <div>
                  <label className="label">Corporate Office Return Address</label>
                  <textarea
                    className="input min-h-[64px]"
                    value={editOfficeAddress}
                    onChange={(e) => setEditOfficeAddress(e.target.value)}
                    placeholder="4th Floor, Novotel City Centre Hotel, Jhandewalan, New Delhi"
                  />
                </div>

                <div>
                  <label className="label">Office Contact Email</label>
                  <input
                    className="input"
                    value={editOfficeEmail}
                    onChange={(e) => setEditOfficeEmail(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#F0F4F8]">
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
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-md active:scale-95"
              >
                {editSaving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Save Card Details
              </button>
            </div>
          </form>
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
                <Users className="h-4 w-4 text-[#1E6FE0]" /> Approver (Send Request To)
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
    </div>
  );
}
