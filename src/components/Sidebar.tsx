"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Fingerprint } from "lucide-react";
import { classNames } from "@/lib/utils";
import Avatar from "./Avatar";

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
}

export default function Sidebar({
  user,
  nav,
  open,
  onClose,
}: {
  user: SessionUserShape;
  nav: NavItem[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={classNames(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[#1A3A55] transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "linear-gradient(180deg, #0B2743 0%, #081C31 100%)" }}
      >
        <div className="flex h-[62px] items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flow-gradient flex h-9 w-9 items-center justify-center rounded-[11px] shadow-flow">
              <Fingerprint className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-white">
                HRMate
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7892AA]">
                Smart HRMS
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#7892AA] hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-5 pb-2 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.85px] text-[#7892AA]">
          Modules
        </p>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={classNames(
                  "group relative flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  active
                    ? "bg-[#173D64] text-white shadow-[0_8px_18px_rgba(22,184,120,0.16)]"
                    : "text-[#C6D5E3] hover:bg-white/[0.07]"
                )}
              >
                {active && (
                  <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-flow" />
                )}
                <span className={active ? "text-flow" : "text-[#7892AA] group-hover:text-[#C6D5E3]"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#1A3A55] p-4">
          <div className="flex items-center gap-3 rounded-tile bg-[#071827] p-3">
            <Avatar name={user.name} color={user.color} size={40} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11.5px] text-[#7892AA]">{user.designation || user.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
