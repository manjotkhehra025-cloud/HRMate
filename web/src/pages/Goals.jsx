import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, EmptyState, Icon, IconButton, Input, Modal, PageHeader,
  Progress, Ring, SectionTitle, Select, SkeletonRows, Stat, StatusBadge, Tabs, Textarea
} from '../ui/index.jsx';
import { countdown, fmtDate, titleCase } from '../lib/format.js';

const CATEGORIES = [
  { key: 'business', label: 'Business', icon: '💼' },
  { key: 'revenue', label: 'Revenue', icon: '💰' },
  { key: 'customer', label: 'Customer', icon: '🤝' },
  { key: 'product', label: 'Product', icon: '🧩' },
  { key: 'people', label: 'People', icon: '🧑‍🤝‍🧑' },
  { key: 'efficiency', label: 'Efficiency', icon: '⚙️' },
  { key: 'compliance', label: 'Compliance', icon: '🛡️' }
];
const catOf = (k) => CATEGORIES.find((c) => c.key === k) || { label: titleCase(k), icon: '🎯' };

const UNITS = ['%', 'count', 'hours', 'index', 'tickets', '₹k'];
const METRICS = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'count', label: 'Count' },
  { value: 'hours', label: 'Hours' },
  { value: 'score', label: 'Score' }
];

