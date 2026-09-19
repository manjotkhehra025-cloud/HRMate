import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, BarChart, Button, Card, Donut, EmptyState, Icon, LineChart, PageHeader, Progress,
  Ring, SectionTitle, SkeletonRows, Stat, StatusBadge, Tabs
} from '../ui/index.jsx';
import { compact, currency, fmtDateShort, minutesToHM, pct, titleCase } from '../lib/format.js';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#f43f5e', '#14b8a6', '#f97316', '#64748b'];
const METHOD_LABEL = { gps: 'GPS', face: 'Face ID', fingerprint: 'Fingerprint', pin: 'PIN', qr: 'QR badge', manual: 'Manual' };

function ChartCard({ title, subtitle, children, action }) {
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle && <p className="text-[11px] text-mute">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function AttendanceReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/attendance'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  const { rollup, totals, daily = [], byDepartment = [], byStatus = [], methodMix = [], geofence, topLate = [] } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="checkCircle" label="Person-days present" value={rollup.present} tone="emerald" hint={`${totals.personDays} scheduled`} />
        <Stat icon="clock" label="Hours worked" value={compact(totals.workedHours)} tone="brand" hint={`avg ${totals.avgDaily}h/day`} />
        <Stat icon="alert" label="Absent" value={rollup.absent} tone="rose" />
        <Stat icon="plane" label="On leave" value={rollup.leave} tone="amber" hint={`${rollup.wfh} WFH`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <ChartCard title="Daily attendance rate" subtitle={`${fmtDateShort(data.from)} → ${fmtDateShort(data.to)}`}>
          <LineChart
            data={daily}
            xKey="date"
            height={210}
            valueFormat={(v) => `${v}%`}
            keys={[{ key: 'rate', label: 'Attendance rate', color: 'var(--brand)' }]}
          />
        </ChartCard>
        <ChartCard title="Geofence compliance" subtitle="Punches taken inside a registered location">
          <div className="grid place-items-center">
            <Ring value={geofence.compliance} size={150} tone={geofence.compliance >= 80 ? 'emerald' : 'amber'}>
              <div className="text-center">
                <div className="text-2xl font-black">{geofence.compliance}%</div>
                <div className="text-[9px] font-bold text-mute">compliant</div>
              </div>
            </Ring>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div><div className="text-base font-black text-emerald-600">{geofence.inside}</div><div className="text-[10px] font-bold text-mute">Inside</div></div>
            <div><div className="text-base font-black text-amber-600">{geofence.outside}</div><div className="text-[10px] font-bold text-mute">Outside</div></div>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Attendance status mix" subtitle="Person-days by status">
          <Donut data={byStatus.map((s, i) => ({ label: titleCase(s.status), value: s.count, color: PALETTE[i % PALETTE.length] }))} />
        </ChartCard>
        <ChartCard title="Punch method mix" subtitle="How people clock in">
          <Donut data={methodMix.map((m, i) => ({ label: METHOD_LABEL[m.method] || m.method, value: m.count, color: PALETTE[(i + 3) % PALETTE.length] }))} />
        </ChartCard>
      </div>

      <Card padded={false}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold">Department breakdown</div>
          <p className="text-[11px] text-mute">Attendance rate and hours by department</p>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Department</th><th>People</th><th>Present</th><th>Late</th><th>Absent</th><th>On leave</th><th>Hours</th><th>Rate</th></tr></thead>
            <tbody>
              {byDepartment.map((d) => (
                <tr key={d.name}>
                  <td><span className="inline-flex items-center gap-2 font-bold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.name}</span></td>
                  <td>{d.employees}</td>
                  <td>{d.present}</td>
                  <td>{d.late}</td>
                  <td>{d.absent}</td>
                  <td>{d.on_leave}</td>
                  <td>{compact(d.hours)}h</td>
                  <td><Progress className="min-w-[70px]" height={6} value={d.rate} tone={d.rate >= 90 ? 'emerald' : d.rate >= 75 ? 'amber' : 'rose'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {topLate.length > 0 && (
        <Card padded={false}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="font-bold">Most late arrivals</div>
            <p className="text-[11px] text-mute">Top 8 by late minutes in the period</p>
          </div>
          <div className="divide-line">
            {topLate.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar person={p} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{p.full_name}</div>
                  <div className="truncate text-[10px] text-mute">{p.designation} · {p.department}</div>
                </div>
                <Badge tone="amber" size="sm">{p.late_days} days · {minutesToHM(p.late_minutes)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function LeaveReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/leave'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  const { totals, byType = [], byMonth = [], statusMix = [], balanceUtilisation = [], byDepartment = [] } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="plane" label="Requests" value={totals.requests} tone="brand" />
        <Stat icon="checkCircle" label="Approved" value={totals.approved} tone="emerald" />
        <Stat icon="clock" label="Pending" value={totals.pending} tone="amber" />
        <Stat icon="calendar" label="Days taken" value={totals.daysTaken} tone="violet" hint={`avg approval ${totals.avgApprovalHours}h`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Leave days by month" subtitle="Approved and applied days">
          <LineChart data={byMonth} xKey="month" height={200} keys={[{ key: 'days', label: 'Days', color: 'var(--brand)' }, { key: 'requests', label: 'Requests', color: '#f59e0b' }]} />
        </ChartCard>
        <ChartCard title="Request status" subtitle="Where every request ended up">
          <Donut data={statusMix.map((s, i) => ({ label: titleCase(s.status), value: s.count, color: PALETTE[i % PALETTE.length] }))} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Days by leave type" subtitle="Total approved days">
          <BarChart data={byType} xKey="name" height={210} keys={byType.map((t) => ({ key: 'days', label: t.name, color: t.color }))} valueFormat={(v) => `${v}d`} />
        </ChartCard>
        <ChartCard title="Days by department" subtitle="Who is taking the most time off">
          <BarChart data={byDepartment} xKey="name" height={210} horizontal keys={[{ key: 'days', label: 'Days', color: '#ec4899' }]} valueFormat={(v) => `${v}d`} />
        </ChartCard>
      </div>

      <Card padded={false}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold">Balance utilisation</div>
          <p className="text-[11px] text-mute">Entitled versus used across the company</p>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Type</th><th>Entitled (days)</th><th>Used</th><th>Pending</th><th>Utilisation</th></tr></thead>
            <tbody>
              {balanceUtilisation.map((b) => (
                <tr key={b.code}>
                  <td><span className="inline-flex items-center gap-2 font-bold">{b.icon} {b.name}</span></td>
                  <td>{b.entitled}</td>
                  <td>{b.used}</td>
                  <td>{b.pending}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Progress className="min-w-[80px]" height={6} value={b.utilisation} tone={b.utilisation > 85 ? 'rose' : b.utilisation > 60 ? 'amber' : 'emerald'} />
                      <span className="text-xs font-bold">{b.utilisation}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HeadcountReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/headcount'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  const months = [...new Set([...data.joiners.map((j) => j.month), ...data.exits.map((e) => e.month)])].sort();
  const flow = months.map((m) => ({
    month: m,
    joiners: data.joiners.find((j) => j.month === m)?.joiners || 0,
    exits: data.exits.find((e) => e.month === m)?.exits || 0
  }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="users" label="Headcount" value={data.total} tone="brand" />
        <Stat icon="plus" label="New joiners (30d)" value={data.newJoiners30} tone="emerald" />
        <Stat icon="logout" label="Exits (12m)" value={data.exits12m} tone="rose" hint={`attrition ${data.attrition}%`} />
        <Stat icon="cash" label="Average salary" value={currency(data.avgSalary)} tone="violet" hint={`diversity ${data.diversity}%`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Joiners vs exits" subtitle="Monthly movement over the last 12 months">
          <LineChart data={flow} xKey="month" height={200} keys={[{ key: 'joiners', label: 'Joiners', color: '#10b981' }, { key: 'exits', label: 'Exits', color: '#f43f5e' }]} />
        </ChartCard>
        <ChartCard title="Headcount by department">
          <BarChart data={data.byDepartment} xKey="name" height={210} horizontal keys={[{ key: 'headcount', label: 'People', color: 'var(--brand)' }]} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard title="By role">
          <Donut size={150} data={data.byRole.map((r, i) => ({ label: titleCase(r.role), value: r.count, color: PALETTE[i % PALETTE.length] }))} />
        </ChartCard>
        <ChartCard title="By location">
          <Donut size={150} data={data.byLocation.map((l, i) => ({ label: l.name, value: l.count, color: PALETTE[(i + 2) % PALETTE.length] }))} />
        </ChartCard>
        <ChartCard title="By work mode">
          <Donut size={150} data={data.byWorkMode.map((w, i) => ({ label: titleCase(w.work_mode), value: w.count, color: PALETTE[(i + 4) % PALETTE.length] }))} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Tenure bands" subtitle="How long people stay">
          <BarChart data={data.byTenure} xKey="band" height={190} keys={[{ key: 'count', label: 'People', color: '#8b5cf6' }]} />
        </ChartCard>
        <Card padded={false}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="font-bold">Department composition</div>
            <p className="text-[11px] text-mute">Full-time share, gender mix and average salary</p>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Department</th><th>People</th><th>Full-time</th><th>Female</th><th>Avg salary</th></tr></thead>
              <tbody>
                {data.byDepartment.map((d) => (
                  <tr key={d.name}>
                    <td><span className="inline-flex items-center gap-2 font-bold">{d.icon} {d.name}</span></td>
                    <td>{d.headcount}</td>
                    <td>{d.full_time}</td>
                    <td>{d.female}</td>
                    <td>{currency(d.avg_salary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PayrollReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/payroll'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  const { rows = [], totals, month } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="users" label="Employees paid" value={rows.length} tone="brand" hint={month} />
        <Stat icon="cash" label="Gross" value={currency(totals.gross)} tone="indigo" />
        <Stat icon="clock" label="Overtime pay" value={currency(totals.otPay)} tone="amber" />
        <Stat icon="money" label="Net payable" value={currency(totals.net)} tone="emerald" hint={`LOP −${currency(totals.lop)}`} />
      </div>
      <Card padded={false}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold">Payroll run · {month}</div>
          <p className="text-[11px] text-mute">Pro-rated on attendance, overtime and loss of pay</p>
        </div>
        <div className="scroll-x">
          <table className="table">
            <thead><tr><th>Employee</th><th>Department</th><th>Days</th><th>Hours</th><th>OT</th><th>Leave</th><th>Late min</th><th>Gross</th><th>LOP</th><th>Net</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-bold">{r.full_name}</div>
                    <div className="text-[10px] text-mute">{r.emp_code} · {r.designation}</div>
                  </td>
                  <td>{r.department}</td>
                  <td>{r.days_worked}</td>
                  <td>{minutesToHM(r.minutes)}</td>
                  <td>{r.ot ? minutesToHM(r.ot) : '—'}</td>
                  <td>{r.leave_days}</td>
                  <td>{r.late_minutes}</td>
                  <td>{currency(r.gross)}</td>
                  <td className="text-rose-500">{r.lop ? `−${currency(r.lop)}` : '—'}</td>
                  <td className="font-bold">{currency(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PerformanceReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/performance'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="star" label="Average rating" value={`${data.avgRating} / 5`} tone="amber" />
        <Stat icon="target" label="Goal completion" value={`${data.goalCompletion}%`} tone="brand" />
        <Stat icon="trophy" label="Top performers" value={data.topPerformers.length} tone="emerald" />
        <Stat icon="alert" label="Needs attention" value={data.needsAttention.length} tone="rose" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Goal status" subtitle="Count and average progress per status">
          <BarChart data={data.goals} xKey="status" height={200} keys={[{ key: 'count', label: 'Goals', color: 'var(--brand)' }, { key: 'avg_progress', label: 'Avg progress', color: '#10b981' }]} />
        </ChartCard>
        <ChartCard title="Rating by department">
          <BarChart data={data.byDepartment} xKey="name" height={200} horizontal keys={[{ key: 'rating', label: 'Rating', color: '#8b5cf6' }]} valueFormat={(v) => `${v}★`} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Most common skills" subtitle="Self-declared skills across the company">
          <BarChart data={data.skills.slice(0, 10)} xKey="name" height={210} horizontal keys={[{ key: 'count', label: 'People', color: '#0ea5e9' }]} />
        </ChartCard>
        <Card padded={false}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="font-bold">Top performers</div>
            <p className="text-[11px] text-mute">Highest average review rating</p>
          </div>
          {data.topPerformers.length ? (
            <div className="divide-line">
              {data.topPerformers.slice(0, 8).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 text-center text-xs font-black text-mute">{i + 1}</span>
                  <Avatar person={p} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">{p.full_name}</div>
                    <div className="truncate text-[10px] text-mute">{p.designation} · {p.reviews} reviews</div>
                  </div>
                  <Badge tone="amber" size="sm">★ {p.rating}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4"><EmptyState icon="trophy" title="No ratings yet" message="Publish reviews to populate this list." compact /></div>
          )}
        </Card>
      </div>
    </div>
  );
}

function HelpdeskReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/helpdesk'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  const { totals, byStatus = [], byCategory = [], byPriority = [], byMonth = [] } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="ticket" label="Open tickets" value={totals.open} tone="brand" />
        <Stat icon="checkCircle" label="Resolved" value={totals.resolved} tone="emerald" />
        <Stat icon="star" label="Avg rating" value={`${totals.avgRating} / 5`} tone="amber" />
        <Stat icon="clock" label="Avg resolution" value={`${Math.round(totals.avgResolutionHours)}h`} tone="rose" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Tickets by month">
          <LineChart data={byMonth} xKey="month" height={190} keys={[{ key: 'count', label: 'Tickets', color: 'var(--brand)' }]} />
        </ChartCard>
        <ChartCard title="By status">
          <Donut data={byStatus.map((s, i) => ({ label: titleCase(s.status), value: s.count, color: PALETTE[i % PALETTE.length] }))} />
        </ChartCard>
        <ChartCard title="By category" subtitle="Average satisfaction per category">
          <BarChart data={byCategory} xKey="category" height={200} keys={[{ key: 'count', label: 'Tickets', color: '#0ea5e9' }, { key: 'rating', label: 'Rating', color: '#f59e0b' }]} />
        </ChartCard>
        <ChartCard title="By priority">
          <Donut data={byPriority.map((p, i) => ({ label: titleCase(p.priority), value: p.count, color: ['#f43f5e', '#f59e0b', '#64748b'][i] || PALETTE[i] }))} />
        </ChartCard>
      </div>
    </div>
  );
}

function EngagementReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/engagement'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  const { posts = [], kudos = [], values = [], participation } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="chat" label="Active posters" value={participation.posters} tone="brand" hint={`of ${participation.headcount}`} />
        <Stat icon="sparkles" label="Kudo givers" value={participation.kudoGivers} tone="amber" />
        <Stat icon="heart" label="Kudo receivers" value={participation.kudoReceivers} tone="rose" />
        <Stat icon="users" label="Participation" value={pct(Math.round((participation.kudoGivers / Math.max(1, participation.headcount)) * 100))} tone="emerald" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Posts per month">
          <LineChart data={posts} xKey="month" height={190} keys={[{ key: 'posts', label: 'Posts', color: 'var(--brand)' }]} />
        </ChartCard>
        <ChartCard title="Kudos and points">
          <LineChart data={kudos} xKey="month" height={190} keys={[{ key: 'kudos', label: 'Kudos', color: '#f59e0b' }, { key: 'points', label: 'Points', color: '#10b981' }]} />
        </ChartCard>
      </div>
      <ChartCard title="Values recognised" subtitle="Which company values get celebrated most">
        <BarChart data={values} xKey="value" height={210} horizontal keys={[{ key: 'count', label: 'Kudos', color: '#ec4899' }]} />
      </ChartCard>
    </div>
  );
}

function WorkforceReport() {
  const { data, loading } = useResource(() => api.get('/api/reports/workforce'), []);
  if (loading || !data) return <SkeletonRows rows={8} />;
  const { shifts = [], coverage = [], overtime = [], swaps, utilisation } = data;
  const util = utilisation.capacityHours ? Math.round((utilisation.scheduledHours / utilisation.capacityHours) * 100) : 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="calendar" label="Scheduled hours" value={compact(utilisation.scheduledHours)} tone="brand" />
        <Stat icon="layers" label="Capacity hours" value={compact(utilisation.capacityHours)} tone="indigo" />
        <Stat icon="trending" label="Utilisation" value={pct(util)} tone={util > 90 ? 'rose' : 'emerald'} />
        <Stat icon="swap" label="Swap requests" value={swaps.pending} tone="amber" hint={`${swaps.approved} approved`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Coverage vs leave" subtitle="Scheduled staff against approved leave">
          <LineChart data={coverage} xKey="date" height={200} keys={[{ key: 'scheduled', label: 'Scheduled', color: 'var(--brand)' }, { key: 'onLeave', label: 'On leave', color: '#f59e0b' }]} />
        </ChartCard>
        <Card padded={false}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="font-bold">Shift load</div>
            <p className="text-[11px] text-mute">Headcount assigned to each shift</p>
          </div>
          <div className="divide-line">
            {shifts.map((s) => (
              <div key={s.name} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{s.name}</div>
                  <div className="text-[10px] text-mute">{s.start_time}–{s.end_time} · {s.work_hours}h</div>
                </div>
                <Badge tone="brand" size="sm">{s.employees} people</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold">Overtime leaders</div>
          <p className="text-[11px] text-mute">Extra hours worked in the period</p>
        </div>
        {overtime.length ? (
          <div className="divide-line">
            {overtime.slice(0, 10).map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar person={o} size={32} />
                <div className="min-w-0 flex-1 truncate text-xs font-bold">{o.full_name}</div>
                <Badge tone="amber" size="sm">{o.hours}h over {o.requests} shifts</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4"><EmptyState icon="clock" title="No overtime recorded" message="Nobody exceeded their scheduled hours." compact /></div>
        )}
      </Card>
    </div>
  );
}

const REPORTS = [
  { key: 'attendance', label: 'Attendance', icon: '⏰', perm: null, Comp: AttendanceReport },
  { key: 'leave', label: 'Leave', icon: '🌴', perm: null, Comp: LeaveReport },
  { key: 'headcount', label: 'Headcount', icon: '👥', perm: null, Comp: HeadcountReport },
  { key: 'workforce', label: 'Workforce', icon: '🗓️', perm: null, Comp: WorkforceReport },
  { key: 'performance', label: 'Performance', icon: '📈', perm: null, Comp: PerformanceReport },
  { key: 'engagement', label: 'Engagement', icon: '💬', perm: null, Comp: EngagementReport },
  { key: 'helpdesk', label: 'Helpdesk', icon: '🎫', perm: null, Comp: HelpdeskReport },
  { key: 'payroll', label: 'Payroll', icon: '💰', perm: 'report.payroll', Comp: PayrollReport }
];

export default function Reports() {
  const { can, toast } = useStore();
  const [key, setKey] = useState('attendance');
  const visible = REPORTS.filter((r) => !r.perm || can(r.perm));
  const active = visible.find((r) => r.key === key) || visible[0];
  const Active = active?.Comp;

  const exportCsv = async () => {
    try {
      const res = await api.get(`/api/reports/export?kind=${active.key}`);
      const rows = Array.isArray(res.rows) ? res.rows : Object.entries(res).flatMap(([k, v]) => (Array.isArray(v) ? v : [{ key: k, value: JSON.stringify(v) }]));
      if (!rows.length) {
        toast('Nothing to export', 'warn');
        return;
      }
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${active.key}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported ${rows.length} rows`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page page-wide">
      <PageHeader
        icon="chart"
        title="Reports & analytics"
        subtitle="Attendance, leave, headcount, payroll and engagement insights"
        actions={
          <Button icon="download" onClick={exportCsv}>Export {active?.label}</Button>
        }
      />

      <Tabs className="mb-4" active={active?.key} onChange={setKey} tabs={visible.map((r) => ({ key: r.key, label: r.label, icon: r.icon }))} />

      {Active ? <Active /> : <Card><EmptyState icon="lock" title="No reports available" message="Your role does not have report access." /></Card>}
    </div>
  );
}
