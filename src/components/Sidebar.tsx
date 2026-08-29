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
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={classNames(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
              <Fingerprint className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight text-slate-900">
                HR<span className="text-brand-600">Mate</span>
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Smart HRMS
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={classNames(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <span
                className={classNames(
                  "transition-colors",
                  isActive(item.href) ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                )}
              >
                {item.icon}
              </span>
              {item.label}
              {isActive(item.href) && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <Avatar name={user.name} color={user.color} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.designation || user.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
