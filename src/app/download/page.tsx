"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Download,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  QrCode,
  Zap,
  Fingerprint,
  Bell,
  MapPin,
  Lock,
} from "lucide-react";
import HRMateLogo from "@/components/HRMateLogo";
import { classNames } from "@/lib/utils";

export default function DownloadPage() {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    const link = document.createElement("a");
    link.href = "/api/download/apk";
    link.download = "HRMate.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
    }, 1200);
  };

  const currentUrl = typeof window !== "undefined" ? window.location.origin : "https://gdfoods.duckdns.org";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    `${currentUrl}/api/download/apk`
  )}&margin=8`;

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0F172A] selection:bg-[#1E6FE0] selection:text-white dark:bg-[#0B132B] dark:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/90 px-4 py-3.5 backdrop-blur-md sm:px-8 dark:border-[#1E293B] dark:bg-[#0F172A]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <HRMateLogo size={36} withText={true} subtitle="GD Foods Mfg. (I) Pvt. Ltd." />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[12.5px] font-bold text-[#0F172A] shadow-sm hover:bg-[#EEF2F7] transition active:scale-95 dark:border-[#334155] dark:bg-[#1E293B] dark:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Portal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="relative overflow-hidden rounded-[32px] border border-[#1E6FE0]/30 bg-gradient-to-br from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-6 sm:p-12 text-white shadow-2xl">
          {/* Background Ambient Lights */}
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#1E6FE0]/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#10B981]/20 blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-[11.5px] font-extrabold text-emerald-300 ring-1 ring-emerald-500/40">
                  <Sparkles className="h-3.5 w-3.5" /> Official Android Release
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                  v1.0.4 · APK
                </span>
              </div>

              <h1 className="text-[28px] sm:text-[40px] font-black leading-tight tracking-tight text-white">
                HRMate for Android
              </h1>
              <p className="text-[14px] sm:text-[16px] text-slate-300 leading-relaxed font-medium">
                Supercharge your factory workday with 1-tap Biometric Selfie Punch, instant Push Reminders, Offline Mode, and seamless Holiday & Leave Tracking.
              </p>

              {/* Download Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  disabled={downloading}
                  onClick={handleDownload}
                  className={classNames(
                    "flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[15px] font-black text-white shadow-xl transition-all duration-150 active:scale-95",
                    downloaded
                      ? "bg-emerald-600 ring-4 ring-emerald-400/30"
                      : "bg-gradient-to-r from-[#1E6FE0] to-[#10B981] hover:brightness-110 ring-2 ring-white/25"
                  )}
                >
                  <Download className="h-5 w-5" />
                  {downloaded ? "✓ Downloading APK..." : "Download Android APK (Direct)"}
                </button>
              </div>

              <div className="flex items-center gap-4 text-[12px] text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> 100% Virus Free & Signed
                </span>
                <span>•</span>
                <span>Android 8.0 to 15+</span>
              </div>
            </div>

            {/* Right: Phone QR Code & Mockup Card */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative rounded-3xl border border-white/15 bg-white/10 p-5 text-center shadow-2xl backdrop-blur-xl ring-1 ring-white/10 w-full max-w-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 mb-3">
                  <Smartphone className="h-7 w-7 text-[#38BDF8]" />
                </div>
                <h3 className="text-[16px] font-bold text-white">Scan to Install on Phone</h3>
                <p className="text-[12px] text-slate-300 mt-1 mb-3">
                  Open your phone camera & scan below:
                </p>

                <div className="mx-auto rounded-2xl bg-white p-2.5 shadow-inner inline-block">
                  <img
                    src={qrUrl}
                    alt="HRMate APK Download QR Code"
                    width={160}
                    height={160}
                    className="h-40 w-40 object-contain rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#1E6FE0] dark:bg-blue-950/40 dark:text-[#38BDF8]">
              <Fingerprint className="h-6 w-6" />
            </div>
            <h3 className="mt-3.5 text-[15px] font-black text-[#0F172A] dark:text-white">
              Native Fingerprint & Face
            </h3>
            <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
              Instant 1-tap biometric login with hardware-backed security.
            </p>
          </div>

          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#10B981] dark:bg-emerald-950/40 dark:text-[#34D399]">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="mt-3.5 text-[15px] font-black text-[#0F172A] dark:text-white">
              Precision Factory Geofence
            </h3>
            <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
              Fast GPS verification for factory attendance and selfie punch-in.
            </p>
          </div>

          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="mt-3.5 text-[15px] font-black text-[#0F172A] dark:text-white">
              Instant Push Reminders
            </h3>
            <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
              Never miss a shift punch-in, holiday celebration, or approval notice.
            </p>
          </div>

          <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="mt-3.5 text-[15px] font-black text-[#0F172A] dark:text-white">
              Zero Lag & Offline Cache
            </h3>
            <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
              Optimized for high-speed performance across all Android devices.
            </p>
          </div>
        </div>

        {/* 3 Simple Installation Steps */}
        <div className="mt-10 rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
          <h2 className="text-[18px] sm:text-[20px] font-black text-[#0F172A] dark:text-white">
            How to Install the APK on Your Android Device:
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1E6FE0] text-white font-black text-[16px]">
                1
              </div>
              <div>
                <h4 className="text-[14.5px] font-bold text-[#0F172A] dark:text-white">
                  Tap "Download APK"
                </h4>
                <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                  Click the download button above to save the file (<code className="text-[#1E6FE0]">HRMate.apk</code>) to your downloads folder.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#10B981] text-white font-black text-[16px]">
                2
              </div>
              <div>
                <h4 className="text-[14.5px] font-bold text-[#0F172A] dark:text-white">
                  Open Downloaded File
                </h4>
                <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                  Swipe down your notification shade or open Chrome Downloads and tap on <code className="text-[#10B981]">HRMate.apk</code>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white font-black text-[16px]">
                3
              </div>
              <div>
                <h4 className="text-[14.5px] font-bold text-[#0F172A] dark:text-white">
                  Tap Install & Launch
                </h4>
                <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                  If prompted, tap "Allow from this source" and tap <strong>Install</strong>. Launch HRMate and sign in!
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
