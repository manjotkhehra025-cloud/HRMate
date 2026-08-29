import { classNames } from "@/lib/utils";

export function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue" | "brand";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
    red: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
    blue: "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20",
    brand: "bg-brand-50 text-brand-700 ring-1 ring-brand-600/20",
  };
  return <span className={classNames("badge", tones[tone])}>{children}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={classNames("animate-spin h-4 w-4", className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: "slate" | "green" | "amber" | "red" | "blue" }> = {
    pending: { label: "Pending", tone: "amber" },
    approved: { label: "Approved", tone: "green" },
    rejected: { label: "Rejected", tone: "red" },
    active: { label: "Active", tone: "green" },
    inactive: { label: "Inactive", tone: "slate" },
    punch_in: { label: "Punch In", tone: "green" },
    punch_out: { label: "Punch Out", tone: "blue" },
  };
  const m = map[status] || { label: status, tone: "slate" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
