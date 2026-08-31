"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, CalendarDays, Clock, CheckSquare } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner, EmptyState } from "@/components/ui";
import { classNames, formatDate, timeAgo } from "@/lib/utils";

interface LeaveReq {
  id: string;
  user_name: string;
  user_color: string;
  user_department: string;
  user_id?: string;
  user_avatar?: string;
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
  user_id?: string;
  user_avatar?: string;
  date: string;
  type: string;
  time: string;
  reason: string;
  created_at: number;
}

export default function ApprovalsClient({ canManage }: { canManage: boolean }) {
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [manual, setManual] = useState<(ManualReq & { stage?: string; user_staff_type?: string })[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "leaves" | "manual" | "changes">("all");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/approvals");
    const data = await res.json();
    setLeaves(data.leaves || []);
    setManual(data.manual || []);
    setChanges(data.changes || []);
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

  const total = leaves.length + manual.length + changes.length;
  const tabs: { key: "all" | "leaves" | "manual" | "changes"; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    { key: "leaves", label: "Leaves", count: leaves.length },
    { key: "manual", label: "Manual", count: manual.length },
    ...(changes.length ? [{ key: "changes" as const, label: "Changes", count: changes.length }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <h1 className="text-[26px] font-bold tracking-tight text-[#172334]">Approvals</h1>
        <p className="mt-1 text-[14px] text-[#8A97A8]">Review leave and manual punch requests.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-[14px] bg-[#EEF2F7] p-1" style={{ touchAction: "pan-x" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={classNames(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] px-3 py-2.5 text-[13px] font-semibold",
              tab === t.key ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8]"
            )}
          >
            {t.label}
            <span
              className={classNames(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                tab === t.key ? "bg-[#E8F1FC] text-[#1E6FE0]" : "bg-white/70 text-[#8A97A8]"
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-7 w-7 text-brand-500" />
        </div>
      ) : total === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CheckSquare className="h-8 w-8" />}
            title="All caught up"
            subtitle="There are no pending requests right now."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {(tab === "all" || tab === "leaves") &&
            leaves.map((l) => (
              <article key={`l_${l.id}`} className="card p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={l.user_name} color={l.user_color} size={44} src={avatarSrc(l.user_id, l.user_avatar)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-[#172334]">{l.user_name}</p>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: `${l.leave_type_color}22`, color: l.leave_type_color }}
                      >
                        {l.leave_type_name}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#8A97A8]">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {formatDate(l.start_date)}
                      {l.start_date !== l.end_date ? ` → ${formatDate(l.end_date)}` : ""} · {l.days} day
                      {l.days > 1 ? "s" : ""}
                    </p>
                    <p className="mt-1.5 break-words text-[14px] text-[#617083]">{l.reason}</p>
                    <p className="mt-1 text-[11px] text-[#8A97A8]">Requested {timeAgo(l.created_at)}</p>
                  </div>
                </div>
                {canManage && (
                  <Actions busy={busy === l.id} onApprove={() => act("leave", l.id, "approve")} onReject={() => act("leave", l.id, "reject")} />
                )}
              </article>
            ))}

          {(tab === "all" || tab === "manual") &&
            manual.map((m) => (
              <article key={`m_${m.id}`} className="card p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={m.user_name} color={m.user_color} size={44} src={avatarSrc(m.user_id, m.user_avatar)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-[#172334]">{m.user_name}</p>
                      <span className="rounded-full bg-[#E8F1FC] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E6FE0]">
                        Manual {m.type === "punch_in" ? "Punch In" : "Punch Out"}
                      </span>
                      {m.user_staff_type === "yellow_card" && (
                        <span className="rounded-full bg-[#FFF1E8] px-2.5 py-0.5 text-[11px] font-semibold text-[#C2410C]">
                          Yellow card
                        </span>
                      )}
                      {m.user_department && (
                        <span className="rounded-full bg-[#F4F7FB] px-2.5 py-0.5 text-[11px] font-semibold text-[#8A97A8]">
                          {m.user_department}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#8A97A8]">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {formatDate(m.date)} · {m.time}
                    </p>
                    <p className="mt-1.5 break-words text-[14px] text-[#617083]">{m.reason}</p>
                    <p className="mt-1 text-[11px] text-[#8A97A8]">Requested {timeAgo(m.created_at)}</p>
                  </div>
                </div>
                {canManage && (
                  <Actions busy={busy === m.id} onApprove={() => act("manual", m.id, "approve")} onReject={() => act("manual", m.id, "reject")} />
                )}
              </article>
            ))}

          {(tab === "all" || tab === "changes") &&
            changes.map((c) => (
              <article key={`c_${c.id}`} className="card p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={c.requester_name} color={c.requester_color} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[#172334]">{c.requester_name}</p>
                    <p className="text-[13px] capitalize text-[#8A97A8]">{String(c.kind).replace("_", " ")}</p>
                    <p className="mt-1 break-all text-[14px] text-[#617083]">{JSON.stringify(c.payload)}</p>
                    <p className="mt-1 text-[11px] text-[#8A97A8]">Requested {timeAgo(c.created_at)}</p>
                  </div>
                </div>
                {canManage && (
                  <Actions busy={busy === c.id} onApprove={() => act("change", c.id, "approve")} onReject={() => act("change", c.id, "reject")} />
                )}
              </article>
            ))}
        </div>
      )}
    </div>
  );
}

function Actions({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
      <button
        type="button"
        onClick={onApprove}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] bg-[#16B878] px-5 text-[14px] font-semibold text-white disabled:opacity-60 sm:h-10 sm:text-xs"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        Approve
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] bg-[#C52B35] px-5 text-[14px] font-semibold text-white disabled:opacity-60 sm:h-10 sm:text-xs"
      >
        <XCircle className="h-4 w-4" /> Reject
      </button>
    </div>
  );
}
