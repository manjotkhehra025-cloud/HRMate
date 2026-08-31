"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Fingerprint, ChevronRight } from "lucide-react";
import { classNames } from "@/lib/utils";
import Avatar, { avatarSrc } from "./Avatar";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export interface SessionUserShape {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  department: string;
  designation: string;
  avatar?: string;
}

export default function Sidebar({
  user,
  nav,
  open,
  mobileOpen,
  onClose,
  onDismiss,
}: {
  user: SessionUserShape;
  nav: NavItem[];
  open: boolean;
  mobileOpen?: boolean;
  onClose: () => void;
  onDismiss?: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const photo = avatarSrc(user.id, user.avatar);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#081C33]/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={classNames(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[#153452] transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "pointer-events-none -translate-x-full"
        )}
        style={{
          background: "linear-gradient(180deg, #09213B 0%, #06182B 60%, #041220 100%)",
          boxShadow: "4px 0 24px rgba(4, 18, 32, 0.4)",
        }}
      >
        {/* Brand Header */}
        <div className="flex h-[68px] items-center justify-between border-b border-[#153452]/70 px-5">
          <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onClose}>
            <div className="flow-gradient flex h-10 w-10 items-center justify-center rounded-[12px] shadow-flow transition group-hover:scale-105">
              <Fingerprint className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="block text-[16px] font-bold tracking-tight text-white">
                HRMate
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#78B4FF]">
                Smart HRMS
              </span>
            </div>
          </Link>
          <button
            onClick={onDismiss || onClose}
            className="rounded-lg p-1.5 text-[#7892AA] transition hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modules Label */}
        <div className="px-5 pb-2 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#7892AA]/90">
            Navigation
          </p>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={classNames(
                  "group relative flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-medium transition-all duration-150",
                  active
                    ? "bg-gradient-to-r from-[#174678] to-[#12365D] text-white shadow-[0_4px_16px_rgba(30,111,224,0.25)] ring-1 ring-white/15"
                    : "text-[#C6D5E3] hover:bg-white/[0.07] hover:text-white"
                )}
              >
                {active && (
                  <span className="absolute bottom-2 left-0 top-2 w-[3.5px] rounded-r bg-gradient-to-b from-[#1E6FE0] to-[#16B878]" />
                )}
                <span
                  className={classNames(
                    "flex h-8 w-8 items-center justify-center rounded-[9px] transition-colors",
                    active
                      ? "bg-white/15 text-[#16B878]"
                      : "bg-[#0E2C4B]/60 text-[#7892AA] group-hover:bg-[#153B64] group-hover:text-[#B4D4FF]"
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight className="h-4 w-4 text-white/50" />}
              </Link>
            );
          })}
        </nav>

        {/* User Card at bottom */}
        <div className="border-t border-[#153452] p-3.5">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-[14px] bg-[#07192C]/90 p-3 ring-1 ring-white/5 transition hover:bg-[#0E2C4B] hover:ring-white/10"
          >
            <Avatar name={user.name} color={user.color} size={42} src={photo} className="ring-2 ring-white/20" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold text-white">{user.name}</p>
              <p className="truncate text-[11.5px] text-[#7892AA]">
                {user.designation || user.role.replace("_", " ")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#7892AA]" />
          </Link>
        </div>
      </aside>
    </>
  );
}
