"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
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
  const left = nav.filter((n) => n.href === "/dashboard" || n.href === "/attendance");
  const right = nav.filter((n) => n.href === "/leaves" || n.href === "/wall").slice(0, 2);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const shortLabel = (label: string) =>
    label === "Social Wall" ? "Wall" : label === "Dashboard" ? "Home" : label;

  const Tab = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        className={classNames(
          "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold",
          active ? "text-brand-500" : "text-muted"
        )}
      >
        <span className={active ? "text-brand-500" : "text-muted"}>{item.icon}</span>
        {shortLabel(item.label)}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 h-[66px] border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden">
      <div className="flex h-full items-center px-1">
        {left.map((item) => (
          <Tab key={item.href} item={item} />
        ))}

        <button
          type="button"
          onClick={onMore}
          aria-label="Open modules"
          className="mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-flow flow-gradient"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>

        {right.map((item) => (
          <Tab key={item.href} item={item} />
        ))}
      </div>
    </nav>
  );
}
