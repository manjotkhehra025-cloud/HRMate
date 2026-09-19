import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource, useGeolocation, useNow } from '../lib/hooks.js';
import {
  Avatar, Badge, BarChart, Button, Card, Donut, EmptyState, Icon, IconButton, Input, Modal,
  PageHeader, Progress, Ring, SearchInput, Segmented, Select, SkeletonRows, Stat, StatusBadge, Tabs, DataTable
} from '../ui/index.jsx';
import { addDaysISO, fmtDate, fmtDateShort, fmtTime, minutesToHM, pct, relative, STATUS_TONE, todayISO } from '../lib/format.js';

const METHODS = [
  { key: 'face', label: 'Face ID', icon: 'face', tone: 'violet' },
  { key: 'fingerprint', label: 'Fingerprint', icon: 'fingerprint', tone: 'indigo' },
  { key: 'gps', label: 'GPS + selfie', icon: 'pin', tone: 'emerald' },
  { key: 'pin', label: 'App PIN', icon: 'lock', tone: 'sky' },
  { key: 'manual', label: 'Manual entry', icon: 'edit', tone: 'slate' }
];

function BiometricScan({ method, onDone, onCancel }) {
  const [stage, setStage] = useState(0);
  const score = useRef(Number((0.93 + Math.random() * 0.06).toFixed(3)));
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1100),
      setTimeout(() => setStage(3), 1700),
      setTimeout(() => onDone(score.current), 2200)
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);
  const labels = {
    face: ['Look at the camera', 'Hold still — liveness check', 'Matching template', 'Verified'],
    fingerprint: ['Place your finger on the sensor', 'Reading ridges', 'Matching template', 'Verified']
  };
  return (
    <div className="grid place-items-center py-4 text-center">
      <div className="relative grid h-48 w-48 place-items-center overflow-hidden rounded-[2rem] border-2" style={{ borderColor: 'var(--brand)' }}>
        <div className="punch-ring absolute inset-0" />
        <Icon name={method === 'face' ? 'face' : 'fingerprint'} size={92} style={{ color: 'var(--brand)' }} />
        <span className="scan-line absolute inset-x-0 h-0.5 animate-scan" />
        {stage >= 3 && (
          <span className="absolute inset-0 grid place-items-center bg-emerald-500/15 backdrop-blur-[1px]">
            <Icon name="checkCircle" size={64} className="text-emerald-500" />
          </span>
        )}
      </div>
      <p className="mt-4 text-sm font-bold">{labels[method][stage]}</p>
      <div className="mt-2 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 w-8 rounded-full transition" style={{ background: i <= stage ? 'var(--brand)' : 'var(--border)' }} />
        ))}
      </div>
      <button type="button" className="mt-4 text-xs font-bold text-mute hover:underline" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function PunchCard({ today, onPunched }) {
  const { t, employee, toast } = useStore();
  const [method, setMethod] = useState('face');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState(null);
  const [checking, setChecking] = useState(false);
  const now = useNow(1000);
  const fallbackCoords = today?.location?.latitude
    ? { latitude: today.location.latitude, longitude: today.location.longitude, accuracy: 25 }
    : { latitude: 12.9279, longitude: 77.6271, accuracy: 40 };
  const loc = useGeolocation({ fallback: fallbackCoords });

  const state = today?.punchState || 'not_punched';
  const att = today?.attendance;
  const worked = today?.workedMinutes || 0;
  const expected = today?.expectedMinutes || 480;
  const live = att?.first_in && !att?.last_out ? Math.round((now - new Date(att.first_in).getTime()) / 60000) : worked;
  const secs = att?.first_in && !att?.last_out ? Math.floor((now - new Date(att.first_in).getTime()) / 1000) % 60 : 0;

  const probeGeofence = async (coords) => {
    setChecking(true);
    try {
      const res = await api.get(`/api/geofence/check?latitude=${coords.latitude}&longitude=${coords.longitude}`);
      setGeo(res);
      return res;
    } catch {
      setGeo(null);
      return null;
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!today) return;
    probeGeofence(loc.coords || fallbackCoords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today?.date]);

  const doPunch = async (type, score = null) => {
    setBusy(true);
    const coords = loc.coords || fallbackCoords;
    try {
      const res = await api.post('/api/attendance/punch', {
        type,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        method,
        score: score ?? (method === 'face' || method === 'fingerprint' ? 0.97 : null)
      });
      toast(res.message || (type === 'in' ? 'Punched in' : 'Punched out'), res.geofence?.ok ? 'success' : 'warn');
      await onPunched();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
      setScanning(false);
    }
  };

  const onPunch = async () => {
    const type = state === 'working' ? 'out' : 'in';
    if (method === 'face' || method === 'fingerprint') {
      setScanning(true);
      return;
    }
    await doPunch(type);
  };

  const geoOk = geo?.ok;

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative px-5 py-6 text-center" style={{ background: 'linear-gradient(160deg, var(--brand-soft), transparent 65%)' }}>
        <div className="mx-auto flex max-w-md flex-col items-center">
          <div className="relative">
            <Ring value={Math.min(100, (live / expected) * 100)} size={168} stroke={12} tone={state === 'working' ? 'emerald' : state === 'completed' ? 'sky' : 'amber'}>
              <div>
                <div className="text-3xl font-black leading-none tracking-tight">
                  {Math.floor(live / 60)}:{String(live % 60).padStart(2, '0')}
                  {state === 'working' && <span className="text-base text-mute">:{String(secs).padStart(2, '0')}</span>}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-mute">{t('attendance.worked')}</div>
              </div>
            </Ring>
            {state === 'working' && (
              <span className="absolute right-3 top-3 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-emerald-500" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <StatusBadge
              status={state === 'working' ? 'present' : state === 'completed' ? 'wfh' : 'not_punched'}
              label={t(state === 'working' ? 'attendance.working' : state === 'completed' ? 'attendance.completed' : 'attendance.notPunched')}
            />
            {today?.shift && <Badge tone="indigo">{today.shift.name} · {today.shift.start_time}–{today.shift.end_time}</Badge>}
            {today?.holiday && <Badge tone="violet">🎉 {today.holiday.name}</Badge>}
            {today?.onLeave && <Badge tone="sky">{today.onLeave.icon} {today.onLeave.leave_name}</Badge>}
          </div>

          <p className="mt-3 text-xs text-mute">
            {att?.first_in ? `In ${fmtTime(att.first_in)}` : 'Not punched in yet'}
            {att?.last_out ? ` · Out ${fmtTime(att.last_out)}` : ''} · {today?.location?.name || 'Remote'}
          </p>

          <div
            className="mt-3 flex w-full max-w-sm items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left"
            style={{ borderColor: geoOk ? 'rgba(5,150,105,.35)' : 'rgba(217,119,6,.35)', background: geoOk ? 'rgba(5,150,105,.07)' : 'rgba(217,119,6,.07)' }}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: geoOk ? 'rgba(5,150,105,.15)' : 'rgba(217,119,6,.15)', color: geoOk ? 'var(--success)' : 'var(--warn)' }}>
              <Icon name="mapPin" size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold">{checking ? 'Locating…' : geoOk ? t('attendance.insideFence') : t('attendance.outsideFence')}</span>
              <span className="block truncate text-[11px] text-mute">
                {geo?.location ? `${geo.location.name} · ${Math.round(geo.distance ?? 0)}m away · radius ${geo.radius}m` : loc.source === 'fallback' ? 'Using registered office location' : 'Waiting for GPS…'}
              </span>
            </span>
            <IconButton icon="refresh" label="Refresh location" onClick={() => loc.locate()} />
          </div>

          <div className="mt-4 w-full max-w-sm">
            <span className="label">{t('attendance.method')}</span>
            <div className="grid grid-cols-5 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className="flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-bold transition active:scale-95"
                  style={{
                    borderColor: method === m.key ? 'var(--brand)' : 'var(--border)',
                    background: method === m.key ? 'var(--brand-soft)' : 'var(--surface)',
                    color: method === m.key ? 'var(--brand)' : 'var(--text-soft)'
                  }}
                >
                  <Icon name={m.icon} size={17} />
                  {m.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            className="mt-4 w-full max-w-sm py-3.5 text-base"
            icon={state === 'working' ? 'logout' : 'fingerprint'}
            loading={busy}
            disabled={state === 'completed' || !!today?.onLeave}
            onClick={onPunch}
          >
            {state === 'working' ? t('attendance.punchOut') : state === 'completed' ? t('attendance.completed') : t('attendance.punchIn')}
          </Button>
          {today?.onLeave && <p className="mt-2 text-[11px] font-semibold text-mute">You are on approved leave today — punching is disabled.</p>}
        </div>
      </div>

      {att?.punches?.length > 0 && (
        <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-mute">Today's punch log</p>
          <ol className="relative space-y-3 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
            {att.punches.map((p) => (
              <li key={p.id} className="relative">
                <span className="absolute -left-[21px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-[var(--surface)]" style={{ background: p.type === 'in' ? 'var(--success)' : 'var(--brand)' }} />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-black">{fmtTime(p.at)}</span>
                  <Badge tone={p.type === 'in' ? 'emerald' : 'indigo'}>{p.type === 'in' ? 'Punch in' : 'Punch out'}</Badge>
                  <Badge tone="slate">{p.method}</Badge>
                  {p.geofence_ok ? <Badge tone="emerald" dot>in fence</Badge> : <Badge tone="amber" dot>out of fence</Badge>}
                  {p.distance_m != null && <span className="text-[11px] text-mute">{Math.round(p.distance_m)}m · ±{Math.round(p.accuracy || 0)}m</span>}
                  {(p.face_score || p.fingerprint_score) && <span className="text-[11px] text-mute">match {Math.round((p.face_score || p.fingerprint_score) * 100)}%</span>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Modal open={scanning} onClose={() => setScanning(false)} title={method === 'face' ? 'Face verification' : 'Fingerprint verification'} subtitle="Biometric template is matched server-side" size="sm">
        <BiometricScan
          method={method}
          onCancel={() => setScanning(false)}
          onDone={(score) => doPunch(state === 'working' ? 'out' : 'in', score)}
        />
      </Modal>
    </Card>
  );
}

function MyHistory() {
  const [range, setRange] = useState('30');
  const from = addDaysISO(todayISO(), -(Number(range) - 1));
  const { data, loading, reload } = useResource(() => api.get(`/api/attendance/my?from=${from}&to=${todayISO()}`), [range]);

  const summary = data?.summary;
  const rollup = data?.rollup;

  const byStatus = useMemo(() => {
    const counts = {};
    (data?.rows || []).forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    const colors = { present: '#10b981', late: '#f59e0b', wfh: '#8b5cf6', on_leave: '#0ea5e9', half_day: '#f97316', absent: '#f43f5e', missed_punch: '#e11d48', holiday: '#94a3b8', week_off: '#cbd5e1' };
    return Object.entries(counts).map(([label, value]) => ({ label: label.replace(/_/g, ' '), value, color: colors[label] || '#94a3b8' }));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={range}
          onChange={setRange}
          size="sm"
          options={[
            { value: '7', label: '7d' },
            { value: '30', label: '30d' },
            { value: '90', label: '90d' }
          ]}
        />
        <Button size="sm" icon="refresh" onClick={() => reload({ silent: true })}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="checkCircle" label="Attendance rate" value={summary ? pct(summary.attendanceRate, 1) : '—'} tone="emerald" />
        <Stat icon="clock" label="Avg day" value={summary ? `${summary.avgHours}h` : '—'} tone="indigo" />
        <Stat icon="alert" label="Late days" value={summary?.lateCount ?? '—'} tone="amber" />
        <Stat icon="trending" label="Overtime" value={summary ? `${summary.otHours}h` : '—'} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <p className="mb-3 text-sm font-bold">Daily log</p>
          {loading ? (
            <SkeletonRows rows={6} />
          ) : data?.rows?.length ? (
            <div className="max-h-[420px] divide-line overflow-y-auto">
              {data.rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-16 shrink-0">
                    <div className="text-sm font-black">{fmtDateShort(r.date)}</div>
                    <div className="text-[10px] font-semibold uppercase text-mute">{new Date(`${r.date}T00:00:00Z`).toUTCString().slice(0, 3)}</div>
                  </div>
                  <StatusBadge status={r.status} />
                  <div className="ml-auto flex items-center gap-3 text-right text-xs">
                    <span className="text-mute">{r.first_in ? fmtTime(r.first_in) : '—'}</span>
                    <span className="text-mute">{r.last_out ? fmtTime(r.last_out) : '—'}</span>
                    <span className="w-14 font-bold">{minutesToHM(r.work_minutes)}</span>
                    {r.late_minutes > 0 && <Badge tone="amber">{r.late_minutes}m late</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState compact icon="clock" title="No attendance yet" message="Punch in to start building your history." />
          )}
        </Card>

        <Card>
          <p className="mb-3 text-sm font-bold">Status mix</p>
          <Donut data={byStatus} center={<div><div className="text-xl font-black">{summary?.worked ?? 0}</div><div className="text-[10px] font-bold text-mute">days worked</div></div>} />
          <div className="mt-4 space-y-2">
            <Progress label="Presence vs scheduled" value={rollup ? ((rollup.present + rollup.late + rollup.wfh) / Math.max(1, rollup.present + rollup.late + rollup.wfh + rollup.absent + rollup.leave)) * 100 : 0} tone="emerald" />
            <Progress label="Work-from-home share" value={rollup ? ((rollup.wfh / Math.max(1, rollup.present + rollup.late + rollup.wfh)) * 100) : 0} tone="violet" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function TeamBoard() {
  const { can } = useStore();
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, reload } = useResource(() => api.get(`/api/attendance/team?date=${date}${status ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`), [date, status, search]);

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="input-sm w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button size="sm" icon="chevronLeft" onClick={() => setDate(addDaysISO(date, -1))} aria-label="Previous day" />
        <Button size="sm" icon="chevronRight" onClick={() => setDate(addDaysISO(date, 1))} aria-label="Next day" />
        <Button size="sm" onClick={() => setDate(todayISO())}>Today</Button>
        <SearchInput className="w-full sm:w-56" value={search} onChange={setSearch} placeholder="Search people…" />
      </div>

      <div className="scroll-x no-scrollbar">
        <Chip active={!status} onClick={() => setStatus('')}>All {totals?.headcount ?? 0}</Chip>
        <Chip active={status === 'present'} onClick={() => setStatus('present')} icon="🟢">Present {totals?.present ?? 0}</Chip>
        <Chip active={status === 'on_leave'} onClick={() => setStatus('on_leave')} icon="🔵">On leave {totals?.onLeave ?? 0}</Chip>
        <Chip active={status === 'absent'} onClick={() => setStatus('absent')} icon="🔴">Absent {totals?.absent ?? 0}</Chip>
        <Chip active={status === 'not_punched'} onClick={() => setStatus('not_punched')} icon="🟡">Not punched {totals?.notPunched ?? 0}</Chip>
        <Chip active={status === 'off'} onClick={() => setStatus('off')} icon="⚪">Off {totals?.off ?? 0}</Chip>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="users" label="Headcount" value={totals?.headcount ?? '—'} tone="indigo" />
        <Stat icon="checkCircle" label="Present" value={totals?.present ?? '—'} tone="emerald" />
        <Stat icon="calendarCheck" label="On leave" value={totals?.onLeave ?? '—'} tone="sky" />
        <Stat icon="alert" label="Absent" value={totals?.absent ?? '—'} tone="rose" />
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="p-4">
            <SkeletonRows rows={8} />
          </div>
        ) : data?.rows?.length ? (
          <div className="divide-line">
            {data.rows.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar person={p} size={38} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (window.location.hash = `/employees/${p.id}`)}>
                  <span className="block truncate text-sm font-bold">{p.full_name}</span>
                  <span className="block truncate text-[11px] text-mute">
                    {p.designation} {p.department ? `· ${p.department}` : ''} {p.shift ? `· ${p.shift.name}` : ''}
                  </span>
                </button>
                <div className="hidden shrink-0 text-right text-xs sm:block">
                  <div className="font-bold">{p.first_in ? fmtTime(p.first_in) : '—'} → {p.last_out ? fmtTime(p.last_out) : '—'}</div>
                  <div className="text-mute">{minutesToHM(p.work_minutes)}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState icon="users" title="Nobody matches this filter" message="Change the date or status filter." />
          </div>
        )}
      </Card>
    </div>
  );
}

function MonthlyGrid() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const { data, loading } = useResource(() => api.get(`/api/attendance/monthly?month=${month}`), [month]);
  const days = data?.dates || [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input type="month" className="input-sm w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        <span className="text-xs text-mute">{data?.employees?.length || 0} people</span>
      </div>
      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="table-wrap">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20" style={{ background: 'var(--surface-2)' }}>Employee</th>
                  {days.map((d) => (
                    <th key={d} className="px-1 text-center text-[10px]">
                      {d.slice(8, 10)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.employees || []).map((e) => (
                  <tr key={e.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap font-semibold" style={{ background: 'var(--surface)' }}>
                      {e.name}
                    </td>
                    {days.map((d) => {
                      const cell = e.days.find((x) => x.date === d);
                      const tone = STATUS_TONE[cell?.status] || 'slate';
                      const colors = { emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e', sky: '#0ea5e9', violet: '#8b5cf6', orange: '#f97316', slate: '#e2e8f0' };
                      return (
                        <td key={d} className="px-0.5 py-1 text-center">
                          <span
                            title={`${d}: ${cell?.status || 'no record'}`}
                            className="mx-auto block h-5 w-5 rounded-md"
                            style={{ background: cell ? colors[tone] || '#e2e8f0' : 'var(--bg-soft)', opacity: cell ? 0.85 : 0.5 }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-mute">
        {[['Present', '#10b981'], ['Late', '#f59e0b'], ['WFH', '#8b5cf6'], ['Leave', '#0ea5e9'], ['Absent', '#f43f5e'], ['Off', '#e2e8f0']].map(([l, c]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded" style={{ background: c }} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, children, onClick, icon }) {
  return (
    <button type="button" onClick={onClick} className={`chip ${active ? 'chip-active' : ''}`}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}

function RegularizeModal({ open, onClose, onDone }) {
  const { toast } = useStore();
  const [date, setDate] = useState(addDaysISO(todayISO(), -1));
  const [firstIn, setFirstIn] = useState('09:05');
  const [lastOut, setLastOut] = useState('18:10');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/api/attendance/regularize', {
        date,
        reason: reason || 'Forgot to punch',
        first_in: `${date}T${firstIn}:00Z`,
        last_out: `${date}T${lastOut}:00Z`
      });
      toast('Regularisation sent for approval', 'success');
      onDone?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Regularise attendance"
      subtitle="Missed a punch? Submit a correction for manager approval."
      icon="history"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Submit for approval</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label">Date</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Check-in</span>
            <Input type="time" value={firstIn} onChange={(e) => setFirstIn(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Check-out</span>
            <Input type="time" value={lastOut} onChange={(e) => setLastOut(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="label">Reason</span>
          <Input placeholder="Device ran out of battery / forgot to punch out" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <p className="rounded-xl soft px-3 py-2 text-[11px] text-mute">
          Corrections are logged in the audit trail and routed to your manager as an approval request.
        </p>
      </div>
    </Modal>
  );
}

export default function Attendance() {
  const { t, can } = useStore();
  const [tab, setTab] = useState('my');
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regOpen, setRegOpen] = useState(false);

  const loadToday = async () => {
    setLoading(true);
    try {
      setToday(await api.get('/api/attendance/today'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadToday();
  }, []);

  const tabs = [
    { key: 'my', label: 'My attendance', icon: '🕘' },
    ...(can('attendance.view_team') ? [{ key: 'team', label: 'Team board', icon: '👥' }] : []),
    ...(can('attendance.view_company') ? [{ key: 'grid', label: 'Monthly grid', icon: '🗓️' }] : [])
  ];

  return (
    <div className="page">
      <PageHeader
        icon="clock"
        title={t('nav.attendance')}
        subtitle="Punch in/out with face, fingerprint or GPS geofencing"
        actions={
          <Button variant="outline" icon="history" onClick={() => setRegOpen(true)}>
            {t('attendance.regularize')}
          </Button>
        }
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'my' && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-4">
            {loading && !today ? <Card className="p-10"><SkeletonRows rows={3} /></Card> : <PunchCard today={today} onPunched={loadToday} />}
          </div>
          <MyHistory />
        </div>
      )}
      {tab === 'team' && <TeamBoard />}
      {tab === 'grid' && <MonthlyGrid />}

      <RegularizeModal open={regOpen} onClose={() => setRegOpen(false)} onDone={loadToday} />
    </div>
  );
}
