"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut, Smartphone, Download } from "lucide-react";
import Avatar, { avatarSrc } from "./Avatar";
import type { NavItem, SessionUserShape } from "./Sidebar";
import HRMateLogo from "./HRMateLogo";
import { classNames } from "@/lib/utils";
import { useIsNativeApp } from "@/lib/native";

const TILE_COLORS = [
  { bg: "#E8F1FF", fg: "#1E6FE0", darkBg: "#1E293B", darkFg: "#60A5FA" },
  { bg: "#E6F8EF", fg: "#07945D", darkBg: "#1E293B", darkFg: "#34D399" },
  { bg: "#F3E9FF", fg: "#7C3AED", darkBg: "#1E293B", darkFg: "#A78BFA" },
  { bg: "#FFF4E0", fg: "#D98200", darkBg: "#1E293B", darkFg: "#FBBF24" },
  { bg: "#E8FBFF", fg: "#0E8A9A", darkBg: "#1E293B", darkFg: "#38BDF8" },
  { bg: "#FFE8EC", fg: "#C52B35", darkBg: "#1E293B", darkFg: "#F87171" },
  { bg: "#EEF0FF", fg: "#4F46E5", darkBg: "#1E293B", darkFg: "#818CF8" },
  { bg: "#F0FDF4", fg: "#15803D", darkBg: "#1E293B", darkFg: "#4ADE80" },
  { bg: "#FFF1F2", fg: "#BE123C", darkBg: "#1E293B", darkFg: "#FB7185" },
  { bg: "#F5F3FF", fg: "#6D28D9", darkBg: "#1E293B", darkFg: "#C084FC" },
];

export default function ModuleMenu({
  open,
  onClose,
  nav,
  user,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
  user: SessionUserShape;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const isNative = useIsNativeApp();
  if (!open) return null;

  const roleDisplay = user.role.replace(/_/g, " ");

  return (
    <div className="fixed inset-0 z-[80] flex justify-start">
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 bg-[#0B192C]/60 backdrop-blur-[3px] transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="relative z-[81] flex h-full w-[min(20.5rem,85vw)] flex-col bg-white shadow-2xl animate-slide-in dark:bg-[#0F172A] dark:border-r dark:border-[#1E293B]">
        {/* Menu Header with Modern HRMate Brand Logo */}
        <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3.5 dark:border-[#1E293B] dark:bg-[#0F172A]">
          <Link href="/dashboard" onClick={onClose} className="group flex items-center">
            <HRMateLogo size={36} withText={true} subtitle={roleDisplay} />
          </Link>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] active:scale-95 dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Grid Tiles */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]/50 px-3.5 pb-4 pt-4 dark:bg-[#0B132B]">
          <div className="grid grid-cols-3 gap-2.5">
            {nav.map((item, i) => {
              const c = TILE_COLORS[i % TILE_COLORS.length];
              const active =
                item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={classNames(
                    "module-tile flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-[18px] px-2 py-3 text-center transition-all duration-150 active:scale-95",
                    active
                      ? "bg-white shadow-[0_4px_16px_rgba(30,111,224,0.16)] ring-2 ring-[#1E6FE0] dark:bg-[#1E293B]"
                      : "hover:shadow-sm"
                  )}
                  style={{
                    backgroundColor: active ? undefined : c.bg,
                  }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl transition"
                    style={{ color: c.fg }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[12px] font-bold leading-tight text-[#0F172A] dark:text-white">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Download App Banner (Web browser only, hidden in native app) */}
        {!isNative && (
          <div className="space-y-1.5 px-3.5 pb-2">
            <Link
              href="/download"
              onClick={onClose}
              className="flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-[#1E6FE0] to-[#10B981] p-2.5 px-3 text-[12.5px] font-bold text-white shadow-md transition active:scale-95"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span>Get Android App (APK)</span>
              </div>
              <Download className="h-4 w-4" />
            </Link>

            <a
              href="https://flavorflow.co.in"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-[11.5px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Factory ERP
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">FlavorFlow ↗</span>
            </a>
          </div>
        )}

        {/* Bottom Profile Footer */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-[#E2E8F0] bg-white px-3.5 py-3 dark:border-[#1E293B] dark:bg-[#0F172A]">
          <Avatar
            name={user.name}
            color={user.color}
            size={40}
            src={avatarSrc(user.id, (user as any).avatar)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#0F172A] dark:text-white">{user.name}</p>
            <p className="truncate text-[11px] text-[#64748B] dark:text-[#94A3B8]">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#EF4444] transition hover:bg-rose-50 active:scale-95 dark:hover:bg-rose-950/30"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
