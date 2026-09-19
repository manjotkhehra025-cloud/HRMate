import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, IconButton, Input, Modal, PageHeader, Progress,
  SectionTitle, Select, SkeletonRows, Stat, StatusBadge, Tabs
} from '../ui/index.jsx';
import { addDaysISO, fmtDate, fmtDateShort, startOfWeekISO, todayISO, weekdayShort } from '../lib/format.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function AssignModal({ open, onClose, day, person, shifts, onDone }) {
  const { toast } = useStore();
  const [shiftId, setShiftId] = useState('');
  const [kind, setKind] = useState('work');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (open) {
      setShiftId(person?.shift?.id ? String(person.shift.id) : shifts[0] ? String(shifts[0].id) : '');
      setKind('work');
    }
  }, [open, person, shifts]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign shift"
      subtitle={`${person?.full_name || ''} · ${fmtDate(day || todayISO())}`}
      icon="grid"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post('/api/roster', { employee_id: person.id, date: day, shift_id: kind === 'work' ? Number(shiftId) : null, kind });
                toast('Roster updated', 'success');
                onDone?.();
                onClose();
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Save slot
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="label">Day type</span>
          <div className="flex gap-1.5">
            {[
              ['work', 'Working'],
              ['week_off', 'Week off'],
              ['off', 'Off']
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`chip ${kind === k ? 'chip-active' : ''}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {kind === 'work' && (
          <label className="block">
            <span className="label">Shift</span>
            <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)} options={shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.start_time}–${s.end_time})` }))} />
          </label>
        )}
      </div>
    </Modal>
  );
}

