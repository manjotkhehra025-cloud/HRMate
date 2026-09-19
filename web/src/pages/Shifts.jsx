import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Badge, Button, Card, Confirm, EmptyState, Icon, Input, Modal, PageHeader, Progress, SectionTitle,
  SkeletonRows, Stat, Textarea, Toggle
} from '../ui/index.jsx';
import { minutesToHM } from '../lib/format.js';

const DAY_KEYS = [
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
  { key: 0, label: 'Sun' }
];

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#ec4899', '#22c55e'];

function ShiftForm({ open, onClose, initial, onSaved }) {
  const { toast } = useStore();
  const blank = { name: '', code: '', start_time: '09:00', end_time: '18:00', break_minutes: 60, grace_min: 15, color: '#3b82f6', days: [1, 2, 3, 4, 5], description: '' };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (open) setForm(initial ? { ...blank, ...initial, days: initial.days || [1, 2, 3, 4, 5] } : blank);
  }, [open, initial]);

  const toggleDay = (d) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() }));

  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...form, break_minutes: Number(form.break_minutes), grace_min: Number(form.grace_min) };
      if (initial?.id) await api.patch(`/api/shifts/${initial.id}`, payload);
      else await api.post('/api/shifts', payload);
      toast(initial ? 'Shift updated' : 'Shift created', 'success');
      onSaved?.();
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
      title={initial ? `Edit ${initial.name}` : 'Create shift'}
      subtitle="Shift timings drive late calculation, overtime and roster coverage"
      icon="layers"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {initial ? 'Save changes' : 'Create shift'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Shift name *</span><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="General" /></label>
          <label><span className="label">Code</span><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="GEN" /></label>
          <label><span className="label">Start *</span><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></label>
          <label><span className="label">End *</span><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></label>
          <label><span className="label">Break (minutes)</span><Input type="number" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value })} /></label>
          <label><span className="label">Late grace (minutes)</span><Input type="number" value={form.grace_min} onChange={(e) => setForm({ ...form, grace_min: e.target.value })} /></label>
        </div>
        <div>
          <span className="label">Working days</span>
          <div className="flex flex-wrap gap-1.5">
            {DAY_KEYS.map((d) => (
              <button key={d.key} type="button" onClick={() => toggleDay(d.key)} className={`chip ${form.days.includes(d.key) ? 'chip-active' : ''}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className="h-8 w-8 rounded-xl transition active:scale-90"
                style={{ background: c, outline: form.color === c ? '3px solid var(--brand)' : 'none', outlineOffset: 2 }}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </div>
        <label className="block"><span className="label">Description</span><Textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

export default function Shifts() {
  const { can, toast } = useStore();
  const { data, loading, reload } = useResource(() => api.get('/api/shifts'), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const rows = data?.rows || [];
  const totalAssigned = rows.reduce((s, r) => s + (r.assigned || 0), 0);

  return (
    <div className="page">
      <PageHeader
        icon="layers"
        title="Shifts"
        subtitle="Define working hours, grace periods and rotation patterns"
        actions={
          can('shift.manage') && (
            <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setFormOpen(true); }}>
              New shift
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="layers" label="Shift patterns" value={rows.length} tone="indigo" />
        <Stat icon="users" label="Assigned people" value={totalAssigned} tone="emerald" />
        <Stat icon="moon" label="Overnight shifts" value={rows.filter((r) => r.overnight).length} tone="violet" />
        <Stat icon="coffee" label="Avg break" value={`${Math.round(rows.reduce((s, r) => s + (r.break_minutes || 0), 0) / Math.max(1, rows.length))}m`} tone="amber" />
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <Card key={s.id} className="overflow-hidden p-0">
              <div className="h-1.5" style={{ background: s.color }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black">{s.name}</h3>
                    <p className="text-[11px] font-semibold text-mute">{s.code} · {s.work_hours}h working</p>
                  </div>
                  <Badge tone="slate">{s.assigned} people</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-2xl font-black tracking-tight">
                  <span>{s.start_time}</span>
                  <Icon name="chevronRight" size={18} className="text-mute rtl:rotate-180" />
                  <span>{s.end_time}</span>
                  {s.overnight ? <Badge tone="violet">overnight</Badge> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {DAY_KEYS.map((d) => (
                    <span
                      key={d.key}
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        background: (s.days || []).includes(d.key) ? `${s.color}22` : 'var(--bg-soft)',
                        color: (s.days || []).includes(d.key) ? 'var(--text)' : 'var(--text-mute)'
                      }}
                    >
                      {d.label}
                    </span>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5 text-[11px] font-semibold text-mute">
                  <div className="flex justify-between"><span>Break</span><span>{s.break_minutes} min</span></div>
                  <div className="flex justify-between"><span>Late grace</span><span>{s.grace_min} min</span></div>
                </div>
                {s.description && <p className="mt-2 text-[11px] text-mute">{s.description}</p>}
                {can('shift.manage') && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" icon="edit" onClick={() => { setEditing(s); setFormOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => setRemoving(s)}>Delete</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon="layers" title="No shifts defined" message="Create your first shift pattern to start rostering." action={<Button variant="primary" icon="plus" onClick={() => setFormOpen(true)}>New shift</Button>} />
      )}

      <ShiftForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} onSaved={() => reload({ silent: true })} />
      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name}?`}
        message="Shifts with assigned employees cannot be deleted."
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            await api.del(`/api/shifts/${removing.id}`, {});
            toast('Shift deleted', 'warn');
            reload({ silent: true });
          } catch (err) {
            toast(err.message, 'error');
          }
        }}
      />
    </div>
  );
}
