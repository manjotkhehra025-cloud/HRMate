import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPermissions, type Permission } from "@/lib/permissions";
import { getFactoryConfig } from "@/lib/geo";
import { dateKey } from "@/lib/api";
import db from "@/lib/db";
import PushRegistration from "@/components/PushRegistration";
import { getVapidPublicKey } from "@/lib/push";
import { balancesForUser } from "@/lib/leave";
import { parseWeeklyOff } from "@/lib/staff";
import { dayStatus } from "@/lib/reports";
import { istParts, formatDate } from "@/lib/utils";
import DashboardView, {
  type DashActivity,
  type DashEvent,
  type DashLeaveRow,
} from "./DashboardView";

export const metadata = { title: "Dashboard — HRMate" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

function addDays(dateKeyStr: string, n: number) {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function inLabel(from: string, today: string) {
  if (from <= today) return "today";
  const days = Math.round(
    (new Date(from + "T12:00:00+05:30").getTime() - new Date(today + "T12:00:00+05:30").getTime()) /
      86400000
  );
  if (days === 1) return "in 1d";
  if (days < 7) return `in ${days}d`;
  return formatDate(from);
}

export default function DashboardPage() {
  const user = getSessionUser();
  if (!user) redirect("/login");
  const perms = getPermissions(user.id);
  const has = (p: Permission) => perms.isSuperAdmin || perms.has(p);
  const today = dateKey();
  const yesterday = addDays(today, -1);
  const monthStart = `${istParts().monthKey}-01`;
  const parts = istParts();

  const record = db
    .prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?")
    .get(user.id, today) as any;
  const factory = getFactoryConfig();
  const balances = balancesForUser(user.id);

  const teamView = has("attendance.team") || has("reports.view");
  const people = (
    teamView
      ? (db
          .prepare(
            `SELECT id, name, department, designation, color, avatar, weekly_off, created_at
             FROM users WHERE active = 1 ORDER BY name`
          )
          .all() as any[])
      : [
          {
            id: user.id,
            name: user.name,
            department: user.department,
            designation: user.designation,
            color: user.color,
            avatar: user.avatar,
            weekly_off: user.weekly_off ?? 6,
            created_at: 0,
          },
        ]
  ) as any[];

  const att = db
    .prepare(`SELECT user_id, date, punch_in_at, punch_out_at FROM attendance WHERE date >= ? AND date <= ?`)
    .all(addDays(today, -12), today) as any[];
  const attMap: Record<string, Record<string, any>> = {};
  for (const r of att) {
    attMap[r.user_id] = attMap[r.user_id] || {};
    attMap[r.user_id][r.date] = r;
  }

  const leaveCover = db
    .prepare(
      `SELECT user_id, start_date, end_date FROM leave_requests
       WHERE status = 'approved' AND end_date >= ? AND start_date <= ?`
    )
    .all(addDays(today, -12), today) as { user_id: string; start_date: string; end_date: string }[];
  const onLeaveSet: Record<string, Set<string>> = {};
  for (const l of leaveCover) {
    let d = l.start_date < addDays(today, -12) ? addDays(today, -12) : l.start_date;
    const end = l.end_date > today ? today : l.end_date;
    while (d <= end) {
      (onLeaveSet[l.user_id] ||= new Set()).add(d);
      d = addDays(d, 1);
    }
  }

  function countsFor(date: string) {
    let present = 0;
    let onLeave = 0;
    let absent = 0;
    for (const p of people) {
      const off = parseWeeklyOff(p.weekly_off, 6);
      const st = dayStatus(date, attMap[p.id]?.[date] || null, today, off);
      if (st === "present" || st === "half") present++;
      else if (onLeaveSet[p.id]?.has(date) && st !== "weekly_off") onLeave++;
      else if (st === "absent") absent++;
    }
    return { present, onLeave, absent };
  }

  const todayC = countsFor(today);
  const yestC = countsFor(yesterday);
  const presentPct =
    yestC.present === 0 ? (todayC.present > 0 ? 100 : 0) : Math.round(((todayC.present - yestC.present) / yestC.present) * 1000) / 10;
  const leavePct =
    yestC.onLeave === 0 ? (todayC.onLeave > 0 ? 100 : 0) : Math.round(((todayC.onLeave - yestC.onLeave) / yestC.onLeave) * 1000) / 10;

  const hiredThisMonth = people.filter((p) => p.created_at && p.created_at >= new Date(monthStart + "T00:00:00+05:30").getTime()).length;

  const pendingLeaves = db.prepare(`SELECT COUNT(*) AS c FROM leave_requests WHERE status = 'pending'`).get() as { c: number };
  const pendingPunch = db.prepare(`SELECT COUNT(*) AS c FROM manual_punch_requests WHERE status = 'pending'`).get() as { c: number };
  const pending = has("approvals.view") || has("approvals.manage") ? pendingLeaves.c + pendingPunch.c : 0;

  const sparkDates: string[] = [];
  for (let i = 12; i >= 0; i--) sparkDates.push(addDays(today, -i));
  const sparks = {
    employees: sparkDates.map((_, i) => Math.max(1, people.length - Math.max(0, 3 - i))),
    present: sparkDates.map((d) => countsFor(d).present),
    leave: sparkDates.map((d) => countsFor(d).onLeave),
    pending: sparkDates.map((_, i) => Math.max(0, pending - (12 - i))),
  };

  const recentAtt = (
    teamView
      ? (db
          .prepare(
            `SELECT u.id AS user_id, u.name, u.color, u.avatar, a.punch_in_at, a.punch_out_at, a.notes
             FROM attendance a JOIN users u ON u.id = a.user_id
             WHERE a.punch_in_at IS NOT NULL
             ORDER BY COALESCE(a.punch_out_at, a.punch_in_at) DESC LIMIT 8`
          )
          .all() as any[])
      : (db
          .prepare(
            `SELECT u.id AS user_id, u.name, u.color, u.avatar, a.punch_in_at, a.punch_out_at, a.notes
             FROM attendance a JOIN users u ON u.id = a.user_id
             WHERE a.user_id = ? AND a.punch_in_at IS NOT NULL
             ORDER BY COALESCE(a.punch_out_at, a.punch_in_at) DESC LIMIT 8`
          )
          .all(user.id) as any[])
  );

  const activity: DashActivity[] = recentAtt.map((r, i) => {
    const out = !!r.punch_out_at;
    return {
      id: `${r.user_id}-${r.punch_in_at}-${i}`,
      name: r.name,
      text: out
        ? `Punched out at ${formatTimeSafe(r.punch_out_at)}`
        : `Punched in at ${formatTimeSafe(r.punch_in_at)}`,
      ts: r.punch_out_at || r.punch_in_at,
      color: r.color || "#1E6FE0",
      avatar: r.avatar || "",
      userId: r.user_id,
      tone: out ? "green" : "blue",
    };
  });

  const leaveRowsRaw = (
    teamView
      ? (db
          .prepare(
            `SELECT lr.id, u.name, lt.name AS type, lr.start_date, lr.end_date, lr.status
             FROM leave_requests lr
             JOIN users u ON u.id = lr.user_id
             JOIN leave_types lt ON lt.id = lr.leave_type_id
             WHERE lr.start_date >= ?
             ORDER BY lr.created_at DESC LIMIT 8`
          )
          .all(monthStart) as any[])
      : (db
          .prepare(
            `SELECT lr.id, u.name, lt.name AS type, lr.start_date, lr.end_date, lr.status
             FROM leave_requests lr
             JOIN users u ON u.id = lr.user_id
             JOIN leave_types lt ON lt.id = lr.leave_type_id
             WHERE lr.user_id = ? AND lr.start_date >= ?
             ORDER BY lr.created_at DESC LIMIT 8`
          )
          .all(user.id, monthStart) as any[])
  );
  const leaveRows: DashLeaveRow[] = leaveRowsRaw.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    from: r.start_date,
    to: r.end_date,
    status: r.status,
  }));

  const upcoming = db
    .prepare(
      `SELECT lr.id, u.name, lt.name AS type, lr.start_date, lr.end_date
       FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.status IN ('approved','pending') AND lr.end_date >= ?
       ORDER BY lr.start_date ASC LIMIT 4`
    )
    .all(today) as any[];
  const events: DashEvent[] = upcoming.map((r) => ({
    id: r.id,
    title: `${r.name} · ${r.type}`,
    when: `${formatDate(r.start_date)}${r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ""}`,
    in: inLabel(r.start_date, today),
    color: "#1E6FE0",
  }));

  const firstName = (user.name || "there").split(" ")[0];

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex justify-end">
        <PushRegistration vapidPublicKey={getVapidPublicKey()} />
      </div>
      <DashboardView
        firstName={firstName}
        greeting={greetingForHour(parts.hour)}
        canPunch={has("attendance.punch")}
        today={record}
        factory={factory}
        kpis={{
          employees: people.length,
          hiredThisMonth,
          present: todayC.present,
          presentPct,
          onLeave: todayC.onLeave,
          leavePct,
          pending,
        }}
        sparks={sparks}
        overview={{ present: todayC.present, absent: todayC.absent, onLeave: todayC.onLeave }}
        activity={activity}
        balances={balances.map((b) => ({
          id: b.id,
          name: b.name,
          used: b.used,
          left: Math.max(0, b.balance),
          color: b.color || "#1E6FE0",
        }))}
        leaveRows={leaveRows}
        events={events}
        people={people.map((p) => ({ id: p.id, name: p.name, designation: p.designation || "" }))}
        canApprovals={has("approvals.view") || has("approvals.manage")}
        canLeaves={has("leaves.view") || has("leaves.apply")}
        canReports={has("reports.view")}
      />
    </div>
  );
}

function formatTimeSafe(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}
