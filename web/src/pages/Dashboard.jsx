import React, { useMemo, useState } from 'react';
import { api, qs } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, BarChart, Button, Card, Donut, EmptyState, Icon, IconButton, LineChart, ListRow,
  PageHeader, Progress, Ring, SectionTitle, SkeletonGrid, SkeletonRows, Stat, StatusBadge
} from '../ui/index.jsx';
import { countdown, fmtDateShort, fmtTime, minutesToHM, relative, todayISO } from '../lib/format.js';

const greeting = () => {
  const h = new Date().getUTCHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

function PunchHero({ data, reload, onOpenPunch }) {
  const { t, employee } = useStore();
  const state = data?.punchState || 'not_punched';
  const worked = data?.workedMinutes || 0;
  const expected = data?.expectedMinutes || 480;
  const progress = Math.min(100, Math.round((worked / expected) * 100));
  const tone = state === 'working' ? 'emerald' : state === 'completed' ? 'sky' : 'amber';
  const att = data?.attendance;

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative px-5 pb-5 pt-5" style={{ background: 'linear-gradient(135deg, var(--brand-soft), transparent 70%)' }}>
        <div className="flex items-start gap-4">
          <Ring value={progress} size={92} tone={tone}>
            <div>
              <div className="text-lg font-black leading-none">{Math.floor(worked / 60)}h</div>
              <div className="text-[10px] font-bold text-mute">{String(worked % 60).padStart(2, '0')}m</div>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={state === 'working' ? 'present' : state === 'completed' ? 'wfh' : 'not_punched'} label={t(`attendance.${state === 'working' ? 'working' : state === 'completed' ? 'completed' : 'notPunched'}`)} />
              {data?.shift && <Badge tone="indigo">{data.shift.name} · {data.shift.start_time}–{data.shift.end_time}</Badge>}
              {data?.holiday && <Badge tone="violet">🎉 {data.holiday.name}</Badge>}
              {data?.onLeave && <Badge tone="sky">{data.onLeave.icon} {data.onLeave.leave_name}</Badge>}
            </div>
            <p className="mt-2 text-sm font-bold">
              {att?.first_in ? `In ${fmtTime(att.first_in)}` : 'No punch recorded yet'}
              {att?.last_out ? ` · Out ${fmtTime(att.last_out)}` : state === 'working' ? ' · still on the clock' : ''}
            </p>
            <p className="mt-0.5 text-xs text-mute">
              {data?.location?.name || 'Remote'} · geofence {data?.geofenceRadius || 250}m
              {att?.in_method ? ` · last verified via ${att.in_method}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" icon={state === 'working' ? 'logout' : 'fingerprint'} onClick={onOpenPunch}>
                {state === 'working' ? t('attendance.punchOut') : state === 'completed' ? 'View punches' : t('attendance.punchIn')}
              </Button>
              {state === 'not_punched' && (
                <Button variant="outline" icon="history" onClick={() => (window.location.hash = '/attendance')}>
                  {t('attendance.regularize')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="scroll-x no-scrollbar mt-4">
          {(data?.weekPreview || []).map((d) => (
            <div
              key={d.date}
              className="min-w-[76px] rounded-xl border px-2.5 py-2 text-center"
              style={{
                borderColor: d.date === data.date ? 'var(--brand)' : 'var(--border)',
                background: d.date === data.date ? 'var(--brand-soft)' : 'var(--surface)'
              }}
            >
              <div className="text-[10px] font-bold uppercase text-mute">{new Date(`${d.date}T00:00:00Z`).toUTCString().slice(0, 3)}</div>
              <div className="text-sm font-black">{d.date.slice(8, 10)}</div>
              <div className="mt-1 text-[10px] font-bold text-mute">
                {d.status === 'none' ? '—' : d.status.replace(/_/g, ' ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function QuickActions() {
  const { t, can } = useStore();
  const items = [
    { to: '/attendance', icon: 'clock', label: 'Punch in / out', tone: 'emerald' },
    { to: '/leaves', icon: 'calendarCheck', label: 'Apply leave', tone: 'sky' },
    { to: '/roster', icon: 'grid', label: 'My roster', tone: 'violet' },
    { to: '/id-card', icon: 'idCard', label: 'My ID card', tone: 'indigo' },
    { to: '/goals', icon: 'target', label: 'My KRA goals', tone: 'amber' },
    { to: '/helpdesk', icon: 'ticket', label: 'Raise ticket', tone: 'rose' },
    { to: '/approvals', icon: 'checkCircle', label: 'Approvals', tone: 'teal', perm: 'approval.approve' },
    { to: '/reports', icon: 'chart', label: 'Reports', tone: 'sky', perm: 'report.team' },
    { to: '/star-workers', icon: 'star', label: 'Give kudos', tone: 'amber' },
    { to: '/documents', icon: 'document', label: 'Upload doc', tone: 'slate' }
  ];
  const visible = items.filter((i) => !i.perm || can(i.perm)).slice(0, 8);
  return (
    <div className="grid grid-cols-4 gap-2">
      {visible.map((i) => (
        <button
          key={i.to + i.label}
          type="button"
          onClick={() => (window.location.hash = i.to)}
          className="card flex flex-col items-center gap-1.5 p-3 text-center transition hover:-translate-y-0.5 active:scale-[.97]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl soft" style={{ color: 'var(--brand)' }}>
            <Icon name={i.icon} size={18} />
          </span>
          <span className="text-[10px] font-bold leading-tight">{i.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t, employee, can } = useStore();
  const [punchOpen, setPunchOpen] = useState(false);
  const { data, loading, error, reload } = useResource(() => api.get('/api/dashboard'), []);

  const trend = useMemo(
    () =>
      (data?.trends || []).map((d) => ({
        label: d.date.slice(8, 10),
        present: d.present,
        leave: d.leave,
        absent: d.absent,
        rate: d.rate
      })),
    [data]
  );

  if (loading && !data) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" />
        <SkeletonGrid count={4} />
        <div className="mt-4">
          <SkeletonRows rows={6} />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <EmptyState icon="alert" title="Couldn't load your dashboard" message={error.message} action={<Button variant="primary" icon="refresh" onClick={() => reload()}>Retry</Button>} />
      </div>
    );
  }

  const k = data.kpis;
  const hour = new Date().getUTCHours();
  const salutation = t(`dashboard.${greeting()}`);

  return (
    <div className="page">
      <PageHeader
        title={`${salutation !== `dashboard.${greeting()}` ? salutation[0].toUpperCase() + salutation.slice(1) : 'Good ' + greeting()}, ${employee?.first_name} 👋`}
        subtitle={`${fmtDateShort(todayISO())} · ${employee?.department_name || ''} ${employee?.shift ? `· ${employee.shift.name}` : ''}`}
        actions={
          <>
            <IconButton icon="refresh" label="Refresh" onClick={() => reload({ silent: true })} />
            <Button variant="primary" icon="fingerprint" onClick={() => setPunchOpen(true)}>
              {data.myDay.punchState === 'working' ? t('attendance.punchOut') : t('attendance.punchIn')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PunchHero data={data.myDay} reload={reload} onOpenPunch={() => (window.location.hash = '/attendance')} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon="users" label={t('dashboard.headcount')} value={k.headcount} tone="indigo" onClick={() => (window.location.hash = '/employees')} />
            <Stat icon="checkCircle" label={t('dashboard.present')} value={k.presentToday} tone="emerald" hint={`${k.attendanceRate}% avg (14d)`} onClick={() => (window.location.hash = '/attendance')} />
            <Stat icon="calendarCheck" label={t('dashboard.onLeave')} value={k.onLeave} tone="sky" onClick={() => (window.location.hash = '/leaves')} />
            <Stat icon="check" label={t('dashboard.pendingApprovals')} value={k.pendingApprovals} tone={k.pendingApprovals ? 'amber' : 'slate'} onClick={() => (window.location.hash = '/approvals')} />
          </div>

          <Card>
            <SectionTitle
              icon="trending"
              title={t('dashboard.trend')}
              subtitle="Present vs leave vs absent over the last 14 days"
              action={<Badge tone="emerald">{k.attendanceRate}% avg</Badge>}
            />
            <BarChart
              data={trend}
              xKey="label"
              height={170}
              keys={[
                { key: 'present', label: 'Present', color: 'var(--success)' },
                { key: 'leave', label: 'On leave', color: '#0ea5e9' },
                { key: 'absent', label: 'Absent', color: '#fb7185' }
              ]}
            />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <SectionTitle icon="megaphone" title={t('dashboard.announcements')} action={<button type="button" className="text-xs font-bold" style={{ color: 'var(--brand)' }} onClick={() => (window.location.hash = '/announcements')}>{t('common.viewAll')}</button>} />
              <div className="divide-line">
                {(data.announcements || []).slice(0, 4).map((a) => (
                  <div key={a.id} className="py-2.5">
                    <div className="flex items-start gap-2">
                      {a.pinned ? <Icon name="pin" size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} /> : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{a.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-mute">{a.body}</p>
                        <p className="mt-1 text-[10px] font-semibold text-mute">{a.author} · {relative(a.publish_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle icon="star" title={t('dashboard.starWorkers')} subtitle="Top recognised this month" action={<button type="button" className="text-xs font-bold" style={{ color: 'var(--brand)' }} onClick={() => (window.location.hash = '/star-workers')}>{t('common.viewAll')}</button>} />
              {data.starWorkers?.length ? (
                <ol className="space-y-1">
                  {data.starWorkers.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-[var(--surface-2)]">
                      <span className="w-4 text-center text-xs font-black text-mute">{i + 1}</span>
                      <Avatar person={s} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{s.full_name}</span>
                        <span className="block truncate text-[11px] text-mute">{s.designation}</span>
                      </span>
                      <Badge tone="amber">⭐ {s.points}</Badge>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState compact icon="star" title="No recognition yet" message="Send kudos from the Star workers tab." />
              )}
            </Card>
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-4">
          <Card>
            <SectionTitle icon="sparkle" title="Quick actions" />
            <QuickActions />
          </Card>

          <Card>
            <SectionTitle icon="calendarCheck" title={t('dashboard.myLeaves')} subtitle={`${new Date().getUTCFullYear()} entitlement`} />
            {data.myDay.balances?.length ? (
              <div className="space-y-3">
                {data.myDay.balances.slice(0, 5).map((b) => (
                  <div key={b.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        {b.icon} {b.name}
                      </span>
                      <span className="font-bold text-mute">
                        {b.available} / {b.entitled}
                      </span>
                    </div>
                    <Progress value={b.entitled ? (b.used / b.entitled) * 100 : 0} height={6} tone={b.available <= 1 ? 'rose' : 'indigo'} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon="calendar" title="No balances yet" />
            )}
            <Button className="mt-3 w-full" icon="plus" onClick={() => (window.location.hash = '/leaves')}>
              {t('leave.apply')}
            </Button>
          </Card>

          {can('approval.inbox') && (
            <Card>
              <SectionTitle
                icon="checkCircle"
                title="Waiting on you"
                subtitle={`${k.pendingApprovals} pending · ${k.myPendingLeaves} leave`}
                action={<button type="button" className="text-xs font-bold" style={{ color: 'var(--brand)' }} onClick={() => (window.location.hash = '/approvals')}>Open</button>}
              />
              {k.pendingApprovals ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl soft px-3 py-2.5 text-sm">
                    <span className="font-semibold">Pending requests</span>
                    <Badge tone="amber">{k.pendingApprovals}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-xl soft px-3 py-2.5 text-sm">
                    <span className="font-semibold">Open helpdesk tickets</span>
                    <Badge tone="sky">{k.openTickets}</Badge>
                  </div>
                </div>
              ) : (
                <EmptyState compact icon="checkCircle" title={t('approvals.empty')} message="Everything is cleared. Nice work." />
              )}
            </Card>
          )}

          <Card>
            <SectionTitle icon="users" title={t('dashboard.teamActivity')} subtitle="Who is on the clock right now" />
            {data.team?.length ? (
              <div className="divide-line -mx-1">
                {data.team.slice(0, 6).map((p) => (
                  <ListRow
                    key={p.id}
                    dense
                    person={p}
                    title={p.full_name}
                    subtitle={`${p.designation || ''} ${p.shift_name ? `· ${p.shift_name}` : ''}`}
                    right={<StatusBadge status={p.status} />}
                    onClick={() => (window.location.hash = `/employees/${p.id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState compact icon="users" title="Nobody on the clock" message="Team activity appears once people punch in." />
            )}
          </Card>

          <Card>
            <SectionTitle icon="building" title="Department load" subtitle="Today's presence by team" />
            <BarChart
              horizontal
              data={(data.departmentLoad || []).map((d) => ({ label: d.name, value: d.present, headcount: d.headcount }))}
              xKey="label"
              keys={[{ key: 'value', label: 'Present', color: 'var(--brand)' }]}
              valueFormat={(v) => `${v}`}
            />
          </Card>

          {(data.upcomingLeaves?.length > 0 || data.holidays?.length > 0) && (
            <Card>
              <SectionTitle icon="calendar" title={t('dashboard.upcomingLeaves')} subtitle="Next scheduled time off" />
              <div className="divide-line">
                {(data.upcomingLeaves || []).slice(0, 4).map((l) => (
                  <div key={l.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base" style={{ background: `${l.color}22` }}>
                      {l.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.full_name}</p>
                      <p className="truncate text-[11px] text-mute">
                        {l.name} · {fmtDateShort(l.start_date)} → {fmtDateShort(l.end_date)}
                      </p>
                    </div>
                    <Badge tone="sky">{countdown(l.start_date)}</Badge>
                  </div>
                ))}
                {(data.holidays || []).slice(0, 2).map((h) => (
                  <div key={h.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base" style={{ background: `${h.color}22` }}>🎉</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{h.name}</p>
                      <p className="truncate text-[11px] text-mute">Company holiday</p>
                    </div>
                    <Badge tone="violet">{countdown(h.date)}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle icon="calendar" title="Coming up" />
            {data.events?.length ? (
              <div className="divide-line">
                {data.events.slice(0, 4).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="h-8 w-1 rounded-full" style={{ background: e.color || 'var(--brand)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.title}</p>
                      <p className="truncate text-[11px] text-mute">
                        {fmtDateShort(e.date)} {e.start_time ? `· ${e.start_time}–${e.end_time}` : '· all day'} {e.location ? `· ${e.location}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon="calendar" title="Nothing scheduled" />
            )}
            <Button className="mt-2 w-full" onClick={() => (window.location.hash = '/calendar')}>
              Open calendar
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
