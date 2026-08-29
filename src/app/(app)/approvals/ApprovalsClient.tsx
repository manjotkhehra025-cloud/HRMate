"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, CalendarDays, Clock, CheckSquare } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Spinner, EmptyState } from "@/components/ui";
import { formatDate, timeAgo } from "@/lib/utils";

interface LeaveReq {
  id: string;
  user_name: string;
  user_color: string;
  user_department: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  created_at: number;
}
interface ManualReq {
  id: string;
  user_name: string;
  user_color: string;
  user_department: string;
  date: string;
  type: string;
  time: string;
  reason: string;
  created_at: number;
}

export default function ApprovalsClient({ canManage }: { canManage: boolean }) {
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [manual, setManual] = useState<ManualReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "leaves" | "manual">("all");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/approvals");
    const data = await res.json();
    setLeaves(data.leaves);
    setManual(data.manual);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(kind: string, id: string, action: "approve" | "reject") {
    setBusy(id);
    await fetch("/api/approvals/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, action }),
    });
    setBusy(null);
    load();
  }

  const total = leaves.length + manual.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 sm:w-80">
        {[
          { key: "all", label: `All (${total})` },
          { key: "leaves", label: `Leaves (${leaves.length})` },
          { key: "manual", label: `Manual (${manual.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-7 w-7 text-brand-500" />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-8 w-8" />}
          title="All caught up"
          subtitle="There are no pending requests right now."
        />
      ) : (
        <div className="space-y-3">
          {(tab === "all" || tab === "leaves") &&
            leaves.map((l) => (
              <div key={`l_${l.id}`} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <Avatar name={l.user_name} color={l.user_color} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{l.user_name}</p>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${l.leave_type_color}18`, color: l.leave_type_color }}>
                      {l.leave_type_name}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(l.start_date)} → {formatDate(l.end_date)} · {l.days} day{l.days > 1 ? "s" : ""}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-600">{l.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Requested {timeAgo(l.created_at)}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => act("leave", l.id, "approve")}
                      disabled={busy === l.id}
                      className="btn-success px-3 py-2 text-xs"
                    >
                      {busy === l.id ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => act("leave", l.id, "reject")}
                      disabled={busy === l.id}
                      className="btn-danger px-3 py-2 text-xs"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}

          {(tab === "all" || tab === "manual") &&
            manual.map((m) => (
              <div key={`m_${m.id}`} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <Avatar name={m.user_name} color={m.user_color} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{m.user_name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Manual {m.type === "punch_in" ? "Punch In" : "Punch Out"}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(m.date)} · {m.time}
                  </p>
                  <p className="mt-1.5 text-sm text-slate-600">{m.reason}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Requested {timeAgo(m.created_at)}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => act("manual", m.id, "approve")}
                      disabled={busy === m.id}
                      className="btn-success px-3 py-2 text-xs"
                    >
                      {busy === m.id ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => act("manual", m.id, "reject")}
                      disabled={busy === m.id}
                      className="btn-danger px-3 py-2 text-xs"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
