import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, IconButton, Input, Modal, PageHeader, Select, Stat,
  StatusBadge, Tabs, Textarea
} from '../ui/index.jsx';
import { addDaysISO, fmtDate, fmtDateShort, monthLabel, rangeISO, STATUS_TONE, todayISO } from '../lib/format.js';

const WEEK_HEADER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EventModal({ open, onClose, onDone, initialDate }) {
  const { toast } = useStore();
  const [form, setForm] = useState({ title: '', date: todayISO(), start_time: '10:00', end_time: '11:00', kind: 'meeting', location: '', description: '' });
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (open) setForm((f) => ({ ...f, date: initialDate || todayISO() }));
  }, [open, initialDate]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New calendar event"
      icon="calendar"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post('/api/events', form);
                toast('Event created', 'success');
                onDone?.();
                onClose();
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Create event
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block"><span className="label">Title *</span><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sprint planning" /></label>
        <div className="grid grid-cols-3 gap-2">
          <label><span className="label">Date</span><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label><span className="label">Start</span><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></label>
          <label><span className="label">End</span><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="label">Type</span>
            <Select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              options={['meeting', 'training', 'review', 'culture', 'customer', 'engineering', 'hiring'].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))}
            />
          </label>
          <label><span className="label">Location</span><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Zoom / HQ Floor 4" /></label>
        </div>
        <label className="block"><span className="label">Description</span><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

