"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, Sparkles, CheckCircle2 } from "lucide-react";
import { classNames } from "@/lib/utils";
import { checkIsNativeApp } from "@/lib/native";

export default function ApkInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    // 1. Do NOT show if running inside native Android WebView app or standalone
    if (checkIsNativeApp()) {
      return;
    }

    // 2. Check 24-hour dismiss cooldown
    try {
      const dismissedAt = localStorage.getItem("hrmate_apk_banner_dismissed_at");
      if (dismissedAt) {
        const diffHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
        if (diffHours < 24) {
          return; // Still in cooldown
        }
      }
    } catch {}

    // 3. Show after 3.5 seconds
    const timer = setTimeout(() => {
      setVisible(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem("hrmate_apk_banner_dismissed_at", String(Date.now()));
    } catch {}
  };

  const handleDownload = () => {
    setDownloading(true);
    // Trigger download of APK
    const link = document.createElement("a");
    link.href = "/api/download/apk";
    link.download = "HRMate.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
      setTimeout(() => {
        setVisible(false);
      }, 4000);
    }, 1500);
  };

  if (!visible) return null;

  return (
    <div className="fixed top-3 left-3 right-3 z-[90] mx-auto max-w-xl animate-slide-in">
      <div className="relative overflow-hidden rounded-3xl border-2 border-[#1E6FE0]/40 bg-gradient-to-r from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-3.5 sm:p-4 text-white shadow-2xl backdrop-blur-xl ring-4 ring-black/10">
        {/* Glow Accent */}
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#1E6FE0]/30 blur-2xl" />

        <div className="relative z-10 flex items-center justify-between gap-3">
          {/* Left: App Icon & Text */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icon.png"
              alt="HRMate App"
              className="h-11 w-11 shrink-0 rounded-2xl object-contain shadow-md ring-2 ring-white/20"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-black tracking-tight text-white">
                  HRMate Android App
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.2 text-[10px] font-extrabold text-emerald-400 ring-1 ring-emerald-500/30">
                  Official APK
                </span>
              </div>
              <p className="truncate text-[11.5px] font-medium text-slate-300">
                {downloaded
                  ? "✓ Download started! Tap notification to install."
                  : "Get 1-tap fingerprint punch & faster speed!"}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className={classNames(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-black text-white shadow-md transition active:scale-95",
                downloaded
                  ? "bg-emerald-600 ring-2 ring-emerald-400"
                  : "bg-gradient-to-r from-[#1E6FE0] to-[#10B981] hover:opacity-90 ring-1 ring-white/20"
              )}
            >
              {downloaded ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Installing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download APK
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
