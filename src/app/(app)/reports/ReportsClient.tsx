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
  const people = data.perEmployee || [];
  const present = data.totals.present || 0;
  const late = data.totals.late || 0;
  const half = data.totals.half || 0;
  const absent = data.totals.absent || 0;
  const headcount = Math.max(1, present + late + half + absent);

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-[26px] font-bold tracking-tight text-[#172334]">Reports</h1>
        <p className="mt-1 text-[14px] text-[#8A97A8]">Monthly attendance insights and exports.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[14px] border border-[#E3EAF1] bg-white px-1 py-1">
          <button type="button" onClick={() => shift(-1)} className="rounded-lg p-2 hover:bg-[#F4F7FB]" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-0 flex-1 px-2 text-center text-[14px] font-semibold text-[#172334]">{monthLabel}</span>
          <button type="button" onClick={() => shift(1)} className="rounded-lg p-2 hover:bg-[#F4F7FB]" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex">
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
        <KpiTile label="Present" hint={`${present} punches`} value={present} color="#16B878" pct={(present / headcount) * 100} />
        <KpiTile label="Late" hint={`${late} late`} value={late} color="#F5A623" pct={(late / headcount) * 100} />
        <KpiTile label="Half day" hint={`${half} half`} value={half} color="#1E6FE0" pct={(half / headcount) * 100} />
        <KpiTile label="Absent" hint={`${absent} absent`} value={absent} color="#C52B35" pct={(absent / headcount) * 100} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <p className="text-[13px] text-[#8A97A8]">Attendance this month</p>
          <p className="mt-1 text-[36px] font-bold tabular-nums leading-none text-[#172334]">{data.pct}%</p>
          <p className="mt-1 text-[12px] text-[#8A97A8]">{data.workingDays} working days</p>
          <svg viewBox="0 0 100 40" className="mt-3 h-28 w-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="rptFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E6FE0" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#1E6FE0" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon fill="url(#rptFill)" points={area} />
            <polyline
              fill="none"
              stroke="#1E6FE0"
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={pts}
            />
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
    <div className="card p-4">
      <p className="truncate text-[13px] font-semibold text-[#172334]">{label}</p>
      <p className="mt-1 text-[13px] text-[#8A97A8]">{hint}</p>
      <p className="mt-2 text-[28px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E8EEF4]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(4, pct))}%`, background: color }} />
      </div>
    </div>
  );
}
