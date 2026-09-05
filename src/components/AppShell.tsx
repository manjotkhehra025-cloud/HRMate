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
  Sparkles,
<<<<<<< HEAD
<<<<<<< HEAD
=======
  Search,
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
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
  const [desktopOpen, setDesktopOpen] = useState(true);
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
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifs(data.notifications || []);
        setUnreadCount(data.unread || 0);
      }
    } catch {
      // ignore
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
<<<<<<< HEAD
<<<<<<< HEAD
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#F4F7FB]">
=======
    <div className="relative flex h-screen min-h-0 min-w-0 flex-col overflow-hidden bg-[#F4F7FB]">
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
    <div className="relative flex h-screen min-h-0 min-w-0 flex-col overflow-hidden bg-[#F4F7FB]">
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
      <IdleGuard />
      
      {/* Desktop Permanent / Expandable Sidebar */}
      <Sidebar
        user={user}
        nav={labeledNav}
        open={desktopOpen}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onDismiss={() => setDesktopOpen((o) => !o)}
      />

      {/* Mobile Drawer / Quick Sheet */}
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

<<<<<<< HEAD
<<<<<<< HEAD
      {/* Modern App Top Bar */}
      <header
        className={classNames(
          "sticky top-0 z-30 flex h-[64px] min-w-0 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white/95 px-3.5 backdrop-blur-md transition-[padding] duration-300 sm:px-6 lg:px-8",
          desktopOpen ? "lg:pl-[304px]" : ""
        )}
      >
        {/* Left: Mobile App Brand / Title */}
        <div className="flex items-center gap-3">
=======
=======
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
      {/* Top Bar (Responsive for Desktop & Mobile) */}
      <header
        className={classNames(
          "sticky top-0 z-30 flex h-[64px] min-w-0 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white/95 px-3.5 backdrop-blur-md transition-[padding] duration-300 sm:px-6 lg:px-8",
          desktopOpen ? "lg:pl-[304px]" : "lg:pl-8"
        )}
      >
<<<<<<< HEAD
        {/* Left: Brand / Title / Search */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setDesktopOpen((o) => !o);
              } else {
                setGridOpen(true);
              }
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] transition active:scale-95 hover:bg-[#F1F5F9]"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>

<<<<<<< HEAD
<<<<<<< HEAD
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2">
=======
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="flex items-center gap-2.5">
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="flex items-center gap-2.5">
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0F172A] via-[#1E3E62] to-[#1E6FE0] text-white shadow-sm">
                <Sparkles className="h-4 w-4 text-[#10B981]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[16px] font-extrabold tracking-tight text-[#0F172A] leading-tight sm:text-[18px]">
                  {currentLabel}
                </h1>
                <p className="hidden text-[11px] font-medium text-[#64748B] sm:block">
<<<<<<< HEAD
<<<<<<< HEAD
                  GD Foods Moga
=======
                  GD Foods Mfg. (I) Pvt. Ltd. · HR Portal
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
                  GD Foods Mfg. (I) Pvt. Ltd.
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
                </p>
              </div>
            </Link>
          </div>
        </div>

<<<<<<< HEAD
<<<<<<< HEAD
        {/* Right: Notification & Profile */}
=======
        {/* Right: Notifications & User Profile */}
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
        {/* Right: Notifications & User Profile */}
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                if (!notifOpen) loadNotifs();
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] transition active:scale-95 hover:bg-[#F1F5F9]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-extrabold text-white ring-2 ring-white animate-bounce">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setNotifOpen(false)} />
                <div className="fixed right-3 top-[68px] z-30 w-[min(24rem,calc(100vw-1.5rem))] animate-slide-in overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl sm:right-6">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-bold text-[#0F172A]">{t("notifications")}</p>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-[#E0F2FE] px-2 py-0.5 text-[11px] font-bold text-[#0284C7]">
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
                  <div className="max-h-96 overflow-y-auto divide-y divide-[#F1F5F9]">
                    {notifs.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-[#94A3B8]">
                        <BellOff className="h-7 w-7 text-[#CBD5E1]" />
                        <p className="text-[13px] font-medium">{t("noNotifications")}</p>
                      </div>
                    ) : (
                      notifs.slice(0, 20).map((n) => (
                        <Link
                          key={n.id}
                          href={n.link || "/dashboard"}
                          onClick={() => setNotifOpen(false)}
                          className={classNames(
                            "block px-4 py-3 transition hover:bg-[#F8FAFC]",
                            !n.read && "bg-[#E0F2FE]/40"
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <span
                              className={classNames(
                                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                n.read ? "bg-[#CBD5E1]" : "bg-[#10B981] ring-4 ring-[#10B981]/20"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-semibold text-[#0F172A]">{n.title}</p>
                              <p className="line-clamp-2 text-[12.5px] text-[#64748B]">{n.body}</p>
                              <p className="mt-1 text-[11px] text-[#94A3B8]">{timeAgo(n.created_at)}</p>
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

          {/* User Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setUserMenu((o) => !o)}
              className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 pr-2 transition active:scale-95 hover:bg-[#F1F5F9]"
              title={t("myProfile")}
            >
              <div className="relative">
                <Avatar name={user.name} color={user.color} size={34} src={photo} />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#10B981] ring-2 ring-white" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-[13px] font-bold leading-tight text-[#0F172A]">{user.name}</p>
                <p className="text-[11px] font-medium text-[#64748B]">
                  {user.designation || user.role.replace("_", " ")}
                </p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-[#94A3B8] sm:block" />
            </button>

            {userMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setUserMenu(false)} />
                <div className="fixed right-3 top-[68px] z-30 w-56 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white py-1.5 shadow-2xl sm:right-6 animate-fade-in">
                  <div className="border-b border-[#F1F5F9] px-3.5 py-2.5">
                    <p className="truncate text-[13px] font-bold text-[#0F172A]">{user.name}</p>
                    <p className="truncate text-[11px] text-[#64748B]">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <User className="h-4 w-4 text-[#1E6FE0]" /> {t("myProfile")}
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <Settings className="h-4 w-4 text-[#1E6FE0]" /> {t("settings")}
                  </Link>
                  <div className="border-t border-[#F1F5F9] my-1" />
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-[#EF4444] hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" /> {t("logout")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

<<<<<<< HEAD
<<<<<<< HEAD
      {/* Main App Scrollable Body */}
      <div
        id="app-body"
        className={classNames(
          "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto transition-[padding] duration-300 pb-24 lg:pb-10",
          desktopOpen ? "lg:pl-72" : ""
=======
      {/* Main Content Area: Responsive Wide on Desktop, Native App Feel on Mobile */}
      <div
        id="app-body"
        className={classNames(
          "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto transition-[padding] duration-300 pb-24 lg:pb-8",
          desktopOpen ? "lg:pl-72" : "lg:pl-0"
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
      {/* Main Content Area: Responsive Wide on Desktop, Native App Feel on Mobile */}
      <div
        id="app-body"
        className={classNames(
          "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto transition-[padding] duration-300 pb-24 lg:pb-8",
          desktopOpen ? "lg:pl-72" : "lg:pl-0"
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
        )}
        style={{
          flex: "1 1 0%",
          minHeight: 0,
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "none",
        }}
      >
<<<<<<< HEAD
<<<<<<< HEAD
        <main className="mx-auto min-w-0 max-w-6xl px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8">
=======
        <main className="mx-auto min-w-0 max-w-7xl px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8">
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
        <main className="mx-auto min-w-0 max-w-7xl px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8">
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
          {children}
        </main>
      </div>

<<<<<<< HEAD
<<<<<<< HEAD
      {/* Modern Fixed Bottom Mobile App Bar */}
      <MobileNav nav={labeledNav} onMore={() => setGridOpen(true)} />
=======
=======
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
      {/* Bottom Navigation for Mobile App View Only (Hidden on Desktop) */}
      <div className="lg:hidden">
        <MobileNav nav={labeledNav} onMore={() => setGridOpen(true)} />
      </div>
<<<<<<< HEAD
>>>>>>> 1de2f41 (fix(app): disable pull-to-refresh spinner on scroll, fix live selfie video preview, and restore full responsive desktop portal)
=======
>>>>>>> 0e35bc9 (fix(punch): dedicated single-step selfie camera punch, remove blinking/play overlay, fix dynamic factory address)
    </div>
  );
}
