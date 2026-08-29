"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { classNames } from "@/lib/utils";
import type { NavItem } from "./Sidebar";

const PRIMARY = ["/dashboard", "/attendance", "/leaves", "/wall"];

export default function MobileNav({
  nav,
  onMore,
}: {
  nav: NavItem[];
  onMore: () => void;
}) {
  const pathname = usePathname();
  const tabs = nav.filter((n) => PRIMARY.includes(n.href));
  const cols = Math.max(2, tabs.length + 1);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const shortLabel = (label: string) =>
    label === "Social Wall" ? "Wall" : label === "Dashboard" ? "Home" : label;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/92 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-10px_40px_-16px_rgb(15_23_42/0.18)] backdrop-blur-xl lg:hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {tabs.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition",
                active ? "text-brand-700" : "text-slate-400"
              )}
            >
              <span
                className={classNames(
                  "rounded-2xl p-1.5 transition",
                  active ? "bg-brand-50 text-brand-600 shadow-sm" : "text-slate-400"
                )}
              >
                {item.icon}
              </span>
              {shortLabel(item.label)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide text-slate-400"
        >
          <span className="rounded-2xl p-1.5">
            <MoreHorizontal className="h-5 w-5" />
          </span>
          More
        </button>
      </div>
    </nav>
  );
}
