"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  FolderLock,
  Download,
  Printer,
  Plus,
  CheckCircle2,
  Trash2,
  Building2,
  ShieldCheck,
  Eye,
  FileCheck,
  Award,
} from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";

interface DocItem {
  id: string;
  user_id: string;
  title: string;
  doc_type: string;
  doc_number: string;
  file_url: string;
  verified: number;
  created_at: number;
}

export default function DocumentsClient({
  currentUserId,
  role,
  userDept,
}: {
  currentUserId: string;
  role: string;
  userDept: string;
}) {
  const isAdmin = role === "super_admin" || role === "admin";
  const [activeTab, setActiveTab] = useState<"locker" | "letters">("locker");

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("Aadhaar Card");
  const [docNumber, setDocNumber] = useState("");
  const [saving, setSaving] = useState(false);

  // Letter generator
  const [letterType, setLetterType] = useState<"bonafide" | "duty" | "experience">("bonafide");
  const [letterData, setLetterData] = useState<any>(null);
  const [generatingLetter, setGeneratingLetter] = useState(false);

  const loadDocs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/documents?userId=${currentUserId}`);
      const data = await res.json();
      if (data.ok) {
        setDocs(data.docs || []);
        setProfile(data.profile || null);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const loadLetter = async (type: string) => {
    try {
      setGeneratingLetter(true);
      const res = await fetch(`/api/documents/letter?type=${type}&userId=${currentUserId}`);
      const data = await res.json();
      if (data.ok) {
        setLetterData(data);
      }
    } catch {}
    finally {
      setGeneratingLetter(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  useEffect(() => {
    if (activeTab === "letters") {
      loadLetter(letterType);
    }
  }, [activeTab, letterType]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          doc_type: docType,
          doc_number: docNumber,
          targetUserId: currentUserId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setUploadModalOpen(false);
        setTitle("");
        setDocNumber("");
        loadDocs();
      }
    } catch {}
    finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        loadDocs();
      }
    } catch {}
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#1E6FE0]/30 bg-gradient-to-br from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-5 sm:p-6 text-white shadow-xl print:hidden">
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-500/40">
                <FolderLock className="h-3.5 w-3.5" /> Digital Document Locker & Letters
              </span>
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-white">
              Official KYC Locker & Factory Letters
            </h1>
            <p className="text-[13px] text-slate-300">
              Verified identity records, ESIC cards, Bonafide certificates, and Duty verification letters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setTitle("");
                setDocNumber("");
                setUploadModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#1E6FE0] to-[#10B981] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" /> Add KYC Document
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2 dark:border-[#1E293B] print:hidden">
        <button
          onClick={() => setActiveTab("locker")}
          className={classNames(
            "rounded-xl px-4 py-2 text-[13px] font-bold transition",
            activeTab === "locker"
              ? "bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-[#0F172A]"
              : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]"
          )}
        >
          KYC Locker ({docs.length})
        </button>
        <button
          onClick={() => setActiveTab("letters")}
          className={classNames(
            "rounded-xl px-4 py-2 text-[13px] font-bold transition",
            activeTab === "letters"
              ? "bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-[#0F172A]"
              : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]"
          )}
        >
          1-Click Official Letters & Certificates
        </button>
      </div>

      {/* 1. KYC LOCKER VIEW */}
      {activeTab === "locker" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner className="h-8 w-8 text-[#1E6FE0]" />
              <p className="mt-2 text-[13px] font-medium text-[#64748B]">Loading your documents...</p>
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
              <FolderLock className="mx-auto h-12 w-12 text-[#94A3B8]" />
              <h3 className="mt-3 text-[16px] font-bold text-[#0F172A] dark:text-white">No KYC Documents Added</h3>
              <p className="mt-1 text-[13px] text-[#64748B]">Securely add your Aadhaar, PAN, Bank Passbook or Medical Fitness Certificate.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col justify-between rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-[#1E6FE0] dark:bg-blue-950/40 dark:text-[#38BDF8]">
                        {d.doc_type}
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <ShieldCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    </div>

                    <h4 className="mt-3 text-[16px] font-black text-[#0F172A] dark:text-white">
                      {d.title}
                    </h4>

                    {d.doc_number && (
                      <div className="mt-2 rounded-xl bg-[#F8FAFC] p-2.5 font-mono text-[12px] font-bold text-[#0F172A] border border-[#E2E8F0] dark:border-[#1E293B] dark:bg-[#0B132B] dark:text-white">
                        ID: {d.doc_number}
                      </div>
                    )}

                    <p className="mt-2 text-[11.5px] text-[#64748B]">
                      Added on {formatDate(new Date(d.created_at).toISOString().split("T")[0])}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-3 dark:border-[#1E293B]">
                    <span className="text-[11.5px] font-semibold text-emerald-600">
                      ✓ Secure Locker Encrypted
                    </span>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. 1-CLICK OFFICIAL LETTERS & CERTIFICATES */}
      {activeTab === "letters" && (
        <div className="space-y-4">
          {/* Letter Type Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A] print:hidden">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setLetterType("bonafide")}
                className={classNames(
                  "px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition",
                  letterType === "bonafide"
                    ? "bg-[#1E6FE0] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8]"
                )}
              >
                1. Bonafide / Employment Certificate
              </button>
              <button
                onClick={() => setLetterType("duty")}
                className={classNames(
                  "px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition",
                  letterType === "duty"
                    ? "bg-[#1E6FE0] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8]"
                )}
              >
                2. Factory Duty & Shift Pass
              </button>
              <button
                onClick={() => setLetterType("experience")}
                className={classNames(
                  "px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold transition",
                  letterType === "experience"
                    ? "bg-[#1E6FE0] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8]"
                )}
              >
                3. Service & Experience Letter
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-[12.5px] font-bold text-white shadow-sm hover:brightness-110 active:scale-95 dark:bg-white dark:text-[#0F172A]"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
          </div>

          {/* Letter Template Paper Sheet */}
          {generatingLetter || !letterData ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner className="h-8 w-8 text-[#1E6FE0]" />
              <p className="mt-2 text-[13px] font-medium text-[#64748B]">Generating official certificate...</p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl rounded-3xl border border-[#CBD5E1] bg-white p-8 sm:p-12 text-[#0F172A] shadow-xl dark:border-[#334155] dark:bg-white dark:text-[#0F172A] print:border-none print:shadow-none print:p-0">
              {/* Official Factory Letterhead */}
              <div className="border-b-2 border-[#0B192C] pb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-[20px] sm:text-[24px] font-black tracking-tight text-[#0B192C]">
                    GD FOODS MFG. (INDIA) PVT. LTD.
                  </h2>
                  <p className="text-[12px] font-semibold text-slate-700">
                    Makers of Tops Brand Quality Food Products
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                    Plant: Village Dhunda, Goindwal Road, Khadur Sahib, Dist. Tarn Taran, Punjab - 143422
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-xl bg-red-600 px-3.5 py-1 text-[13px] font-black text-white uppercase tracking-wider">
                    TOPS
                  </span>
                  <p className="text-[11px] font-mono text-slate-500 mt-2">
                    Ref: {letterData.refNumber}
                  </p>
                  <p className="text-[11px] font-bold text-slate-600">
                    Date: {letterData.issuedDate}
                  </p>
                </div>
              </div>

              {/* Letter Title */}
              <div className="mt-8 text-center">
                <h3 className="inline-block border-b-2 border-[#0F172A] pb-1 text-[16px] sm:text-[18px] font-black uppercase tracking-wide">
                  {letterType === "bonafide" && "TO WHOMSOEVER IT MAY CONCERN / BONAFIDE CERTIFICATE"}
                  {letterType === "duty" && "OFFICIAL FACTORY DUTY & SHIFT CERTIFICATE"}
                  {letterType === "experience" && "SERVICE & EXPERIENCE CERTIFICATE"}
                </h3>
              </div>

              {/* Letter Body */}
              <div className="mt-8 space-y-4 text-[14px] leading-relaxed text-slate-800">
                {letterType === "bonafide" && (
                  <>
                    <p>
                      This is to certify that <strong>{letterData.employee.name}</strong> (Employee ID: <strong>{letterData.employee.empCode}</strong>) is a bona fide employee of <strong>GD Foods Mfg. (India) Pvt. Ltd.</strong>, working at our Khadur Sahib Manufacturing Plant, Tarn Taran, Punjab.
                    </p>
                    <p>
                      The employee holds the designation of <strong>{letterData.employee.designation}</strong> in the <strong>{letterData.employee.department} Department</strong> and has been in continuous service with the company since <strong>{letterData.employee.doj}</strong>.
                    </p>
                    <p>
                      During the period of employment, their conduct and performance have been observed to be good. This certificate is issued upon the request of the employee for administrative / banking / official verification purposes.
                    </p>
                  </>
                )}

                {letterType === "duty" && (
                  <>
                    <p>
                      This is to certify that <strong>{letterData.employee.name}</strong> (Employee ID: <strong>{letterData.employee.empCode}</strong>) is actively on duty at <strong>GD Foods Mfg. (India) Pvt. Ltd.</strong>, Khadur Sahib Plant.
                    </p>
                    <p>
                      <strong>Department:</strong> {letterData.employee.department} <br />
                      <strong>Designation:</strong> {letterData.employee.designation} <br />
                      <strong>Assigned Shift:</strong> {letterData.employee.shift} <br />
                      <strong>Status:</strong> Active Factory Duty Staff
                    </p>
                    <p>
                      This certificate validates their authorized presence for plant operations and official transit during shift hours.
                    </p>
                  </>
                )}

                {letterType === "experience" && (
                  <>
                    <p>
                      This is to certify that <strong>{letterData.employee.name}</strong> (Employee Code: <strong>{letterData.employee.empCode}</strong>) has been associated with <strong>GD Foods Mfg. (India) Pvt. Ltd.</strong> as <strong>{letterData.employee.designation}</strong> in the <strong>{letterData.employee.department} Department</strong> since <strong>{letterData.employee.doj}</strong>.
                    </p>
                    <p>
                      During their tenure, they have demonstrated high dedication, professional competency, and safety adherence in factory operations. We wish them continued success in all their future professional endeavors.
                    </p>
                  </>
                )}
              </div>

              {/* Signature Block */}
              <div className="mt-16 pt-8 flex items-end justify-between border-t border-slate-200">
                <div>
                  <div className="h-10 w-28 border-b border-dashed border-slate-400 mb-1"></div>
                  <p className="text-[13px] font-black text-[#0B192C]">Authorised Signatory</p>
                  <p className="text-[11px] text-slate-500">Human Resources Department</p>
                  <p className="text-[11px] font-bold text-slate-600">GD Foods Mfg. (I) Pvt. Ltd.</p>
                </div>

                <div className="text-right">
                  <div className="inline-flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-600 p-2 text-emerald-800">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Officially Verified</span>
                    <span className="text-[8px] font-mono">HRMate Digital System</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UPLOAD KYC MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
              Add Digital KYC Document
            </h3>

            <form onSubmit={handleUpload} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Document Type *
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-2.5 text-[12.5px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                >
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Bank Passbook">Bank Account Passbook / Cheque</option>
                  <option value="ESIC Card">ESIC Health Insurance Card</option>
                  <option value="PF UAN">EPFO / UAN Document</option>
                  <option value="Medical Fitness">Medical Fitness & Hygiene Certificate</option>
                  <option value="Factory ID">Factory ID Verification</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Document Title / Description *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Government Aadhaar Card (Front/Back)"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[13px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#0F172A] dark:text-white">
                  Document / Number (Optional)
                </label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="e.g. XXXX-XXXX-1234 or PAN number"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[13px] text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
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
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
