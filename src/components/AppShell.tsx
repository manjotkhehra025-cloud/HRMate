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
  User,
  BarChart3,
  ChevronDown,
} from "lucide-react";
import Sidebar, { NavItem, SessionUserShape } from "./Sidebar";
import MobileNav from "./MobileNav";
import Avatar, { avatarSrc } from "./Avatar";
import ModuleMenu from "./ModuleMenu";
import { timeAgo } from "@/lib/utils";
import { classNames } from "@/lib/utils";
import { usePrefs } from "./PrefsProvider";
import IdleGuard from "./IdleGuard";
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
  user: SessionUserShape & { avatar?: string };
  permissions: string[];
  unread: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
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

  const has = (p: string) =>
    permissions.includes("*") || permissions.includes(p) || user.role === "super_admin";

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
    ...(has("reports.view")
      ? [{ href: "/reports", label: "Reports", icon: <BarChart3 className="h-5 w-5" /> }]
      : []),
    ...(has("approvals.view")
      ? [{ href: "/approvals", label: "Approvals", icon: <CheckSquare className="h-5 w-5" /> }]
      : []),
    ...(has("admin.view")
      ? [{ href: "/admin", label: "Users", icon: <ShieldCheck className="h-5 w-5" /> }]
      : []),
    { href: "/settings", label: t("settings"), icon: <Settings className="h-5 w-5" /> },
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
    )?.label ?? (pathname.startsWith("/profile") ? t("myProfile") : "HRMate");

  const photo = avatarSrc(user.id, user.avatar);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#F4F7FB]">
      <IdleGuard />
      <Sidebar
        user={user}
        nav={labeledNav}
        open={desktopOpen}
        mobileOpen={false}
        onClose={() => setMobileOpen(false)}
        onDismiss={() => setDesktopOpen(false)}
      />

      <ModuleMenu
        open={gridOpen || mobileOpen}
        onClose={() => {
          setGridOpen(false);
          setMobileOpen(false);
        }}
        nav={labeledNav}
        user={user}
        onLogout={logout}
      />

      {/* Modern Top Header */}
      <header
        className={classNames(
          "sticky top-0 z-20 flex h-[68px] min-w-0 shrink-0 items-center justify-between border-b border-[#E3EAF1] bg-white/95 px-4 backdrop-blur-md transition-[padding] duration-300 sm:px-6 lg:px-8",
          desktopOpen ? "lg:pl-[304px]" : ""
        )}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setDesktopOpen((o) => !o);
              } else {
                setGridOpen(true);
              }
            }}
            className="rounded-[12px] border border-[#E3EAF1] p-2 text-[#617083] transition hover:bg-[#F4F7FB] hover:text-[#172334]"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold tracking-tight text-[#172334]">
              {currentLabel}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                if (!notifOpen) loadNotifs();
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#E3EAF1] bg-white text-[#617083] transition hover:bg-[#F4F7FB] hover:text-[#172334]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E11D48] px-1 text-[10.5px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />
                <div className="fixed right-3 top-[68px] z-30 w-[min(24rem,calc(100vw-1.5rem))] animate-slide-in overflow-hidden rounded-[18px] border border-[#E3EAF1] bg-white shadow-pop sm:right-6">
                  <div className="flex items-center justify-between border-b border-[#F0F4F8] bg-[#F8FAFD] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-[#172334]">{t("notifications")}</p>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-[#E7F1FF] px-2 py-0.5 text-[11px] font-bold text-[#1E6FE0]">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[12px] font-semibold text-[#1E6FE0] hover:underline"
                      >
                        {t("markAllRead")}
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-[#F0F4F8]">
                    {notifs.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-[#8A97A8]">
                        <BellOff className="h-7 w-7 text-[#C5D0DC]" />
                        <p className="text-[13px] font-medium">{t("noNotifications")}</p>
                      </div>
                    ) : (
                      notifs.slice(0, 20).map((n) => (
                        <Link
                          key={n.id}
                          href={n.link || "/dashboard"}
                          onClick={() => setNotifOpen(false)}
                          className={classNames(
                            "block px-4 py-3 transition hover:bg-[#F8FAFD]",
                            !n.read && "bg-[#E7F1FF]/30"
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={classNames(
                                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                n.read ? "bg-[#C5D0DC]" : "bg-[#1E6FE0] ring-4 ring-[#1E6FE0]/20"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-semibold text-[#172334]">{n.title}</p>
                              <p className="line-clamp-2 text-[12.5px] text-[#617083]">{n.body}</p>
                              <p className="mt-1 text-[11px] text-[#8A97A8]">{timeAgo(n.created_at)}</p>
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

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenu((o) => !o)}
              className="flex items-center gap-2.5 rounded-[14px] border border-[#E3EAF1] bg-white p-1.5 pr-3 transition hover:bg-[#F4F7FB] hover:border-[#CBD6E2]"
              title={t("myProfile")}
            >
              <Avatar name={user.name} color={user.color} size={34} src={photo} />
              <div className="hidden text-left sm:block">
                <p className="text-[13px] font-bold leading-tight text-[#172334]">{user.name}</p>
                <p className="text-[11px] font-medium text-[#8A97A8]">
                  {user.designation || user.role.replace("_", " ")}
                </p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-[#8A97A8] sm:block" />
            </button>

            {userMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setUserMenu(false)} />
                <div className="fixed right-3 top-[68px] z-30 w-56 overflow-hidden rounded-[18px] border border-[#E3EAF1] bg-white py-1.5 shadow-pop sm:right-6 animate-fade-in">
                  <div className="border-b border-[#F0F4F8] px-3.5 py-2.5">
                    <p className="truncate text-[13px] font-bold text-[#172334]">{user.name}</p>
                    <p className="truncate text-[11px] text-[#8A97A8]">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-medium text-[#172334] hover:bg-[#F8FAFD]"
                  >
                    <User className="h-4 w-4 text-[#1E6FE0]" /> {t("myProfile")}
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-medium text-[#172334] hover:bg-[#F8FAFD]"
                  >
                    <Settings className="h-4 w-4 text-[#1E6FE0]" /> {t("settings")}
                  </Link>
                  <div className="border-t border-[#F0F4F8] my-1" />
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-[#C52B35] hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" /> {t("logout")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div
        id="app-body"
        className={classNames(
          "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto transition-[padding] duration-300",
          desktopOpen ? "lg:pl-72" : ""
        )}
        style={{
          flex: "1 1 0%",
          minHeight: 0,
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          overscrollBehaviorX: "none",
        }}
      >
        <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>

      <MobileNav nav={labeledNav} onMore={() => setGridOpen(true)} />
    </div>
  );
}
