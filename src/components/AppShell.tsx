"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  CalendarDays,
  Users,
  MessageSquare,
  Bell,
  Settings,
  ShieldCheck,
  CheckSquare,
  Menu,
  LogOut,
  BellOff,
} from "lucide-react";
import Sidebar, { NavItem, SessionUserShape } from "./Sidebar";
import MobileNav from "./MobileNav";
import Avatar from "./Avatar";
import { timeAgo } from "@/lib/utils";
import { classNames } from "@/lib/utils";
import { usePrefs } from "./PrefsProvider";
import { navLabel } from "@/lib/i18n";

interface Notif {
  id: string;
  title: string;
  body: string;
  type: string;
  read: number;
  link: string;
  created_at: number;
}

export default function AppShell({
  user,
  permissions,
  unread,
  children,
}: {
  user: SessionUserShape;
  permissions: string[];
  unread: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(unread);
  const router = useRouter();
  const pathname = usePathname();
  const { t, prefs } = usePrefs();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setDesktopOpen(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDesktopOpen(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const has = (p: string) => permissions.includes(p) || user.role === "super_admin";

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    ...(has("attendance.view") || has("attendance.punch")
      ? [{ href: "/attendance", label: "Attendance", icon: <MapPin className="h-5 w-5" /> }]
      : []),
    ...(has("leaves.view") || has("leaves.apply")
      ? [{ href: "/leaves", label: "Leaves", icon: <CalendarDays className="h-5 w-5" /> }]
      : []),
    ...(has("wall.view")
      ? [{ href: "/wall", label: "Social Wall", icon: <MessageSquare className="h-5 w-5" /> }]
      : []),
    ...(has("attendance.team") || has("leaves.team")
      ? [{ href: "/team", label: "Team", icon: <Users className="h-5 w-5" /> }]
      : []),
    ...(has("approvals.view")
      ? [{ href: "/approvals", label: "Approvals", icon: <CheckSquare className="h-5 w-5" /> }]
      : []),
    ...(has("admin.view")
      ? [{ href: "/admin", label: "Admin", icon: <ShieldCheck className="h-5 w-5" /> }]
      : []),
    { href: "/profile", label: t("settings"), icon: <Settings className="h-5 w-5" /> },
  ];

  const labeledNav = nav.map((n) => ({
    ...n,
    label: navLabel(prefs.language, n.href, n.label),
  }));

  async function loadNotifs() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifs(data.notifications);
      setUnreadCount(data.unread);
    }
  }

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" });
    setNotifs((n) => n.map((x) => ({ ...x, read: 1 })));
    setUnreadCount(0);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const currentLabel =
    labeledNav.find((n) =>
      n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href)
    )?.label ?? "HRMate";

  function toggleMenu() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDesktopOpen((o) => !o);
    } else {
      setMobileOpen((o) => !o);
    }
  }

  return (
    <div className="min-h-[100dvh]">
      <Sidebar
        user={user}
        nav={labeledNav}
        open={mobileOpen || desktopOpen}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onDismiss={() => {
          setMobileOpen(false);
          setDesktopOpen(false);
        }}
      />

      <div className={desktopOpen ? "lg:pl-72" : ""}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-[62px] items-center gap-3 border-b border-line bg-white px-4 pt-[env(safe-area-inset-top)] sm:px-6">
          <button
            onClick={toggleMenu}
            className="rounded-btn p-2 text-muted hover:bg-[#F3F7FB]"
            aria-label="Open menu"
          >
            <Menu className="h-[22px] w-[22px]" />
          </button>

          <p className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">
            {currentLabel}
          </p>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                if (!notifOpen) loadNotifs();
              }}
              className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-1.5rem))] animate-slide-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{t("notifications")}</p>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        {t("markAllRead")}
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                        <BellOff className="h-6 w-6" />
                        <p className="text-sm">{t("noNotifications")}</p>
                      </div>
                    ) : (
                      notifs.slice(0, 20).map((n) => (
                        <Link
                          key={n.id}
                          href={n.link || "/dashboard"}
                          onClick={() => setNotifOpen(false)}
                          className={classNames(
                            "block border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50",
                            !n.read && "bg-brand-50/40"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={classNames(
                                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                n.read ? "bg-slate-200" : "bg-brand-500"
                              )}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">{n.title}</p>
                              <p className="truncate text-xs text-slate-500">{n.body}</p>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {timeAgo(n.created_at)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <Link
            href="/profile"
            title={t("profileSettings")}
            className="flex items-center gap-2 rounded-xl border-l border-slate-200 py-1 pl-3 pr-1 transition hover:bg-[#F3F7FB]"
          >
            <Avatar name={user.name} color={user.color} size={36} />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role.replace("_", " ")}</p>
            </div>
          </Link>

          <button
            onClick={logout}
            title={t("logout")}
            className="rounded-xl p-2.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNav nav={labeledNav} onMore={() => setMobileOpen(true)} />
    </div>
  );
}
