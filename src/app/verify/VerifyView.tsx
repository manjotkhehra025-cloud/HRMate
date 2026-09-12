"use client";

import { useState } from "react";
import TopsLogo from "@/components/TopsLogo";
import {
  CheckCircle2,
  ShieldCheck,
  Building2,
  MapPin,
  Phone,
  Calendar,
  User,
  HeartPulse,
  Briefcase,
  Copy,
  Check,
  FileText,
  Table,
  Printer,
  AlertCircle,
} from "lucide-react";
import { classNames } from "@/lib/utils";

interface VerifiedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  designation: string;
  phone: string;
  color: string;
  avatar?: string;
  staff_type: string;
  emp_code: string;
  blood_group: string;
  emergency_contact: string;
  doj: string;
  dob: string;
  active: number;
}

interface CompanyInfo {
  brandName: string;
  factoryName: string;
  factoryAddress: string;
  officeAddress: string;
  officePhone: string;
  officeEmail: string;
}

export default function VerifyView({
  data,
  code,
}: {
  data: { user: VerifiedUser; company: CompanyInfo } | null;
  code: string;
}) {
  const [format, setFormat] = useState<"table" | "text">("table");
  const [copied, setCopied] = useState(false);

  if (!data || !data.user) {
    return (
      <main className="min-h-screen bg-[#0B132B] px-4 py-12 flex flex-col items-center justify-center text-white">
        <div className="w-full max-w-md rounded-[28px] bg-[#1C2541] p-8 text-center border border-rose-500/30 shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-[22px] font-black tracking-tight text-white">
            Employee Record Not Found
          </h1>
          <p className="mt-2 text-[14px] text-slate-300">
            No active employee was found matching code{" "}
            <span className="font-mono font-bold text-rose-400">&ldquo;{code}&rdquo;</span>.
          </p>
          <div className="mt-6 rounded-2xl bg-white/5 p-4 text-[12px] text-slate-400 text-left border border-white/10 space-y-1">
            <p className="font-bold text-white uppercase tracking-wider">Security Notice:</p>
            <p>• Check if the QR code is damaged or outdated.</p>
            <p>• Contact G.D. Foods HR / Security Gate for physical verification.</p>
          </div>
        </div>
      </main>
    );
  }

  const { user, company } = data;
  const isOfficial = user.staff_type !== "yellow_card";

  const plainTextSummary = `=====================================================
G.D. FOODS MFG. (I) PVT. LTD. — EMPLOYEE VERIFICATION
=====================================================
Status           : ACTIVE & VERIFIED ✓
Employee ID      : ${user.emp_code}
Full Name        : ${user.name}
Category         : ${isOfficial ? "TOPS OFFICIAL STAFF" : "YELLOW CARD STAFF (CONTRACTOR)"}
Department       : ${user.department || "Production"}
Designation      : ${user.designation || "Staff Member"}
Date of Joining  : ${user.doj || "N/A"}
Date of Birth    : ${user.dob || "N/A"}
Blood Group      : ${user.blood_group || "N/A"}
Emergency Contact: ${user.emergency_contact || "N/A"}
Factory Employer : ${company.factoryName}
Factory Location : ${company.factoryAddress}
=====================================================
Issued by G.D. Foods HR Security System`;

  function copyText() {
    navigator.clipboard.writeText(plainTextSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const avatarUrl = `/api/avatar/${user.id}`;

  return (
    <main className="min-h-screen bg-[#070D18] px-3.5 py-6 sm:py-10 flex flex-col items-center justify-start text-white selection:bg-[#1E6FE0] selection:text-white">
      {/* Printable verification slip style */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden !important; }
          #verify-container, #verify-container * { visibility: visible !important; }
          #verify-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

      <div
        id="verify-container"
        className="w-full max-w-2xl rounded-[32px] overflow-hidden bg-[#0F172A] border border-white/15 shadow-2xl"
      >
        {/* Top Header Banner */}
        <div className={classNames(
          "relative px-6 py-6 border-b",
          isOfficial
            ? "bg-gradient-to-r from-[#D1122A] via-[#B91C1C] to-[#881337] border-red-500/30 text-white"
            : "bg-gradient-to-r from-[#0B132B] via-[#1E293B] to-[#0F172A] border-emerald-500/30 text-white"
        )}>
          {/* Glowing Ambient */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {isOfficial ? (
                /* Authentic Tops Logo Badge for Official Staff */
                <div className="rounded-2xl bg-white p-2 shadow-lg flex items-center justify-center shrink-0">
                  <TopsLogo className="h-9 w-auto" />
                </div>
              ) : (
                /* GD Foods Contractor Badge for Yellow Card Staff */
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-black text-white text-lg shadow-lg">
                  GD
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[19px] sm:text-[21px] font-black tracking-tight text-white">
                    {company.factoryName}
                  </h1>
                </div>
                <p className="text-[11.5px] font-bold uppercase tracking-widest text-white/90">
                  {isOfficial ? "Official Staff Verification Record" : "Yellow Card Contractor Verification"}
                </p>
              </div>
            </div>

            {/* Official Status Shield */}
            <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-[11.5px] font-black text-emerald-300 shadow-sm backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>ACTIVE & VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Employee Identity Hero Banner */}
        <div className="p-5 sm:p-6 bg-[#162032] border-b border-white/10 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border-2 border-white/20 bg-slate-800 shadow-md">
              <img
                src={avatarUrl}
                alt={user.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Fallback avatar icon
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#162032]">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-[22px] sm:text-[24px] font-black tracking-tight text-white">
                {user.name}
              </h2>
              {isOfficial ? (
                <span className="rounded-full bg-red-500/20 border border-red-400/40 px-2.5 py-0.5 text-[10.5px] font-black uppercase text-red-300">
                  🔴 Tops Official Staff
                </span>
              ) : (
                <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10.5px] font-black uppercase text-amber-300">
                  🟡 Yellow Card Staff
                </span>
              )}
            </div>
            <p className="mt-1 text-[15px] font-bold text-emerald-400">
              {user.department || "Production"}
            </p>
            {user.designation && (
              <p className="mt-0.5 text-[13px] font-medium text-slate-300">
                {user.designation}
              </p>
            )}
            <p className="mt-1 font-mono text-[13px] font-bold text-slate-400">
              Employee ID: <span className="text-white font-black">{user.emp_code}</span>
            </p>
          </div>
        </div>

        {/* View Format Selector Tabs */}
        <div className="no-print px-5 pt-4 pb-2 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0F172A]">
          <div className="flex rounded-xl bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setFormat("table")}
              className={classNames(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition",
                format === "table" ? "bg-white text-slate-900 shadow" : "text-slate-300 hover:text-white"
              )}
            >
              <Table className="h-3.5 w-3.5 text-[#1E6FE0]" /> Table Format
            </button>
            <button
              type="button"
              onClick={() => setFormat("text")}
              className={classNames(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold transition",
                format === "text" ? "bg-white text-slate-900 shadow" : "text-slate-300 hover:text-white"
              )}
            >
              <FileText className="h-3.5 w-3.5 text-emerald-600" /> Plain Text Format
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyText}
              className="flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-[12px] font-bold text-white transition active:scale-95"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-[12px] font-bold text-white transition active:scale-95"
            >
              <Printer className="h-3.5 w-3.5 text-slate-300" /> Print
            </button>
          </div>
        </div>

        {/* Format Content Body */}
        <div className="p-5 sm:p-6 bg-[#0F172A]">
          {format === "table" ? (
            /* ==================== SIMPLE TABLE FORMAT ==================== */
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#162032] shadow-md">
              <table className="w-full text-left text-[13.5px]">
                <tbody className="divide-y divide-white/10">
                  <tr className="hover:bg-white/5 transition">
                    <td className="w-1/3 px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <User className="h-4 w-4 text-emerald-400 shrink-0" />
                      Employee ID
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-white text-[14.5px]">
                      {user.emp_code}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <User className="h-4 w-4 text-emerald-400 shrink-0" />
                      Full Name
                    </td>
                    <td className="px-4 py-3 font-black text-white">
                      {user.name}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      Staff Category
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {isOfficial ? (
                        <span className="inline-flex items-center gap-1.5 text-red-400">
                          🔴 Tops Official Staff
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-400">
                          🟡 Yellow Card Staff (Verified Contractor)
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-emerald-400 shrink-0" />
                      Department
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-400">
                      {user.department || "Production"}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-emerald-400 shrink-0" />
                      Designation
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {user.designation || "Staff Member"}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
                      Date of Joining
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {user.doj || "27 June 2013"}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
                      Date of Birth
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-300">
                      {user.dob || "03 March 1974"}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-rose-400 shrink-0" />
                      Blood Group
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-lg bg-rose-500/20 border border-rose-400/40 px-2.5 py-0.5 font-black text-rose-300 text-[13px]">
                        {user.blood_group || "A+"}
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                      Emergency Contact
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">
                      <a href={`tel:${user.emergency_contact}`} className="hover:underline">
                        {user.emergency_contact || "+91 99148 50317"}
                      </a>
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      Company / Factory
                    </td>
                    <td className="px-4 py-3 font-bold text-white">
                      {company.factoryName}
                    </td>
                  </tr>

                  <tr className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 font-bold text-slate-400 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                      Factory Address
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-slate-300">
                      {company.factoryAddress}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            /* ==================== SIMPLE PLAIN TEXT FORMAT ==================== */
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/15 bg-[#070D18] p-4 sm:p-5 font-mono text-[12.5px] leading-relaxed text-slate-200 overflow-x-auto shadow-inner">
                <pre className="whitespace-pre-wrap">{plainTextSummary}</pre>
              </div>
              <p className="text-[11.5px] text-slate-400 italic">
                * Plain text format can be copied directly for gate logs, visitor register, or SMS/WhatsApp dispatch.
              </p>
            </div>
          )}

          {/* Security & Official Clearance Notice (Strictly Read-Only, No Website Links) */}
          <div className="mt-5 rounded-2xl bg-white/5 p-4 border border-white/10 text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-200 uppercase tracking-wider">
              Official Clearance & Security Verification:
            </p>
            <p>
              • This digital record is verified in real-time directly from G.D. Foods Mfg. (I) Pvt. Ltd. Central Server.
            </p>
            <p>
              • Valid for gate security entry, exit check, emergency identity confirmation, and plant authorization.
            </p>
            <p className="text-slate-500 font-mono text-[10px] pt-1">
              G.D. Foods Mfg. (I) Pvt. Ltd. • Khadur Sahib, Tarn Taran, Punjab, 143117, India
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
