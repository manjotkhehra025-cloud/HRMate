"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  Sparkles,
  Cake,
  Gift,
  Download,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Heart,
  Send,
  Grid,
  List,
} from "lucide-react";
import { usePrefs } from "@/components/PrefsProvider";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";
import type { UnifiedCalendarEvent } from "@/app/api/calendar/route";
import type { BirthdayUser } from "@/lib/birthdays";

interface CalendarClientProps {
  canManage?: boolean;
  currentUserId?: string;
}

export default function CalendarClient({ canManage = false, currentUserId }: CalendarClientProps) {
  const { t } = usePrefs();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [todayBirthdays, setTodayBirthdays] = useState<BirthdayUser[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<"all" | "holiday_off" | "festival_working" | "birthday">("all");
  const [search, setSearch] = useState("");
  const [selectedDayEvents, setSelectedDayEvents] = useState<UnifiedCalendarEvent[] | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");

  // Birthday Greeting Wish State
  const [wishingId, setWishingId] = useState<string | null>(null);
  const [wishedSet, setWishedSet] = useState<Set<string>>(new Set());

  // Add / Edit Holiday State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UnifiedCalendarEvent | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formType, setFormType] = useState("public_holiday");
  const [formIsOff, setFormIsOff] = useState(true);
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("#1E6FE0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/calendar?year=${currentYear}&month=${currentMonth}`);
      const data = await res.json();
      if (data.ok) {
        setEvents(data.events || []);
        setTodayBirthdays(data.todayBirthdays || []);
        setUpcomingBirthdays(data.upcomingBirthdays || []);
      }
    } catch (err) {
      console.error("Failed to load calendar", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDayEvents(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDayEvents(null);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
    setSelectedDayEvents(null);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonthName = monthNames[currentMonth - 1];

  // Send 1-Tap Birthday Wish
  const sendWish = async (targetUserId: string, name: string) => {
    try {
      setWishingId(targetUserId);
      const res = await fetch("/api/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          message: `🎉 Wishing you a wonderful and blessed Birthday, ${name}! 🎂 Best wishes from all of us at GD Foods!`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWishedSet((prev) => new Set([...Array.from(prev), targetUserId]));
      }
    } catch (e) {
      console.error("Wish error", e);
    } finally {
      setWishingId(null);
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterType !== "all" && ev.category !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ev.title.toLowerCase().includes(q) ||
          (ev.description || "").toLowerCase().includes(q) ||
          ev.date.includes(q)
        );
      }
      return true;
    });
  }, [events, filterType, search]);

  // Calendar Grid Days Generation
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sunday

  const calendarGrid = useMemo(() => {
    const grid: {
      dayNumber: number;
      dateStr: string;
      isToday: boolean;
      events: UnifiedCalendarEvent[];
    }[] = [];

    const todayStr = new Date().toISOString().split("T")[0];

    for (let day = 1; day <= daysInMonth; day++) {
      const padM = String(currentMonth).padStart(2, "0");
      const padD = String(day).padStart(2, "0");
      const dateStr = `${currentYear}-${padM}-${padD}`;
      const dayEvents = events.filter((e) => e.date === dateStr);

      grid.push({
        dayNumber: day,
        dateStr,
        isToday: dateStr === todayStr,
        events: dayEvents,
      });
    }
    return grid;
  }, [currentYear, currentMonth, daysInMonth, events]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormDate(`${currentYear}-${String(currentMonth).padStart(2, "0")}-01`);
    setFormType("public_holiday");
    setFormIsOff(true);
    setFormDesc("");
    setFormColor("#1E6FE0");
    setError("");
    setModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) {
      setError("Title and Date are required");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const method = editingItem ? "PUT" : "POST";
      const body = {
        id: editingItem?.id,
        title: formTitle.trim(),
        date: formDate,
        type: formType,
        is_off: formIsOff ? 1 : 0,
        description: formDesc.trim(),
        color: formColor,
      };

      const res = await fetch("/api/holidays", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setModalOpen(false);
        loadCalendarData();
      } else {
        setError(data.error || "Failed to save holiday");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string, title: string) => {
    if (!confirm(`Delete holiday "${title}"?`)) return;
    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        loadCalendarData();
        setSelectedDayEvents(null);
      }
    } catch (e) {
      alert("Failed to delete holiday");
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. HERO BIRTHDAY CELEBRATION BANNER (If today is any employee's birthday) */}
      {todayBirthdays.length > 0 && (
        <div className="relative overflow-hidden rounded-3xl border border-pink-200 bg-gradient-to-r from-[#1A0B2E] via-[#2D124D] to-[#0F172A] p-5 sm:p-6 text-white shadow-2xl">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 rounded-full bg-pink-500/20 px-3 py-1 text-[12px] font-black text-pink-300 ring-1 ring-pink-500/40">
                <Cake className="h-4 w-4 text-pink-400 animate-bounce" />
                TODAY'S BIRTHDAY CELEBRATION 🎉
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
              {todayBirthdays.map((b) => {
                const alreadyWished = wishedSet.has(b.id);
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <Avatar
                          name={b.name}
                          color={b.color}
                          size={46}
                          src={avatarSrc(b.id, b.avatar)}
                          className="ring-2 ring-pink-400"
                        />
                        <span className="absolute -top-1 -right-1 text-sm">👑</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-black text-white">{b.name}</p>
                        <p className="truncate text-[11.5px] text-pink-200 font-medium">
                          {b.department} · {b.designation}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={alreadyWished || wishingId === b.id}
                      onClick={() => sendWish(b.id, b.name)}
                      className={classNames(
                        "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-black transition active:scale-95 shrink-0",
                        alreadyWished
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg hover:brightness-110"
                      )}
                    >
                      {wishingId === b.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : alreadyWished ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Wished!
                        </>
                      ) : (
                        <>
                          <Heart className="h-3.5 w-3.5 fill-current" /> Wish 🎉
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. UPCOMING BIRTHDAYS ROW (Next 30 Days) */}
      {upcomingBirthdays.length > 0 && (
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              <h3 className="text-[15px] font-black text-[#0F172A] dark:text-white">
                Upcoming Birthdays (Next 30 Days)
              </h3>
            </div>
            <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-[11px] font-bold text-pink-700 dark:bg-pink-950/40 dark:text-pink-300">
              {upcomingBirthdays.length} upcoming
            </span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {upcomingBirthdays.map((u) => (
              <div
                key={u.id}
                className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 pr-4 shadow-sm dark:border-[#1E293B] dark:bg-[#0B132B]"
              >
                <Avatar
                  name={u.name}
                  color={u.color}
                  size={36}
                  src={avatarSrc(u.id, u.avatar)}
                  className="ring-1 ring-pink-300"
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[#0F172A] dark:text-white">{u.name}</p>
                  <p className="text-[11px] font-semibold text-pink-600 dark:text-pink-400">
                    {u.formatted_dob} ({u.days_left === 1 ? "Tomorrow" : `In ${u.days_left}d`})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CALENDAR CONTROLS & NAVIGATION BAR */}
      <div className="flex flex-col gap-4 rounded-3xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
        {/* Month Navigator Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#1E6FE0] dark:bg-blue-950/40 dark:text-[#38BDF8]">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[20px] sm:text-[24px] font-black text-[#0F172A] dark:text-white leading-tight">
                {currentMonthName} {currentYear}
              </h1>
              <p className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                Factory Holidays, Cultural Festivals & Employee Celebrations
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Prev / Today / Next Buttons */}
            <div className="flex items-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-[#334155] dark:bg-[#0B132B]">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748B] hover:bg-white hover:text-[#0F172A] active:scale-95 dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1 text-[12px] font-bold text-[#0F172A] hover:bg-white rounded-xl dark:text-white dark:hover:bg-[#1E293B]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748B] hover:bg-white hover:text-[#0F172A] active:scale-95 dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* View Mode Toggle (Grid vs List) */}
            <div className="flex items-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 dark:border-[#334155] dark:bg-[#0B132B]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={classNames(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition",
                  viewMode === "grid"
                    ? "bg-[#1E6FE0] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]"
                )}
                title="Grid View"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={classNames(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition",
                  viewMode === "list"
                    ? "bg-[#1E6FE0] text-white shadow-sm"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]"
                )}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Sync All to Phone Button */}
            <a
              href="/api/holidays/ical"
              download="hrmate-calendar.ics"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              title="Download iCal file to sync with Google / iPhone Calendar"
            >
              <Download className="h-4 w-4" />
              Sync Phone
            </a>

            {/* Super Admin Add Button */}
            {canManage && (
              <button
                type="button"
                onClick={openAddModal}
                className="flex items-center gap-1.5 rounded-2xl bg-[#1E6FE0] px-3.5 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-[#1556B8] active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Add Event
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-col gap-3 pt-3 border-t border-[#F1F5F9] sm:flex-row sm:items-center sm:justify-between dark:border-[#1E293B]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={classNames(
                "rounded-xl px-3 py-1.5 text-[12px] font-bold transition",
                filterType === "all"
                  ? "bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-[#0F172A]"
                  : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#94A3B8]"
              )}
            >
              All Events ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("holiday_off")}
              className={classNames(
                "rounded-xl px-3 py-1.5 text-[12px] font-bold transition",
                filterType === "holiday_off"
                  ? "bg-[#EF4444] text-white shadow-sm"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
              )}
            >
              🏖️ Paid Off
            </button>
            <button
              type="button"
              onClick={() => setFilterType("festival_working")}
              className={classNames(
                "rounded-xl px-3 py-1.5 text-[12px] font-bold transition",
                filterType === "festival_working"
                  ? "bg-[#10B981] text-white shadow-sm"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
              )}
            >
              🎉 Festivals
            </button>
            <button
              type="button"
              onClick={() => setFilterType("birthday")}
              className={classNames(
                "rounded-xl px-3 py-1.5 text-[12px] font-bold transition",
                filterType === "birthday"
                  ? "bg-pink-500 text-white shadow-sm"
                  : "bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-950/40 dark:text-pink-300"
              )}
            >
              🎂 Birthdays
            </button>
          </div>

          <div className="relative sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event or name..."
              className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] pl-9 pr-3 text-[12px] text-[#0F172A] outline-none transition focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* 4. MAIN CALENDAR DISPLAY (Grid or List View) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner className="h-8 w-8 text-[#1E6FE0]" />
          <p className="mt-2 text-[13px] font-medium text-[#64748B]">Loading calendar events...</p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-3 sm:p-5 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pb-2 border-b border-[#F1F5F9] dark:border-[#1E293B]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
              <span
                key={day}
                className={classNames(
                  "text-[12px] font-black uppercase tracking-wider py-1",
                  i === 0 ? "text-rose-500" : "text-[#64748B] dark:text-[#94A3B8]"
                )}
              >
                {day}
              </span>
            ))}
          </div>

          {/* Date Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-2">
            {/* Empty slots for first day offset */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[64px] sm:min-h-[96px] rounded-2xl bg-transparent" />
            ))}

            {/* Active Month Days */}
            {calendarGrid.map((cell) => {
              const hasEvents = cell.events.length > 0;
              const hasOff = cell.events.some((e) => e.category === "holiday_off");
              const hasFestival = cell.events.some((e) => e.category === "festival_working");
              const hasBday = cell.events.some((e) => e.category === "birthday");
              const isSelected = selectedDateStr === cell.dateStr;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDateStr(cell.dateStr);
                    setSelectedDayEvents(cell.events);
                  }}
                  className={classNames(
                    "group relative flex min-h-[64px] sm:min-h-[96px] flex-col justify-between rounded-2xl p-1.5 sm:p-2 text-left transition-all duration-150 active:scale-95",
                    isSelected
                      ? "border-2 border-[#1E6FE0] bg-blue-50/80 shadow-md dark:bg-blue-950/40"
                      : cell.isToday
                      ? "border-2 border-emerald-500 bg-emerald-50/50 shadow-sm dark:bg-emerald-950/30"
                      : hasOff
                      ? "border border-rose-200 bg-rose-50/40 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/20"
                      : hasBday
                      ? "border border-pink-200 bg-pink-50/40 hover:border-pink-300 dark:border-pink-900/40 dark:bg-pink-950/20"
                      : "border border-[#F1F5F9] bg-[#F8FAFC]/70 hover:bg-[#F1F5F9] dark:border-[#1E293B] dark:bg-[#0B132B]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={classNames(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-black",
                        cell.isToday
                          ? "bg-emerald-600 text-white"
                          : isSelected
                          ? "bg-[#1E6FE0] text-white"
                          : "text-[#0F172A] dark:text-white"
                      )}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Small visual dots for event types */}
                    <div className="flex items-center gap-0.5">
                      {hasOff && <span className="h-2 w-2 rounded-full bg-rose-500 shadow-sm" />}
                      {hasFestival && <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm" />}
                      {hasBday && <span className="h-2 w-2 rounded-full bg-pink-500 shadow-sm" />}
                    </div>
                  </div>

                  {/* Desktop Preview of Events */}
                  <div className="hidden sm:flex flex-col gap-1 mt-1 overflow-hidden">
                    {cell.events.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        className={classNames(
                          "truncate rounded-lg px-1.5 py-0.5 text-[10.5px] font-bold leading-tight",
                          ev.category === "holiday_off"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200"
                            : ev.category === "birthday"
                            ? "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                        )}
                      >
                        {ev.title}
                      </span>
                    ))}
                    {cell.events.length > 2 && (
                      <span className="text-[9.5px] font-bold text-[#64748B] pl-1">
                        +{cell.events.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Date Details Inspector Panel */}
          {selectedDateStr && (
            <div className="mt-5 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 shadow-sm animate-fade-in dark:border-[#334155] dark:bg-[#0B132B]">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 dark:border-[#1E293B]">
                <h4 className="text-[14px] font-black text-[#0F172A] dark:text-white">
                  Events on {formatDate(selectedDateStr)}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateStr("");
                    setSelectedDayEvents(null);
                  }}
                  className="text-[12px] font-bold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]"
                >
                  Close
                </button>
              </div>

              {(!selectedDayEvents || selectedDayEvents.length === 0) ? (
                <p className="mt-3 text-[13px] text-[#64748B]">No special events scheduled for this day (Regular Working Day).</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={classNames(
                              "rounded-full px-2 py-0.5 text-[10.5px] font-extrabold",
                              ev.category === "holiday_off"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : ev.category === "birthday"
                                ? "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            )}
                          >
                            {ev.category === "holiday_off"
                              ? "🏖️ Factory Off"
                              : ev.category === "birthday"
                              ? "🎂 Birthday"
                              : "🎉 Festival"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[14px] font-black text-[#0F172A] dark:text-white">{ev.title}</p>
                        {ev.description && <p className="text-[12px] text-[#64748B] mt-0.5">{ev.description}</p>}
                      </div>

                      {canManage && ev.category !== "birthday" && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteHoliday(ev.id, ev.title)}
                            className="p-1 text-[#EF4444] hover:bg-rose-50 rounded-lg dark:hover:bg-rose-950/40"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* LIST / TIMELINE VIEW */
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="rounded-3xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
              <CalendarIcon className="mx-auto h-12 w-12 text-[#94A3B8]" />
              <p className="mt-3 text-[15px] font-bold text-[#0F172A] dark:text-white">No events match your criteria</p>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const dayNum = ev.date.split("-")[2];
              const monthShort = new Date(ev.date + "T00:00:00").toLocaleString("en-US", { month: "short" });

              return (
                <div
                  key={ev.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition hover:shadow-md dark:border-[#1E293B] dark:bg-[#0F172A]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={classNames(
                        "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-black text-white shadow-sm",
                        ev.category === "holiday_off"
                          ? "bg-gradient-to-b from-rose-500 to-rose-600"
                          : ev.category === "birthday"
                          ? "bg-gradient-to-b from-pink-500 to-rose-500"
                          : "bg-gradient-to-b from-emerald-500 to-emerald-600"
                      )}
                    >
                      <span className="text-[10px] uppercase leading-none">{monthShort}</span>
                      <span className="text-[18px] leading-tight">{dayNum}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={classNames(
                            "rounded-full px-2 py-0.5 text-[10.5px] font-extrabold",
                            ev.category === "holiday_off"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : ev.category === "birthday"
                              ? "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          )}
                        >
                          {ev.category === "holiday_off"
                            ? "🏖️ Factory Off"
                            : ev.category === "birthday"
                            ? "🎂 Birthday"
                            : "🎉 Festival"}
                        </span>
                        <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                          {ev.is_today ? "Today 🎉" : ev.days_left === 1 ? "Tomorrow" : ev.days_left > 1 ? `In ${ev.days_left}d` : "Passed"}
                        </span>
                      </div>
                      <h4 className="text-[15px] font-bold text-[#0F172A] dark:text-white mt-1">
                        {ev.title}
                      </h4>
                      <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                        {ev.day_of_week} · {formatDate(ev.date)} {ev.description ? `— ${ev.description}` : ""}
                      </p>
                    </div>
                  </div>

                  {canManage && ev.category !== "birthday" && (
                    <div className="flex items-center gap-1 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(ev.id, ev.title)}
                        className="p-1.5 text-[#EF4444] hover:bg-rose-50 rounded-xl dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. SUPER ADMIN ADD / EDIT HOLIDAY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3 dark:border-[#1E293B]">
              <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
                {editingItem ? "Edit Event" : "Add Holiday / Festival"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-[12.5px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveHoliday} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Diwali / Independence Day"
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2.5 text-[13px] text-[#0F172A] outline-none focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-[13px] text-[#0F172A] outline-none focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-[13px] text-[#0F172A] outline-none focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                  >
                    <option value="public_holiday">Public Holiday</option>
                    <option value="national_holiday">National Holiday</option>
                    <option value="festival_observance">Festival Observance</option>
                    <option value="restricted">Restricted / Optional</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#1E293B] dark:bg-[#0B132B]">
                <label className="mb-2 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  Factory Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormIsOff(true);
                      setFormColor("#EF4444");
                    }}
                    className={classNames(
                      "flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[12px] font-bold transition",
                      formIsOff
                        ? "bg-[#EF4444] text-white shadow-sm"
                        : "bg-white text-[#64748B] border border-[#CBD5E1] dark:bg-[#1E293B] dark:text-[#94A3B8]"
                    )}
                  >
                    🏖️ Factory Off (Paid)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormIsOff(false);
                      setFormColor("#10B981");
                    }}
                    className={classNames(
                      "flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[12px] font-bold transition",
                      !formIsOff
                        ? "bg-[#10B981] text-white shadow-sm"
                        : "bg-white text-[#64748B] border border-[#CBD5E1] dark:bg-[#1E293B] dark:text-[#94A3B8]"
                    )}
                  >
                    🎉 Working Festival
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Factory machinery puja, cultural celebration, etc."
                  className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-[13px] font-bold text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#1E6FE0] px-5 py-2 text-[13px] font-bold text-white shadow-md hover:bg-[#1556B8] disabled:opacity-50"
                >
                  {saving ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {editingItem ? "Update" : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
