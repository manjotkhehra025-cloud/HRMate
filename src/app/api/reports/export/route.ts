import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized, error } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { monthReport } from "@/lib/reports";
import { istParts } from "@/lib/utils";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "reports.view")) {
    return error("You don't have permission to export reports", 403);
  }
  const url = new URL(req.url);
  const month = url.searchParams.get("month") || istParts().monthKey;
  const format = (url.searchParams.get("format") || "csv").toLowerCase();
  const data = monthReport(month);

  const header = ["Employee", "Department", "Staff", "Present", "Late", "Half", "Absent", "Rate %"];
  const rows = data.perEmployee.map((e) => [
    e.name,
    e.department,
    e.staff_type,
    e.present,
    e.late,
    e.half,
    e.absent,
    e.rate,
  ]);

  if (format === "csv" || format === "xlsx" || format === "excel") {
    const body =
      "\uFEFF" + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const ext = format === "csv" ? "csv" : "xls";
    return new NextResponse(body, {
      headers: {
        "Content-Type":
          ext === "csv" ? "text/csv; charset=utf-8" : "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="hrmate-attendance-${month}.${ext}"`,
      },
    });
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Attendance ${month}</title>
  <style>
    body{font-family:Inter,Segoe UI,sans-serif;padding:24px;color:#172334}
    h1{font-size:20px;margin:0} .sub{color:#617083;margin:4px 0 16px}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid #DDE6EF;padding:8px 10px;text-align:left}
    th{background:#F4F7FB}
    .kpis{display:flex;gap:12px;margin:16px 0}
    .kpi{border:1px solid #DDE6EF;border-radius:12px;padding:12px 16px;min-width:90px}
    .kpi b{display:block;font-size:22px}
  </style></head><body>
  <h1>${data.factory} — Attendance ${month}</h1>
  <p class="sub">${data.workingDays} working days · ${data.pct}% attendance</p>
  <div class="kpis">
    <div class="kpi"><span>Present</span><b>${data.totals.present}</b></div>
    <div class="kpi"><span>Late</span><b>${data.totals.late}</b></div>
    <div class="kpi"><span>Half</span><b>${data.totals.half}</b></div>
    <div class="kpi"><span>Absent</span><b>${data.totals.absent}</b></div>
  </div>
  <table><thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="hrmate-attendance-${month}.html"`,
    },
  });
}
