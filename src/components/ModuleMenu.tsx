"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut } from "lucide-react";
import Avatar, { avatarSrc } from "./Avatar";
import type { NavItem, SessionUserShape } from "./Sidebar";
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

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <div className="flow-gradient flex h-11 w-11 items-center justify-center rounded-[14px] text-lg font-bold text-white shadow-flow">
            H
          </div>
          <div>
            <p className="text-[17px] font-bold text-ink">HRMate</p>
            <p className="text-[12px] capitalize text-muted">{user.role.replace("_", " ")}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-muted hover:bg-[#F3F7FB]"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
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
                  "flex aspect-square flex-col items-center justify-center gap-2 rounded-[18px] px-2 text-center",
                  active ? "ring-2 ring-brand-500/40" : ""
                )}
                style={{ background: c.bg }}
              >
                <span style={{ color: c.fg }}>{item.icon}</span>
                <span className="text-[12px] font-semibold leading-tight text-ink">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-line px-5 py-3">
        <Avatar
          name={user.name}
          color={user.color}
          size={44}
          src={avatarSrc(user.id, (user as any).avatar)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-xl p-2.5 text-[#C52B35] hover:bg-rose-50"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
