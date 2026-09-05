"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, CalendarDays, Clock, CheckSquare } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, formatDate, timeAgo } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";

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
  const { t } = usePrefs();
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
    { key: "all", label: t("allRequests"), count: total },
    { key: "leaves", label: t("leaveRequests"), count: leaves.length },
    { key: "manual", label: t("manualPunchRequests"), count: manual.length },
    ...(changes.length ? [{ key: "changes" as const, label: "Admin Changes", count: changes.length }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-[#1E6FE0]" />
              <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
                {t("pendingApprovalsTitle")}
              </h1>
            </div>
            <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
              {t("pendingApprovalsSub")}
            </p>
          </div>
          {total > 0 && (
            <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-[#FFF4E0] border border-[#F5A623]/30 px-3 py-1 text-[12px] font-bold text-[#D98200]">
              {total} {t("pendingAction")}
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-[14px] bg-[#EEF2F7] p-1" style={{ touchAction: "pan-x" }}>
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => setTab(tabItem.key)}
            className={classNames(
              "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[12px] px-4 py-2.5 text-[13.5px] font-bold transition",
              tab === tabItem.key ? "bg-white text-[#172334] shadow-sm" : "text-[#8A97A8] hover:text-[#172334]"
            )}
          >
            <span>{tabItem.label}</span>
            <span
              className={classNames(
                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                tab === tabItem.key ? "bg-[#E7F1FF] text-[#1E6FE0]" : "bg-white/70 text-[#8A97A8]"
              )}
            >
              {tabItem.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-[#1E6FE0]" />
        </div>
      ) : total === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E1F8EF] text-[#16B878] mb-3">
            <CheckSquare className="h-7 w-7" />
          </div>
          <p className="text-[18px] font-bold text-[#172334]">{t("noNotifications")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Leaves */}
          {(tab === "all" || tab === "leaves") &&
            leaves.map((l) => (
              <article
                key={`l_${l.id}`}
                className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] hover:shadow-pop transition flex flex-col justify-between"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <Avatar name={l.user_name} color={l.user_color} size={48} src={avatarSrc(l.user_id, l.user_avatar)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[16px] font-bold text-[#172334]">{l.user_name}</p>
                        <span
                          className="rounded-full px-3 py-0.5 text-[11.5px] font-bold"
                          style={{ backgroundColor: `${l.leave_type_color}22`, color: l.leave_type_color }}
                        >
                          {l.leave_type_name}
                        </span>
                        {l.user_department && (
                          <span className="rounded-full bg-[#F4F7FB] border border-[#E3EAF1] px-2.5 py-0.5 text-[11px] font-semibold text-[#617083]">
                            {l.user_department}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[#617083]">
                        <span className="flex items-center gap-1.5 font-semibold text-[#172334]">
                          <CalendarDays className="h-4 w-4 text-[#1E6FE0]" />
                          {formatDate(l.start_date)}
                          {l.start_date !== l.end_date ? ` → ${formatDate(l.end_date)}` : ""}
                        </span>
                        <span className="rounded-full bg-[#E7F1FF] px-2.5 py-0.5 text-[11.5px] font-bold text-[#1E6FE0]">
                          {l.days} {t("daysLeft")}
                        </span>
                        <span className="text-[12px] text-[#8A97A8]">
                          {t("requested")} {timeAgo(l.created_at)}
                        </span>
                      </div>

                      <div className="mt-3 rounded-[12px] bg-[#F8FAFD] border border-[#E3EAF1] p-3 text-[13.5px] text-[#172334]">
                        <span className="font-semibold text-[#8A97A8] text-[12px] block mb-0.5">{t("reason")}:</span>
                        &ldquo;{l.reason}&rdquo;
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <Actions
                      approveText={t("approve")}
                      rejectText={t("reject")}
                      busy={busy === l.id}
                      onApprove={() => act("leave", l.id, "approve")}
                      onReject={() => act("leave", l.id, "reject")}
                    />
                  )}
                </div>
              </article>
            ))}

          {/* Manual Punches */}
          {(tab === "all" || tab === "manual") &&
            manual.map((m) => (
              <article
                key={`m_${m.id}`}
                className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] hover:shadow-pop transition flex flex-col justify-between"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <Avatar name={m.user_name} color={m.user_color} size={48} src={avatarSrc(m.user_id, m.user_avatar)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[16px] font-bold text-[#172334]">{m.user_name}</p>
                        <span className="rounded-full bg-[#E7F1FF] px-3 py-0.5 text-[11.5px] font-bold text-[#1E6FE0]">
                          {m.type === "punch_in" ? t("punchIn") : t("punchOut")}
                        </span>
                        {m.user_staff_type === "yellow_card" && (
                          <span className="rounded-full bg-[#FFF4E0] border border-[#F5A623]/30 px-2.5 py-0.5 text-[11px] font-bold text-[#D98200]">
                            {t("yellowCardBadge")}
                          </span>
                        )}
                        {m.user_department && (
                          <span className="rounded-full bg-[#F4F7FB] border border-[#E3EAF1] px-2.5 py-0.5 text-[11px] font-semibold text-[#617083]">
                            {m.user_department}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[#617083]">
                        <span className="flex items-center gap-1.5 font-semibold text-[#172334]">
                          <Clock className="h-4 w-4 text-[#16B878]" />
                          {formatDate(m.date)} at {m.time}
                        </span>
                        <span className="text-[12px] text-[#8A97A8]">
                          {t("requested")} {timeAgo(m.created_at)}
                        </span>
                      </div>

                      <div className="mt-3 rounded-[12px] bg-[#F8FAFD] border border-[#E3EAF1] p-3 text-[13.5px] text-[#172334]">
                        <span className="font-semibold text-[#8A97A8] text-[12px] block mb-0.5">{t("reason")}:</span>
                        &ldquo;{m.reason}&rdquo;
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <Actions
                      approveText={t("approve")}
                      rejectText={t("reject")}
                      busy={busy === m.id}
                      onApprove={() => act("manual", m.id, "approve")}
                      onReject={() => act("manual", m.id, "reject")}
                    />
                  )}
                </div>
              </article>
            ))}

          {/* Change Requests */}
          {(tab === "all" || tab === "changes") &&
            changes.map((c) => (
              <article
                key={`c_${c.id}`}
                className="card p-6 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] hover:shadow-pop transition flex flex-col justify-between"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <Avatar name={c.requester_name} color={c.requester_color} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold text-[#172334]">{c.requester_name}</p>
                      <p className="text-[13px] font-semibold capitalize text-[#1E6FE0]">
                        {String(c.kind).replace("_", " ")}
                      </p>
                      <pre className="mt-2 rounded-[12px] bg-[#F8FAFD] border border-[#E3EAF1] p-3 text-[12px] text-[#172334] overflow-x-auto">
                        {JSON.stringify(c.payload, null, 2)}
                      </pre>
                      <p className="mt-1.5 text-[11.5px] text-[#8A97A8]">
                        {t("requested")} {timeAgo(c.created_at)}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <Actions
                      approveText={t("approve")}
                      rejectText={t("reject")}
                      busy={busy === c.id}
                      onApprove={() => act("change", c.id, "approve")}
                      onReject={() => act("change", c.id, "reject")}
                    />
                  )}
                </div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}

function Actions({
  busy,
  approveText,
  rejectText,
  onApprove,
  onReject,
}: {
  busy: boolean;
  approveText: string;
  rejectText: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
      <button
        type="button"
        onClick={onApprove}
        disabled={busy}
        className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[#16B878] px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#07945D] active:scale-95 disabled:opacity-60"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {approveText}
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={busy}
        className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[#C52B35] px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#a8242d] active:scale-95 disabled:opacity-60"
      >
        <XCircle className="h-4 w-4" /> {rejectText}
      </button>
    </div>
  );
}