export default function Calendar() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [selected, setSelected] = useState(todayISO());
  const [eventOpen, setEventOpen] = useState(false);
  const { data, loading, reload } = useResource(() => api.get(`/api/calendar?month=${month}`), [month]);

  const days = data?.days || [];
  const leading = days.length ? (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const cells = useMemo(() => [...Array(leading).fill(null), ...days], [leading, days]);
  const selectedDay = days.find((d) => d.date === selected);

  const shiftMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div className="page">
      <PageHeader
        icon="calendar"
        title="Calendar"
        subtitle="Holidays, leaves, shifts, events and birthdays"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setEventOpen(true)}>
            New event
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="calendar" label="Working days" value={data?.summary?.workdays ?? '—'} tone="indigo" />
        <Stat icon="sparkle" label="Holidays" value={data?.summary?.holidays ?? '—'} tone="violet" />
        <Stat icon="calendarCheck" label="Leaves" value={data?.summary?.leaves ?? '—'} tone="sky" />
        <Stat icon="users" label="Events" value={data?.summary?.events ?? '—'} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <IconButton icon="chevronLeft" label="Previous month" onClick={() => shiftMonth(-1)} />
              <h3 className="min-w-[130px] text-center text-sm font-black">{monthLabel(month)}</h3>
              <IconButton icon="chevronRight" label="Next month" onClick={() => shiftMonth(1)} />
            </div>
            <Button size="sm" onClick={() => { setMonth(todayISO().slice(0, 7)); setSelected(todayISO()); }}>Today</Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_HEADER.map((d) => (
              <div key={d} className="pb-1 text-[10px] font-black uppercase tracking-wide text-mute">{d}</div>
            ))}
            {cells.map((d, i) =>
              d === null ? (
                <div key={`pad-${i}`} />
              ) : (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelected(d.date)}
                  className="relative flex min-h-[64px] flex-col items-center gap-1 rounded-xl border p-1.5 transition active:scale-[.97]"
                  style={{
                    borderColor: selected === d.date ? 'var(--brand)' : 'var(--border)',
                    background: selected === d.date ? 'var(--brand-soft)' : d.isToday ? 'var(--surface-2)' : 'var(--surface)'
                  }}
                >
                  <span className={`text-xs font-black ${d.isToday ? '' : 'text-soft'}`} style={d.isToday ? { color: 'var(--brand)' } : undefined}>
                    {d.date.slice(8, 10)}
                  </span>
                  {d.holiday && <span className="text-[12px]" title={d.holiday.name}>🎉</span>}
                  {d.roster?.shift && !d.holiday && (
                    <span className="w-full rounded px-1 text-[8px] font-bold" style={{ background: `${d.roster.color}22` }}>
                      {d.roster.shift_name?.slice(0, 6)}
                    </span>
                  )}
                  <span className="flex gap-0.5">
                    {d.leaves.slice(0, 3).map((l) => (
                      <span key={l.id} className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} title={`${l.full_name} · ${l.name}`} />
                    ))}
                    {d.events.slice(0, 2).map((e) => (
                      <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: e.color || '#6366f1' }} title={e.title} />
                    ))}
                    {d.birthdays.map((b) => (
                      <span key={b.id} className="text-[10px]" title={`🎂 ${b.full_name}`}>🎂</span>
                    ))}
                  </span>
                  {d.attendance && (
                    <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full" style={{ background: STATUS_TONE[d.attendance.status] === 'emerald' ? '#10b981' : STATUS_TONE[d.attendance.status] === 'amber' ? '#f59e0b' : '#94a3b8' }} />
                  )}
                </button>
              )
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-mute">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> My attendance</span>
            <span className="flex items-center gap-1">🎉 Holiday</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Team leave</span>
            <span className="flex items-center gap-1">🎂 Birthday</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-black">{fmtDate(selected)}</h3>
              {selectedDay?.isToday && <Badge tone="indigo">Today</Badge>}
            </div>
            {selectedDay?.holiday && (
              <div className="mb-2 rounded-xl px-3 py-2.5" style={{ background: `${selectedDay.holiday.color}18` }}>
                <p className="text-sm font-bold">🎉 {selectedDay.holiday.name}</p>
                <p className="text-[11px] text-mute">{selectedDay.holiday.type} holiday</p>
              </div>
            )}
            {selectedDay?.roster?.shift && (
              <div className="mb-2 rounded-xl px-3 py-2.5" style={{ background: `${selectedDay.roster.color}18` }}>
                <p className="text-sm font-bold">My shift · {selectedDay.roster.shift_name}</p>
                <p className="text-[11px] text-mute">{selectedDay.roster.start_time} – {selectedDay.roster.end_time}</p>
              </div>
            )}
            {selectedDay?.attendance && (
              <div className="mb-2 flex items-center justify-between rounded-xl soft px-3 py-2.5">
                <span className="text-xs font-bold">My attendance</span>
                <StatusBadge status={selectedDay.attendance.status} />
              </div>
            )}
            {selectedDay?.events?.length > 0 && (
              <div className="divide-line">
                {selectedDay.events.map((e) => (
                  <div key={e.id} className="flex items-start gap-2.5 py-2">
                    <span className="mt-1 h-8 w-1 rounded-full" style={{ background: e.color || 'var(--brand)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{e.title}</p>
                      <p className="truncate text-[11px] text-mute">
                        {e.start_time ? `${e.start_time}–${e.end_time}` : 'All day'} {e.location ? `· ${e.location}` : ''} {e.organizer ? `· ${e.organizer}` : ''}
                      </p>
                    </div>
                    <Badge tone="slate">{e.kind}</Badge>
                  </div>
                ))}
              </div>
            )}
            {selectedDay?.leaves?.length > 0 && (
              <div className="mt-2">
                <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-mute">On leave</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDay.leaves.map((l) => (
                    <span key={l.id} className="chip" style={{ background: `${l.color}18` }}>
                      {l.icon} {l.full_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedDay?.birthdays?.length > 0 && (
              <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(236,72,153,.08)' }}>
                <p className="text-xs font-black uppercase text-pink-500">🎂 Birthdays</p>
                <p className="mt-1 text-sm font-semibold">{selectedDay.birthdays.map((b) => b.full_name).join(', ')}</p>
              </div>
            )}
            {!selectedDay?.holiday && !selectedDay?.events?.length && !selectedDay?.leaves?.length && !selectedDay?.roster?.shift && (
              <EmptyState compact icon="calendar" title="Nothing scheduled" message="A clear day." />
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-black">Upcoming events</h3>
            {days.some((d) => d.events.length) ? (
              <div className="divide-line">
                {days
                  .flatMap((d) => d.events.map((e) => ({ ...e, date: d.date })))
                  .filter((e) => e.date >= todayISO())
                  .slice(0, 6)
                  .map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-black" style={{ background: `${e.color || '#6366f1'}18` }}>
                        {e.date.slice(8, 10)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.title}</p>
                        <p className="truncate text-[11px] text-mute">{e.start_time || 'All day'} · {e.location || '—'}</p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <EmptyState compact icon="calendar" title="No upcoming events" />
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-black">Holidays this month</h3>
            {data?.days?.some((d) => d.holiday) ? (
              <div className="divide-line">
                {data.days.filter((d) => d.holiday).map((d) => (
                  <div key={d.date} className="flex items-center gap-2.5 py-2">
                    <span className="text-lg">🎉</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.holiday.name}</p>
                      <p className="truncate text-[11px] text-mute">{fmtDate(d.date)} · {d.holiday.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon="sparkle" title="No holidays this month" />
            )}
          </Card>
        </div>
      </div>

      <EventModal open={eventOpen} onClose={() => setEventOpen(false)} onDone={() => reload({ silent: true })} initialDate={selected} />
    </div>
  );
}
