"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  BarChart3,
  Search,
  Users,
  Calendar,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { istParts } from "@/lib/utils";

export default function ReportsClient() {
  const [month, setMonth] = useState(() => istParts().monthKey);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchEmp, setSearchEmp] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?month=${month}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [month]);

  function shift(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }

  function exportFile(format: string) {
    window.open(`/api/reports/export?month=${month}&format=${format}`, "_blank");
  }

  const monthLabel = new Date(month + "-01T12:00:00+05:30").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const filteredPeople = useMemo(() => {
    if (!data?.perEmployee) return [];
    if (!searchEmp.trim()) return data.perEmployee;
    const q = searchEmp.toLowerCase();
    return data.perEmployee.filter(
      (e: any) =>
        e.name.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q))
    );
  }, [data, searchEmp]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-[#1E6FE0]" />
      </div>
    );
  }

  const daily = data.daily || [];
  const maxDaily = Math.max(1, ...daily.map((d: any) => d.present || 0));
  const n = Math.max(1, daily.length - 1);
  const pts = daily
    .map((d: any, i: number) => {
      const x = (i / n) * 100;
      const y = 36 - ((d.present || 0) / maxDaily) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  const firstY = daily.length ? 36 - ((daily[0].present || 0) / maxDaily) * 28 : 36;
  const lastY = daily.length ? 36 - ((daily[daily.length - 1].present || 0) / maxDaily) * 28 : 36;
  const area = daily.length ? `0,40 0,${firstY} ${pts} 100,${lastY} 100,40` : "0,40 100,40";
  const depts = data.byDepartment || [];
  const present = data.totals.present || 0;
  const late = data.totals.late || 0;
  const half = data.totals.half || 0;
  const absent = data.totals.absent || 0;
  const headcount = Math.max(1, present + late + half + absent);

  return (
    <div className="space-y-6">
      {/* Top Header - Always visible on Mobile & Desktop */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-[#1E6FE0]" />
          <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
            Analytics & Reports
          </h1>
        </div>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
          Monthly attendance trends, department breakdowns, and exportable payroll reports.
        </p>
      </div>

      {/* Control Bar: Month Switcher + Exports */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-[240px] items-center gap-1 rounded-[14px] border border-[#E3EAF1] bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-[10px] p-2 text-[#617083] hover:bg-[#F4F7FB] hover:text-[#172334]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-0 flex-1 px-3 text-center text-[14px] font-bold text-[#172334]">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-[10px] p-2 text-[#617083] hover:bg-[#F4F7FB] hover:text-[#172334]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportFile("pdf")}
            className="flex items-center gap-1.5 rounded-[12px] border border-[#E3EAF1] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#172334] shadow-sm transition hover:bg-[#F8FAFD]"
          >
            <FileText className="h-4 w-4 text-[#C52B35]" /> Export PDF
          </button>
          <button
            type="button"
            onClick={() => exportFile("excel")}
            className="flex items-center gap-1.5 rounded-[12px] border border-[#E3EAF1] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#172334] shadow-sm transition hover:bg-[#F8FAFD]"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#16B878]" /> Export Excel
          </button>
          <button
            type="button"
            onClick={() => exportFile("csv")}
            className="flex items-center gap-1.5 rounded-[12px] border border-[#E3EAF1] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#172334] shadow-sm transition hover:bg-[#F8FAFD]"
          >
            <Download className="h-4 w-4 text-[#1E6FE0]" /> Export CSV
          </button>
        </div>
      </div>

      {/* 4 Metric Tiles */}
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiTile label="Present Punches" hint={`${present} on-time`} value={present} color="#16B878" pct={(present / headcount) * 100} />
        <KpiTile label="Late Arrivals" hint={`${late} late entries`} value={late} color="#F5A623" pct={(late / headcount) * 100} />
        <KpiTile label="Half Days" hint={`${half} half shifts`} value={half} color="#1E6FE0" pct={(half / headcount) * 100} />
        <KpiTile label="Absenteeism" hint={`${absent} absences`} value={absent} color="#C52B35" pct={(absent / headcount) * 100} />
      </div>

      {/* 2-Column Analytics Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Attendance Rate SVG Trend */}
        <section className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-[#8A97A8]">Monthly Attendance Average</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-[36px] font-bold tabular-nums leading-none text-[#172334]">
                    {data.pct}%
                  </span>
                  <span className="rounded-full bg-[#E1F8EF] px-2.5 py-0.5 text-[11.5px] font-bold text-[#06613E]">
                    {data.workingDays} Working Days
                  </span>
                </div>
              </div>
            </div>

            {/* Smooth Trend Area */}
            <svg viewBox="0 0 100 40" className="mt-6 h-32 w-full" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="rptFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E6FE0" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#1E6FE0" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon fill="url(#rptFill)" points={area} />
              <polyline
                fill="none"
                stroke="#1E6FE0"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pts}
              />
            </svg>
          </div>
          <p className="mt-2 text-[12px] text-[#8A97A8]">Daily workforce presence across the month</p>
        </section>

        {/* Department Performance */}
        <section className="card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[#172334]">Department Attendance Rate</h2>
            <p className="text-[12.5px] text-[#8A97A8]">Presence breakdown per division</p>

            {depts.length === 0 ? (
              <p className="mt-8 text-center text-sm text-[#8A97A8]">No department records for this month.</p>
            ) : (
              <ul className="mt-5 space-y-4">
                {depts.map((d: any) => (
                  <li key={d.name}>
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span className="font-semibold text-[#172334]">{d.name}</span>
                      <span className="font-bold tabular-nums text-[#1E6FE0]">{d.rate}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E8EEF4]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1E6FE0] to-[#16B878]"
                        style={{ width: `${Math.min(100, Math.max(0, d.rate))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* 3 Insights Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">Average Delay</p>
          <p className="mt-1 text-[26px] font-bold tabular-nums text-[#172334]">
            {data.insights.avgLateMin}{" "}
            <span className="text-[14px] font-normal text-[#8A97A8]">mins / late user</span>
          </p>
        </div>

        <div className="card p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">On-Time Arrival Rate</p>
          <p className="mt-1 text-[26px] font-bold tabular-nums text-[#16B878]">
            {data.insights.onTimeRate}%
          </p>
        </div>

        <div className="card p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#8A97A8]">Total Leave Days</p>
          <p className="mt-1 text-[26px] font-bold tabular-nums text-[#1E6FE0]">
            {data.insights.leaveDays}{" "}
            <span className="text-[14px] font-normal text-[#8A97A8]">days taken</span>
          </p>
        </div>
      </div>

      {/* Comprehensive Per Employee Attendance Table */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#F0F4F8]">
          <div>
            <h2 className="text-[16px] font-bold text-[#172334]">Per Employee Summary</h2>
            <p className="text-[12.5px] text-[#8A97A8]">Monthly individual scorecards</p>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97A8]" />
            <input
              value={searchEmp}
              onChange={(e) => setSearchEmp(e.target.value)}
              placeholder="Search employee…"
              className="h-9 w-full rounded-[10px] border border-[#E3EAF1] bg-white pl-9 pr-3 text-[13px] text-[#172334] outline-none focus:border-[#1E6FE0]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-[#E3EAF1] bg-[#F8FAFD] text-[11px] font-bold uppercase tracking-wider text-[#8A97A8]">
                <th className="px-6 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Half Day</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-6 py-3">Attendance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4F8]">
              {filteredPeople.map((e: any) => (
                <tr key={e.id} className="transition hover:bg-[#F8FAFD]">
                  <td className="px-6 py-3.5">
                    <p className="font-bold text-[#172334]">{e.name}</p>
                    <p className="text-[11.5px] text-[#8A97A8]">
                      {e.role === "super_admin"
                        ? "Super Admin"
                        : e.staff_type === "yellow_card"
                          ? "Yellow card / Third party"
                          : "Official Staff"}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-[#617083]">{e.department || "—"}</td>
                  <td className="px-4 py-3.5 tabular-nums text-[#16B878] font-semibold">{e.present}</td>
                  <td className="px-4 py-3.5 tabular-nums text-[#F5A623]">{e.late}</td>
                  <td className="px-4 py-3.5 tabular-nums text-[#1E6FE0]">{e.half}</td>
                  <td className="px-4 py-3.5 tabular-nums text-[#C52B35]">{e.absent}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums ${
                        e.rate >= 90
                          ? "bg-[#E1F8EF] text-[#06613E]"
                          : e.rate >= 75
                            ? "bg-[#FFF4E0] text-[#D98200]"
                            : "bg-[#FDECEC] text-[#C52B35]"
                      }`}
                    >
                      {e.rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiTile({
  label,
  hint,
  value,
  color,
  pct,
}: {
  label: string;
  hint: string;
  value: number;
  color: string;
  pct: number;
}) {
  return (
    <div className="card p-5">
      <p className="truncate text-[13px] font-bold text-[#172334]">{label}</p>
      <p className="mt-1 text-[12px] text-[#8A97A8]">{hint}</p>
      <p className="mt-2 text-[30px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
      <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[#E8EEF4]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(4, pct))}%`, background: color }}
        />
      </div>
    </div>
  );
}