function KeyResultRow({ kr, onPatch, onDelete, readOnly }) {
  const [value, setValue] = useState(kr.current ?? 0);
  const [busy, setBusy] = useState(false);
  const save = async (next) => {
    setValue(next);
    setBusy(true);
    try {
      await onPatch(next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl px-2.5 py-2" style={{ background: 'var(--bg-soft)' }}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold">{kr.title}</div>
        <div className="text-[10px] font-bold text-mute">
          {kr.current}/{kr.target} {kr.unit} · {titleCase(kr.metric)}
          {kr.due_date ? ` · due ${fmtDate(kr.due_date)}` : ''}
        </div>
        <Progress className="mt-1" height={5} value={kr.percent} tone={kr.percent >= 80 ? 'emerald' : kr.percent >= 50 ? 'brand' : 'amber'} />
      </div>
      {!readOnly && (
        <div className="flex shrink-0 items-center gap-1">
          <IconButton icon="minus" label="Decrease" size={14} onClick={() => save(Math.max(0, value - 1))} />
          <span className="w-10 text-center text-xs font-black">{kr.percent}%</span>
          <IconButton icon="plus" label="Increase" size={14} onClick={() => save(Math.min(kr.target || 100, value + 1))} />
        </div>
      )}
      {!readOnly && <IconButton icon="trash" label="Remove key result" size={14} onClick={() => onDelete(kr)} />}
      {busy && <Icon name="refresh" size={13} className="animate-spin text-mute" />}
    </div>
  );
}

function GoalCard({ goal, canManage, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const meta = catOf(goal.category);
  return (
    <Card className="animate-fade-up">
      <div className="flex items-start gap-3">
        <Ring value={goal.progress} size={58} stroke={7} tone={goal.progress >= 80 ? 'emerald' : goal.progress >= 50 ? 'brand' : 'amber'}>
          <span className="text-xs font-black">{goal.progress}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{goal.title}</span>
            <StatusBadge status={goal.status} />
            <Badge tone="slate" size="sm">{meta.icon} {meta.label}</Badge>
          </div>
          {goal.description && <p className="mt-1 line-clamp-2 text-xs text-soft">{goal.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-mute">
            <span className="font-bold">weight {goal.weight}%</span>
            <span>·</span>
            <span>due {fmtDate(goal.due_date)} ({countdown(goal.due_date)})</span>
            {goal.full_name && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Avatar person={goal} size={18} /> {goal.full_name}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" className="text-mute transition hover:text-soft" onClick={() => setOpen((o) => !o)} aria-label="Toggle key results">
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
          </button>
          {canManage && <IconButton icon="trash" label="Delete goal" size={15} onClick={() => onDelete(goal)} />}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-bold text-mute">Key results ({goal.keyResults.length})</span>
          </div>
          {goal.keyResults.length ? (
            goal.keyResults.map((kr) => (
              <KeyResultRow
                key={kr.id}
                kr={kr}
                readOnly={!canManage}
                onPatch={(next) => api.patch(`/api/key-results/${kr.id}`, { current: next }).then(onChange)}
                onDelete={async (k) => {
                  await api.del(`/api/key-results/${k.id}`, {});
                  onChange();
                }}
              />
            ))
          ) : (
            <p className="text-xs text-mute">No key results yet — progress is tracked manually on the goal.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function GoalModal({ open, onClose, onDone, team }) {
  const { toast } = useStore();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'business',
    weight: 25,
    employee_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
  });
  const [krs, setKrs] = useState([{ title: '', target: 100, unit: '%', metric: 'percentage' }]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.title.trim()) {
      toast('Give the goal a title', 'warn');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/goals', {
        ...form,
        employee_id: form.employee_id ? Number(form.employee_id) : null,
        keyResults: krs.filter((k) => k.title.trim()).map((k) => ({ ...k, target: Number(k.target) }))
      });
      toast('Goal created 🎯', 'success');
      setForm({ ...form, title: '', description: '' });
      setKrs([{ title: '', target: 100, unit: '%', metric: 'percentage' }]);
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
      title="New goal"
      subtitle="Objectives roll up from their key results"
      icon="target"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Create goal</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label">Objective *</span>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ship the offline-first mobile release" />
        </label>
        <label className="block">
          <span className="label">Why it matters</span>
          <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Category</span>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
          </label>
          <label>
            <span className="label">Weight ({form.weight}%)</span>
            <input type="range" min="5" max="100" step="5" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} className="w-full" />
          </label>
          <label><span className="label">Start</span><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
          <label><span className="label">Due</span><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
        </div>
        {team?.length > 0 && (
          <label className="block">
            <span className="label">Assign to</span>
            <Select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              placeholder="Myself"
              options={[{ value: '', label: 'Myself' }, ...team.map((p) => ({ value: String(p.id), label: `${p.full_name} — ${p.designation}` }))]}
            />
          </label>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">Key results</span>
            <button type="button" className="text-xs font-bold text-brand-600" onClick={() => setKrs([...krs, { title: '', target: 100, unit: '%', metric: 'percentage' }])}>
              + Add
            </button>
          </div>
          <div className="space-y-2">
            {krs.map((kr, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_80px_28px] items-center gap-1.5">
                <Input className="input-sm" value={kr.title} placeholder="Crash-free sessions above 99.5%" onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Input className="input-sm" type="number" value={kr.target} onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} />
                <Select className="input-sm" value={kr.unit} onChange={(e) => setKrs(krs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} options={UNITS.map((u) => ({ value: u, label: u }))} />
                <IconButton icon="x" label="Remove" size={14} onClick={() => setKrs(krs.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Goals() {
  const { can, toast } = useStore();
  const [tab, setTab] = useState('mine');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [removing, setRemoving] = useState(null);
  const teamScope = can('goal.manage_team');

  const { data, loading, reload } = useResource(
    () => api.get(`/api/goals?scope=${tab}${category ? `&category=${category}` : ''}${status ? `&status=${status}` : ''}`),
    [tab, category, status]
  );
  const { data: team } = useResource(() => (teamScope ? api.get('/api/employees?limit=200') : Promise.resolve({ rows: [] })), [teamScope]);

  const rows = data?.rows || [];
  const totals = data?.totals || {};

  return (
    <div className="page">
      <PageHeader
        icon="target"
        title="KRA & goals"
        subtitle="Objectives, key results and progress roll-up"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setModal(true)}>
            New goal
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="target" label="Goals" value={totals.count ?? 0} tone="indigo" />
        <Stat icon="trending" label="Average progress" value={`${totals.avgProgress ?? 0}%`} tone="brand" />
        <Stat icon="checkCircle" label="Ahead of plan" value={totals.ahead ?? 0} tone="emerald" />
        <Stat icon="alert" label="At risk" value={totals.atRisk ?? 0} tone="rose" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {teamScope && (
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'mine', label: 'My goals', icon: '🙋' },
              { key: 'team', label: 'Team goals', icon: '👥' }
            ]}
          />
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {['', ...CATEGORIES.map((c) => c.key)].map((c) => (
            <button key={c || 'all'} type="button" onClick={() => setCategory(c)} className={`chip ${category === c ? 'chip-active' : ''}`}>
              {c ? `${catOf(c).icon} ${catOf(c).label}` : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {['', 'on_track', 'ahead', 'at_risk', 'behind'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-active' : ''}`}>
            {s ? titleCase(s) : 'Any status'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4"><Card><SkeletonRows rows={4} /></Card><Card><SkeletonRows rows={3} /></Card></div>
      ) : rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              canManage={can('goal.manage_self') || can('goal.manage_team')}
              onChange={() => reload({ silent: true })}
              onDelete={setRemoving}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="target"
            title="No goals here yet"
            message="Set an objective with key results and watch progress roll up automatically."
            action={<Button variant="primary" icon="plus" onClick={() => setModal(true)}>Create your first goal</Button>}
          />
        </Card>
      )}

      <GoalModal open={modal} onClose={() => setModal(false)} onDone={() => reload({ silent: true })} team={team?.rows || []} />
      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete “${removing?.title}”?`}
        message="The goal and its key results will be removed."
        confirmLabel="Delete goal"
        onConfirm={async () => {
          await api.del(`/api/goals/${removing.id}`, {});
          toast('Goal deleted', 'warn');
          reload({ silent: true });
        }}
      />
    </div>
  );
}
