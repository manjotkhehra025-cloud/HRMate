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

  const maxDaily = Math.max(1, ...data.daily.map((d: any) => d.present));
  const points = data.daily
    .map((d: any, i: number) => {
      const x = (i / Math.max(1, data.daily.length - 1)) * 100;
      const y = 40 - (d.present / maxDaily) * 32;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-2 py-1">
          <button onClick={() => shift(-1)} className="p-1">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold">{monthLabel}</span>
          <button onClick={() => shift(1)} className="p-1">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flow-gradient overflow-hidden rounded-[18px] p-5 text-white shadow-glow">
        <p className="text-sm text-white/80">Attendance this month</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="text-4xl font-bold">{data.pct}%</p>
          <p className="text-xs text-white/70">{data.workingDays} working days</p>
        </div>
        <svg viewBox="0 0 100 44" className="mt-3 h-16 w-full" preserveAspectRatio="none">
          <polyline fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" points={points} />
        </svg>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            ["Present", data.totals.present],
            ["Late", data.totals.late],
            ["Half day", data.totals.half],
            ["Absent", data.totals.absent],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-white/15 px-3 py-2">
              <p className="text-lg font-bold">{v as number}</p>
              <p className="text-[11px] text-white/80">{l as string}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Avg late arrivals</p>
          <p className="mt-1 text-2xl font-bold">{data.insights.avgLateMin}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">On-time rate</p>
          <p className="mt-1 text-2xl font-bold text-flow-deep">{data.insights.onTimeRate}%</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Leave days</p>
          <p className="mt-1 text-2xl font-bold">{data.insights.leaveDays}</p>
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold">Export register</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button onClick={() => exportFile("pdf")} className="btn-secondary">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => exportFile("excel")} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button onClick={() => exportFile("csv")} className="btn-secondary">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
        <button onClick={() => exportFile("pdf")} className="btn-primary mt-3 w-full">
          Download summary PDF
        </button>
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold">By department</p>
        <div className="space-y-2">
          {data.byDepartment.map((d: any) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <span>{d.name}</span>
              <span className="font-semibold">{d.rate}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <p className="px-5 py-4 text-sm font-semibold">Per employee</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-[11px] font-semibold uppercase text-muted">
                <th className="px-5 py-2">Employee</th>
                <th className="px-3 py-2">Present</th>
                <th className="px-3 py-2">Late</th>
                <th className="px-3 py-2">Half</th>
                <th className="px-3 py-2">Absent</th>
                <th className="px-5 py-2">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.perEmployee.map((e: any) => (
                <tr key={e.id} className="border-b border-line/70">
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{e.name}</p>
                    <p className="text-[11px] text-muted">
                      {e.department} · {e.staff_type === "yellow_card" ? "Yellow card" : "Official"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">{e.present}</td>
                  <td className="px-3 py-2.5">{e.late}</td>
                  <td className="px-3 py-2.5">{e.half}</td>
                  <td className="px-3 py-2.5">{e.absent}</td>
                  <td className="px-5 py-2.5 font-semibold">{e.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
