"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Fingerprint,
  Users,
  Grid,
} from "lucide-react";
import { classNames } from "@/lib/utils";
import type { NavItem } from "./Sidebar";

export default function MobileNav({
  nav,
  onMore,
}: {
  nav: NavItem[];
  onMore: () => void;
}) {
  const pathname = usePathname();

  const isHome = pathname === "/dashboard" || pathname === "/";
  const isLeaves = pathname.startsWith("/leaves");
  const isAttendance = pathname.startsWith("/attendance");
  const isTeam = pathname.startsWith("/team");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E2E8F0] bg-white/95 px-3 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-lg lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between">
        {/* Home Tab */}
        <Link
          href="/dashboard"
          className={classNames(
            "flex flex-1 flex-col items-center justify-center py-1 transition-all",
            isHome ? "text-[#1E6FE0] font-bold" : "text-[#64748B] hover:text-[#0F172A]"
          )}
        >
          <div
            className={classNames(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
              isHome ? "bg-[#1E6FE0]/10 text-[#1E6FE0]" : ""
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span className="mt-1 text-[11px] tracking-tight">Home</span>
        </Link>

        {/* Leaves Tab */}
        <Link
          href="/leaves"
          className={classNames(
            "flex flex-1 flex-col items-center justify-center py-1 transition-all",
            isLeaves ? "text-[#16B878] font-bold" : "text-[#64748B] hover:text-[#0F172A]"
          )}
        >
          <div
            className={classNames(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
              isLeaves ? "bg-[#16B878]/10 text-[#16B878]" : ""
            )}
          >
            <CalendarDays className="h-5 w-5" />
          </div>
          <span className="mt-1 text-[11px] tracking-tight">Leaves</span>
        </Link>

        {/* Big Center Punch Button (Hero Action) */}
        <div className="flex -translate-y-4 flex-col items-center px-1">
          <Link
            href="/attendance"
            className={classNames(
              "group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#059669] via-[#10B981] to-[#34D399] text-white shadow-[0_8px_20px_rgba(16,185,129,0.4)] ring-4 ring-white transition-all active:scale-95",
              isAttendance && "ring-[#10B981]/30"
            )}
          >
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-30 blur-sm animate-pulse" />
            <Fingerprint className="relative h-7 w-7 text-white transition-transform group-hover:scale-110" />
          </Link>
          <span className="mt-1 text-[10.5px] font-bold text-[#059669]">Punch</span>
        </div>

        {/* Team Tab */}
        <Link
          href="/team"
          className={classNames(
            "flex flex-1 flex-col items-center justify-center py-1 transition-all",
            isTeam ? "text-[#1E6FE0] font-bold" : "text-[#64748B] hover:text-[#0F172A]"
          )}
        >
          <div
            className={classNames(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
              isTeam ? "bg-[#1E6FE0]/10 text-[#1E6FE0]" : ""
            )}
          >
            <Users className="h-5 w-5" />
          </div>
          <span className="mt-1 text-[11px] tracking-tight">Team</span>
        </Link>

        {/* More / Menu Drawer Tab */}
        <button
          type="button"
          onClick={onMore}
          aria-label="More options"
          className="flex flex-1 flex-col items-center justify-center py-1 text-[#64748B] transition-all hover:text-[#0F172A]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl">
            <Grid className="h-5 w-5" />
          </div>
          <span className="mt-1 text-[11px] tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
