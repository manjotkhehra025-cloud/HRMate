"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut } from "lucide-react";
import Avatar, { avatarSrc } from "./Avatar";
import type { NavItem, SessionUserShape } from "./Sidebar";
import HRMateLogo from "./HRMateLogo";
import { classNames } from "@/lib/utils";

const TILE_COLORS = [
  { bg: "#E8F1FF", fg: "#1E6FE0" },
  { bg: "#E6F8EF", fg: "#07945D" },
  { bg: "#F3E9FF", fg: "#7C3AED" },
  { bg: "#FFF4E0", fg: "#D98200" },
  { bg: "#E8FBFF", fg: "#0E8A9A" },
  { bg: "#FFE8EC", fg: "#C52B35" },
  { bg: "#EEF0FF", fg: "#4F46E5" },
  { bg: "#F0FDF4", fg: "#15803D" },
  { bg: "#FFF1F2", fg: "#BE123C" },
  { bg: "#F5F3FF", fg: "#6D28D9" },
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
  if (!open) return null;

  const roleDisplay = user.role.replace(/_/g, " ");

  return (
    <div className="fixed inset-0 z-[80] flex justify-start">
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 bg-[#0B192C]/50 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="relative z-[81] flex h-full w-[min(20.5rem,85vw)] flex-col bg-white shadow-2xl animate-slide-in">
        {/* Menu Header with Modern HRMate Brand Logo */}
        <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3.5">
          <Link href="/dashboard" onClick={onClose} className="group flex items-center">
            <HRMateLogo size={36} withText={true} subtitle={roleDisplay} />
          </Link>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] active:scale-95"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Grid Tiles */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]/50 px-3.5 pb-4 pt-4">
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
                    "flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-[18px] px-2 py-3 text-center transition-all duration-150 active:scale-95",
                    active
                      ? "bg-white shadow-[0_4px_16px_rgba(30,111,224,0.16)] ring-2 ring-[#1E6FE0]"
                      : "hover:shadow-sm"
                  )}
                  style={{ background: active ? "#FFFFFF" : c.bg }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl transition"
                    style={{ color: c.fg }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[12px] font-bold leading-tight text-[#0F172A]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Profile Footer */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-[#E2E8F0] bg-white px-3.5 py-3">
          <Avatar
            name={user.name}
            color={user.color}
            size={40}
            src={avatarSrc(user.id, (user as any).avatar)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#0F172A]">{user.name}</p>
            <p className="truncate text-[11px] text-[#64748B]">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#EF4444] transition hover:bg-rose-50 active:scale-95"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