function BulkModal({ open, onClose, people, shifts, onDone }) {
  const { toast } = useStore();
  const [ids, setIds] = useState([]);
  const [shiftId, setShiftId] = useState('');
  const [from, setFrom] = useState(addDaysISO(todayISO(), 1));
  const [to, setTo] = useState(addDaysISO(todayISO(), 5));
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk roster update"
      subtitle="Assign a shift to many people across a date range"
      icon="layers"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!ids.length || !shiftId}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await api.post('/api/roster/bulk', { employee_ids: ids, from, to, shift_id: Number(shiftId), kind: 'work' });
                toast(`${res.count} roster slots updated`, 'success');
                onDone?.();
                onClose();
                setIds([]);
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Apply to {ids.length} people
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">From</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">To</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <label className="block">
          <span className="label">Shift</span>
          <Select placeholder="Select shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)} options={shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.start_time}–${s.end_time})` }))} />
        </label>
        <div>
          <span className="label">People ({ids.length} selected)</span>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
            {people.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]">
                <input type="checkbox" className="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
                <Avatar person={p} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.full_name}</span>
                <span className="truncate text-[11px] text-mute">{p.department}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function MyRoster() {
  const [week, setWeek] = useState(startOfWeekISO(todayISO()));
  const { data, loading, reload } = useResource(() => api.get(`/api/roster/my?date=${week}`), [week]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" icon="chevronLeft" onClick={() => setWeek(addDaysISO(week, -7))} />
        <Button size="sm" onClick={() => setWeek(startOfWeekISO(todayISO()))}>This week</Button>
        <Button size="sm" onClick={() => setWeek(addDaysISO(week, 7))}><Icon name="chevronRight" size={14} /></Button>
        <span className="ml-auto text-xs font-semibold text-mute">{fmtDate(week)} → {fmtDate(addDaysISO(week, 6))}</span>
      </div>
      {loading ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.days || []).map((d) => (
            <Card key={d.date} className={d.date === todayISO() ? '' : ''} >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-mute">{weekdayShort(d.date)}</p>
                  <p className="text-lg font-black">{fmtDateShort(d.date)}</p>
                </div>
                {d.date === todayISO() && <Badge tone="indigo">Today</Badge>}
              </div>
              {d.holiday ? (
                <div className="mt-2 rounded-xl px-3 py-2" style={{ background: `${d.holiday.color}18` }}>
                  <p className="text-sm font-bold">🎉 {d.holiday.name}</p>
                  <p className="text-[11px] text-mute">Company holiday</p>
                </div>
              ) : d.leave ? (
                <div className="mt-2 rounded-xl px-3 py-2" style={{ background: `${d.leave.color}18` }}>
                  <p className="text-sm font-bold">{d.leave.icon} {d.leave.leave_name}</p>
                  <p className="text-[11px] text-mute">Approved leave</p>
                </div>
              ) : d.shift ? (
                <div className="mt-2 rounded-xl px-3 py-2" style={{ background: `${d.shift.color}18` }}>
                  <p className="text-sm font-bold">{d.shift.name}</p>
                  <p className="text-[11px] text-mute">{d.shift.start} – {d.shift.end} · {d.shift.work_hours}h</p>
                </div>
              ) : (
                <div className="mt-2 rounded-xl soft px-3 py-2">
                  <p className="text-sm font-bold text-mute">Day off</p>
                  <p className="text-[11px] text-mute">No shift scheduled</p>
                </div>
              )}
              {d.attendance && (
                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge status={d.attendance.status} />
                  <span className="text-[11px] font-semibold text-mute">{Math.round((d.attendance.work_minutes || 0) / 60)}h worked</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Card>
        <SectionTitle icon="swap" title="Swap requests" subtitle="Trade a shift with a teammate" />
        {data?.swaps?.length ? (
          <div className="divide-line">
            {data.swaps.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl soft"><Icon name="swap" size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{fmtDate(s.date)}</p>
                  <p className="truncate text-[11px] text-mute">{s.reason || 'No reason given'}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon="swap" title="No swap requests" message="Request a shift swap when plans change." />
        )}
      </Card>
    </div>
  );
}

function SwapModal({ open, onClose, people, onDone }) {
  const { toast } = useStore();
  const [date, setDate] = useState(addDaysISO(todayISO(), 1));
  const [withId, setWithId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request a shift swap"
      icon="swap"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post('/api/swaps', { date, with_employee_id: withId ? Number(withId) : null, reason });
                toast('Swap request sent', 'success');
                onDone?.();
                onClose();
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Send request
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block"><span className="label">Date</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="block">
          <span className="label">Swap with</span>
          <Select placeholder="Anyone available" value={withId} onChange={(e) => setWithId(e.target.value)} options={people.map((p) => ({ value: p.id, label: `${p.full_name} · ${p.designation || ''}` }))} />
        </label>
        <label className="block"><span className="label">Reason</span><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Medical appointment" /></label>
      </div>
    </Modal>
  );
}

function TeamRoster() {
  const { can, toast } = useStore();
  const [week, setWeek] = useState(startOfWeekISO(todayISO()));
  const [department, setDepartment] = useState('');
  const [assign, setAssign] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const { data: depts } = useResource(() => api.get('/api/departments'), []);
  const { data: shiftData } = useResource(() => api.get('/api/shifts'), []);
  const shiftList = shiftData?.rows || [];
  const { data, loading, reload } = useResource(
    () => api.get(`/api/roster?week=${week}${department ? `&department=${department}` : ''}`),
    [week, department]
  );

  const publish = async () => {
    try {
      const res = await api.post('/api/roster/publish', { from: week, to: addDaysISO(week, 6) });
      toast(`Roster published — ${res.slots} slots notified`, 'success');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon="chevronLeft" onClick={() => setWeek(addDaysISO(week, -7))} />
        <Button size="sm" onClick={() => setWeek(startOfWeekISO(todayISO()))}>This week</Button>
        <Button size="sm" onClick={() => setWeek(addDaysISO(week, 7))}><Icon name="chevronRight" size={14} /></Button>
        <Select className="input-sm w-auto" placeholder="All departments" value={department} onChange={(e) => setDepartment(e.target.value)} options={(depts?.rows || []).map((d) => ({ value: d.id, label: d.name }))} />
        <span className="text-xs font-semibold text-mute">{fmtDate(week)} → {fmtDate(addDaysISO(week, 6))}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" icon="swap" onClick={() => setSwapOpen(true)}>Swap</Button>
          {can('roster.manage') && (
            <>
              <Button size="sm" variant="outline" icon="layers" onClick={() => setBulk(true)}>Bulk</Button>
              <Button size="sm" variant="primary" icon="megaphone" onClick={publish}>Publish</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="grid" label="Scheduled slots" value={data?.totals?.scheduled ?? '—'} tone="indigo" />
        <Stat icon="calendarCheck" label="On leave" value={data?.totals?.onLeave ?? '—'} tone="sky" />
        <Stat icon="clock" label="Planned hours" value={data?.totals?.hours ?? '—'} tone="emerald" />
        <Stat icon="users" label="People shown" value={data?.employees?.length ?? '—'} tone="violet" />
      </div>

      {loading ? (
        <SkeletonRows rows={8} />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="table-wrap">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20" style={{ background: 'var(--surface-2)' }}>Employee</th>
                  {(data?.days || []).map((d, i) => (
                    <th key={d} className="text-center">
                      <div>{DAY_LABELS[i]}</div>
                      <div className="text-[10px] font-semibold text-mute">{d.slice(8, 10)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.employees || []).map((p) => (
                  <tr key={p.id}>
                    <td className="sticky left-0 z-10" style={{ background: 'var(--surface)' }}>
                      <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => (window.location.hash = `/employees/${p.id}`)}>
                        <Avatar person={p} size={30} />
                        <span className="min-w-0">
                          <span className="block max-w-[160px] truncate text-sm font-bold">{p.full_name}</span>
                          <span className="block max-w-[160px] truncate text-[10px] text-mute">{p.department}</span>
                        </span>
                      </button>
                    </td>
                    {p.week.map((cell) => (
                      <td key={cell.date} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          disabled={!can('roster.manage')}
                          onClick={() => setAssign({ day: cell.date, person: p })}
                          className="mx-auto block w-full rounded-lg px-1 py-2 text-[10px] font-bold transition hover:brightness-95 disabled:cursor-default"
                          style={{
                            background: cell.leave ? `${cell.leave.color}22` : cell.shift ? `${cell.shift.color}22` : 'var(--bg-soft)',
                            color: cell.leave || cell.shift ? 'var(--text)' : 'var(--text-mute)'
                          }}
                          title={`${cell.date}: ${cell.leave ? cell.leave.name : cell.shift ? `${cell.shift.name} ${cell.shift.start}-${cell.shift.end}` : cell.kind}`}
                        >
                          {cell.leave ? cell.leave.name.slice(0, 3).toUpperCase() : cell.shift ? `${cell.shift.start}` : cell.kind === 'work' ? '—' : 'OFF'}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon="chart" title="Daily coverage" subtitle="Scheduled vs on leave" />
        <div className="grid grid-cols-7 gap-2">
          {(data?.days || []).map((d, i) => {
            const cov = data?.coverage?.[d];
            const total = Math.max(1, (cov?.scheduled || 0) + (cov?.onLeave || 0));
            return (
              <div key={d} className="rounded-xl border p-2 text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[10px] font-bold uppercase text-mute">{DAY_LABELS[i]}</p>
                <p className="text-lg font-black">{cov?.scheduled || 0}</p>
                <Progress className="mt-1" height={5} value={((cov?.scheduled || 0) / total) * 100} tone={cov?.holiday ? 'violet' : 'emerald'} />
                {cov?.holiday && <p className="mt-1 text-[9px] font-bold text-violet-500">{cov.holiday.name}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <AssignModal open={!!assign} onClose={() => setAssign(null)} day={assign?.day} person={assign?.person} shifts={shiftList} onDone={() => reload({ silent: true })} />
      <BulkModal open={bulk} onClose={() => setBulk(false)} people={data?.employees || []} shifts={shiftList} onDone={() => reload({ silent: true })} />
      <SwapModal open={swapOpen} onClose={() => setSwapOpen(false)} people={data?.employees || []} onDone={() => reload({ silent: true })} />
    </div>
  );
}

export default function Roster() {
  const { can } = useStore();
  const [tab, setTab] = useState(can('roster.view_team') ? 'team' : 'my');
  const { data: shifts } = useResource(() => api.get('/api/shifts'), []);
  const shiftList = shifts?.rows || [];

  return (
    <div className="page-wide">
      <PageHeader icon="grid" title="Shift roster" subtitle="Weekly schedule, coverage and shift swaps" />
      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'my', label: 'My week', icon: '🙋' },
          ...(can('roster.view_team') ? [{ key: 'team', label: 'Team roster', icon: '👥' }] : [])
        ]}
      />
      {tab === 'my' ? <MyRoster /> : <TeamRoster />}
    </div>
  );
}
