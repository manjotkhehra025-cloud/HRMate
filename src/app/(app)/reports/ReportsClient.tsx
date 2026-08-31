"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Spinner } from "@/components/ui";
import { istParts } from "@/lib/utils";

export default function ReportsClient() {
  const [month, setMonth] = useState(() => istParts().monthKey);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7 text-brand-500" />
      </div>
    );
  }

  const daily = data.daily || [];
  const maxDaily = Math.max(1, ...daily.map((d: any) => d.present));
  const pts = daily
    .map((d: any, i: number) => {
      const x = (i / Math.max(1, daily.length - 1)) * 100;
      const y = 36 - (d.present / maxDaily) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  const area = daily.length ? `0,40 ${pts} 100,40` : "0,40 100,40";
  const depts = data.byDepartment || [];
  const people = data.perEmployee || [];

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-[26px] font-bold tracking-tight text-[#172334]">Reports</h1>
        <p className="mt-1 text-[14px] text-[#8A97A8]">Monthly attendance insights and exports.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[14px] border border-[#E3EAF1] bg-white px-1 py-1">
          <button type="button" onClick={() => shift(-1)} className="rounded-lg p-2 hover:bg-[#F4F7FB]" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] px-2 text-center text-[14px] font-semibold text-[#172334]">{monthLabel}</span>
          <button type="button" onClick={() => shift(1)} className="rounded-lg p-2 hover:bg-[#F4F7FB]" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportFile("pdf")} className="btn-secondary px-3 py-2 text-xs">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button type="button" onClick={() => exportFile("excel")} className="btn-secondary px-3 py-2 text-xs">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button type="button" onClick={() => exportFile("csv")} className="btn-secondary px-3 py-2 text-xs">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Present" value={data.totals.present} color="#16B878" />
        <Kpi label="Late" value={data.totals.late} color="#F5A623" />
        <Kpi label="Half day" value={data.totals.half} color="#172334" />
        <Kpi label="Absent" value={data.totals.absent} color="#C52B35" />
      </div>

      <div className="flow-gradient overflow-hidden rounded-[18px] p-5 text-white shadow-glow lg:hidden">
        <p className="text-center text-[13px] text-white/85">Overall attendance</p>
        <p className="mt-1 text-center text-[40px] font-bold leading-none">{data.pct}%</p>
        <p className="mt-1 text-center text-[12px] text-white/75">{data.workingDays} working days</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card hidden p-5 lg:block">
          <p className="text-[13px] text-[#8A97A8]">Attendance this month</p>
          <p className="mt-1 text-[36px] font-bold tabular-nums leading-none text-[#172334]">{data.pct}%</p>
          <p className="mt-1 text-[12px] text-[#8A97A8]">{data.workingDays} working days</p>
          <svg viewBox="0 0 100 40" className="mt-3 h-24 w-full" preserveAspectRatio="none">
            <polyline fill="#1E6FE022" stroke="none" points={area} />
            <polyline fill="none" stroke="#1E6FE0" strokeWidth="2.2" strokeLinejoin="round" points={pts} />
          </svg>
        </section>

        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-[#172334]">By department</h2>
          {depts.length === 0 ? (
            <p className="mt-4 text-sm text-[#8A97A8]">No department data this month.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {depts.map((d: any) => (
                <li key={d.name}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#172334]">{d.name}</span>
                    <span className="font-semibold tabular-nums text-[#617083]">{d.rate}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8EEF4]">
                    <div
                      className="h-full rounded-full bg-[#1E6FE0]"
                      style={{ width: `${Math.min(100, Math.max(0, d.rate))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-[12px] text-[#8A97A8]">Avg late</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-[#172334]">{data.insights.avgLateMin}</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-[#8A97A8]">On-time</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-[#16B878]">{data.insights.onTimeRate}%</p>
        </div>
        <div className="card p-4">
          <p className="text-[12px] text-[#8A97A8]">Leave days</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-[#172334]">{data.insights.leaveDays}</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <h2 className="px-5 py-4 text-[15px] font-semibold text-[#172334]">Per employee</h2>
        <div className="overflow-x-auto" style={{ touchAction: "pan-x pan-y" }}>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-y border-[#F0F4F8] text-[11px] font-semibold uppercase tracking-wide text-[#8A97A8]">
                <th className="px-5 py-2">Name</th>
                <th className="px-3 py-2">Present</th>
                <th className="px-3 py-2">Late</th>
                <th className="px-3 py-2">Half</th>
                <th className="px-3 py-2">Absent</th>
                <th className="px-5 py-2">Rate</th>
              </tr>
            </thead>
            <tbody>
              {people.map((e: any) => (
                <tr key={e.id} className="border-b border-[#F0F4F8]">
                  <td className="px-5 py-2.5">
                    <p className="font-semibold text-[#172334]">{e.name}</p>
                    <p className="text-[11px] text-[#8A97A8]">
                      {e.department || "—"} ·{" "}
                      {e.role === "super_admin"
                        ? "Super Admin"
                        : e.staff_type === "yellow_card"
                          ? "Yellow card"
                          : "Official"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{e.present}</td>
                  <td className="px-3 py-2.5 tabular-nums">{e.late}</td>
                  <td className="px-3 py-2.5 tabular-nums">{e.half}</td>
                  <td className="px-3 py-2.5 tabular-nums">{e.absent}</td>
                  <td className="px-5 py-2.5 font-semibold tabular-nums text-[#172334]">{e.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4">
      <p className="text-[13px] text-[#8A97A8]">{label}</p>
      <p className="mt-1 text-[28px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
