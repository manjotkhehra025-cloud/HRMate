"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  CalendarDays,
  PartyPopper,
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Clock,
  Briefcase,
  Palmtree,
} from "lucide-react";
import { usePrefs } from "@/components/PrefsProvider";
import { Spinner } from "@/components/ui";
import { classNames, formatDate } from "@/lib/utils";

export interface HolidayItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: string;
  is_off: number; // 1 = Paid Holiday / Factory Closed, 0 = Working Festival
  description?: string;
  color?: string;
  days_left: number;
  is_past: boolean;
  is_today: boolean;
  day_of_week: string;
}

interface HolidaysCalendarProps {
  canManage?: boolean;
}

export default function HolidaysCalendar({ canManage = false }: HolidaysCalendarProps) {
  const { t, prefs } = usePrefs();
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "off" | "festival">("all");
  const [selectedYear, setSelectedYear] = useState<string>("2026");

  // Add / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HolidayItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formType, setFormType] = useState("public_holiday");
  const [formIsOff, setFormIsOff] = useState(true);
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("#1E6FE0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/holidays?year=${selectedYear}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.holidays)) {
        setHolidays(data.holidays);
      }
    } catch (err) {
      console.error("Failed to load holidays", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [selectedYear]);

  // Filtered Holidays
  const filtered = useMemo(() => {
    return holidays.filter((h) => {
      // Type Filter
      if (filterType === "off" && !h.is_off) return false;
      if (filterType === "festival" && h.is_off) return false;

      // Search Filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = h.title.toLowerCase().includes(q);
        const matchDesc = (h.description || "").toLowerCase().includes(q);
        const matchDate = h.date.includes(q);
        if (!matchTitle && !matchDesc && !matchDate) return false;
      }

      return true;
    });
  }, [holidays, filterType, search]);

  // Next upcoming event
  const nextEvent = useMemo(() => {
    return holidays.find((h) => !h.is_past) || holidays[0];
  }, [holidays]);

  // Group by Month
  const groupedByMonth = useMemo(() => {
    const groups: { monthKey: string; monthTitle: string; items: HolidayItem[] }[] = [];
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    for (const item of filtered) {
      const d = new Date(item.date + "T00:00:00");
      const monthIdx = d.getMonth();
      const monthTitle = `${monthNames[monthIdx]} ${d.getFullYear()}`;
      const monthKey = `${d.getFullYear()}-${String(monthIdx + 1).padStart(2, "0")}`;

      let group = groups.find((g) => g.monthKey === monthKey);
      if (!group) {
        group = { monthKey, monthTitle, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }, [filtered]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormType("public_holiday");
    setFormIsOff(true);
    setFormDesc("");
    setFormColor("#1E6FE0");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (item: HolidayItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDate(item.date);
    setFormType(item.type);
    setFormIsOff(!!item.is_off);
    setFormDesc(item.description || "");
    setFormColor(item.color || (item.is_off ? "#EF4444" : "#10B981"));
    setError("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) {
      setError("Please fill in Title and Date");
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
        loadHolidays();
      } else {
        setError(data.error || "Failed to save holiday");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        loadHolidays();
      } else {
        alert(data.error || "Failed to delete");
      }
    } catch (err) {
      alert("Failed to delete");
    }
  };

  // Google Calendar Link Generator
  const getGoogleCalendarUrl = (item: HolidayItem) => {
    const startDate = item.date.replace(/-/g, "");
    const d = new Date(item.date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const endDate = d.toISOString().split("T")[0].replace(/-/g, "");

    const tag = item.is_off ? "[OFF - Holiday]" : "[Festival / Working]";
    const text = encodeURIComponent(`${tag} ${item.title}`);
    const details = encodeURIComponent(
      item.description
        ? `${item.description}\nStatus: ${item.is_off ? "Factory Closed (Paid Holiday)" : "Working Day Celebration"}`
        : `Status: ${item.is_off ? "Factory Closed (Paid Holiday)" : "Working Day Celebration"}`
    );
    const location = encodeURIComponent("GD Foods Mfg. (I) Pvt. Ltd.");

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
  };

  const totalOffCount = useMemo(() => holidays.filter((h) => h.is_off).length, [holidays]);
  const totalFestivalCount = useMemo(() => holidays.filter((h) => !h.is_off).length, [holidays]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Next Event Highlight */}
      {nextEvent && (
        <div className="relative overflow-hidden rounded-3xl border border-[#E2E8F0] bg-gradient-to-br from-[#0B192C] via-[#0F2D54] to-[#0B192C] p-5 sm:p-6 text-white shadow-xl">
          <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 text-[11px] font-bold text-amber-300 ring-1 ring-amber-400/30">
                  <PartyPopper className="h-3.5 w-3.5" />
                  {nextEvent.is_today
                    ? t("todayEvent")
                    : nextEvent.days_left === 1
                    ? t("tomorrowEvent")
                    : `In ${nextEvent.days_left} ${t("daysRemaining")}`}
                </span>
                <span
                  className={classNames(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1",
                    nextEvent.is_off
                      ? "bg-rose-500/20 text-rose-300 ring-rose-500/40"
                      : "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
                  )}
                >
                  {nextEvent.is_off ? t("paidHoliday") : t("workingFestival")}
                </span>
              </div>
              <h2 className="text-[22px] sm:text-[26px] font-black tracking-tight text-white">
                {nextEvent.title}
              </h2>
              <p className="text-[13px] text-slate-300 font-medium">
                {formatDate(nextEvent.date)} ({nextEvent.day_of_week})
                {nextEvent.description ? ` — ${nextEvent.description}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={getGoogleCalendarUrl(nextEvent)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-bold text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-white/20 active:scale-95"
              >
                <CalendarIcon className="h-4 w-4 text-[#38BDF8]" />
                Add to Google Calendar
              </a>
              <a
                href="/api/holidays/ical"
                download="hrmate-holidays.ics"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-[13px] font-bold text-emerald-300 ring-1 ring-emerald-500/40 backdrop-blur-md transition hover:bg-emerald-500/30 active:scale-95"
              >
                <Download className="h-4 w-4" />
                Sync All to Phone
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters, Year Selector, Search, and Action Buttons */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#1E293B] dark:bg-[#0F172A]">
        {/* Left: Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={classNames(
              "rounded-xl px-3 py-1.5 text-[12.5px] font-bold transition",
              filterType === "all"
                ? "bg-[#1E6FE0] text-white shadow-sm"
                : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#94A3B8]"
            )}
          >
            {t("allHolidays")} ({holidays.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("off")}
            className={classNames(
              "rounded-xl px-3 py-1.5 text-[12.5px] font-bold transition",
              filterType === "off"
                ? "bg-[#EF4444] text-white shadow-sm"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300"
            )}
          >
            {t("filterPaidOff")} ({totalOffCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("festival")}
            className={classNames(
              "rounded-xl px-3 py-1.5 text-[12.5px] font-bold transition",
              filterType === "festival"
                ? "bg-[#10B981] text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
            )}
          >
            {t("filterFestivals")} ({totalFestivalCount})
          </button>
        </div>

        {/* Right: Search + Year + Add Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search festival / holiday..."
              className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] pl-9 pr-3 text-[12.5px] text-[#0F172A] outline-none transition focus:border-[#1E6FE0] dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
            />
          </div>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label="Select holiday year"
            className="h-9 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 text-[12.5px] font-bold text-[#0F172A] outline-none dark:border-[#334155] dark:bg-[#0B132B] dark:text-white"
          >
            <option value="2026">Year 2026</option>
            <option value="2027">Year 2027</option>
          </select>

          {/* Super Admin Add Button */}
          {canManage && (
            <button
              type="button"
              onClick={openAddModal}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#1E6FE0] px-3.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-[#1556B8] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {t("addHoliday")}
            </button>
          )}
        </div>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8 text-[#1E6FE0]" />
          <p className="mt-2 text-[13px] font-medium text-[#64748B]">Loading holidays & festivals...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-sm dark:border-[#1E293B] dark:bg-[#0F172A]">
          <CalendarDays className="mx-auto h-12 w-12 text-[#94A3B8]" />
          <p className="mt-3 text-[15px] font-bold text-[#0F172A] dark:text-white">No holidays or festivals found</p>
          <p className="mt-1 text-[13px] text-[#64748B]">Try adjusting your search or filter.</p>
        </div>
      ) : (
        /* Monthly Groups */
        <div className="space-y-6">
          {groupedByMonth.map((group) => (
            <div key={group.monthKey} className="space-y-3">
              {/* Month Header */}
              <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2 dark:border-[#1E293B]">
                <CalendarIcon className="h-4 w-4 text-[#1E6FE0]" />
                <h3 className="text-[15px] font-black tracking-tight text-[#0F172A] dark:text-white">
                  {group.monthTitle}
                </h3>
                <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]">
                  {group.items.length} {group.items.length === 1 ? "event" : "events"}
                </span>
              </div>

              {/* Event Cards Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const dayNum = item.date.split("-")[2];
                  const monthShort = new Date(item.date + "T00:00:00").toLocaleString("en-US", {
                    month: "short",
                  });

                  return (
                    <div
                      key={item.id}
                      className={classNames(
                        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-150 hover:shadow-md",
                        item.is_today
                          ? "border-[#1E6FE0] bg-[#EFF6FF] ring-2 ring-[#1E6FE0]/30 dark:bg-[#1E293B]/60"
                          : item.is_past
                          ? "border-[#E2E8F0] bg-white opacity-80 dark:border-[#1E293B] dark:bg-[#0F172A]"
                          : "border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#0F172A]"
                      )}
                    >
                      <div>
                        {/* Card Header: Date Pill & Badges */}
                        <div className="flex items-start justify-between gap-2">
                          {/* Prominent Date Box */}
                          <div
                            className={classNames(
                              "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-black shadow-sm",
                              item.is_off
                                ? "bg-gradient-to-b from-rose-500 to-rose-600 text-white"
                                : "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white"
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase leading-none">{monthShort}</span>
                            <span className="text-[18px] leading-tight">{dayNum}</span>
                          </div>

                          {/* Status & Countdown Badges */}
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={classNames(
                                "rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ring-1",
                                item.is_off
                                  ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800"
                                  : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
                              )}
                            >
                              {item.is_off ? "🏖️ Factory Off" : "🎉 Working Festival"}
                            </span>

                            <span className="text-[10.5px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                              {item.is_today
                                ? "Today 🎉"
                                : item.days_left === 1
                                ? "Tomorrow"
                                : item.days_left > 1
                                ? `In ${item.days_left} days`
                                : "Passed"}
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div className="mt-3">
                          <h4 className="text-[15.5px] font-bold text-[#0F172A] leading-snug dark:text-white">
                            {item.title}
                          </h4>
                          <p className="mt-0.5 text-[11.5px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                            {item.day_of_week} · {formatDate(item.date)}
                          </p>
                          {item.description && (
                            <p className="mt-2 line-clamp-2 text-[12px] text-[#475569] dark:text-[#CBD5E1]">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Quick Actions */}
                      <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 dark:border-[#1E293B]">
                        <a
                          href={getGoogleCalendarUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#1E6FE0] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Add to Calendar
                        </a>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:hover:bg-[#1E293B] dark:hover:text-white"
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id, item.title)}
                              className="rounded-lg p-1.5 text-[#EF4444] hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Super Admin Add / Edit Holiday Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-2xl dark:border-[#1E293B] dark:bg-[#0F172A]">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3 dark:border-[#1E293B]">
              <h3 className="text-[17px] font-black text-[#0F172A] dark:text-white">
                {editingItem ? t("editHoliday") : t("addHoliday")}
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
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-[12.5px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  {t("holidayTitle")} *
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
                    {t("holidayDate")} *
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
                    {t("holidayType")}
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

              {/* Factory Status (Paid Off vs Working Day) */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#1E293B] dark:bg-[#0B132B]">
                <label className="mb-2 block text-[12.5px] font-bold text-[#0F172A] dark:text-white">
                  {t("isFactoryOff")}
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
                    🏖️ Factory Closed (Off)
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
                  Description / Celebration Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Factory machinery puja, sweets distribution, etc."
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
                  className="flex items-center gap-2 rounded-xl bg-[#1E6FE0] px-5 py-2 text-[13px] font-bold text-white shadow-md transition hover:bg-[#1556B8] disabled:opacity-50"
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
