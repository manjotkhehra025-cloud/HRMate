import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, BarChart, Button, Card, Confirm, Donut, EmptyState, Icon, Input, Modal,
  PageHeader, Progress, Ring, SectionTitle, Select, SkeletonRows, Stat, StatusBadge, Tabs, Textarea
} from '../ui/index.jsx';
import { fmtDate, relative, titleCase } from '../lib/format.js';

const SUB_SCORES = [
  { key: 'productivity', label: 'Productivity', color: 'var(--brand)' },
  { key: 'quality', label: 'Quality', color: '#10b981' },
  { key: 'teamwork', label: 'Teamwork', color: '#f59e0b' },
  { key: 'initiative', label: 'Initiative', color: '#8b5cf6' },
  { key: 'reliability', label: 'Reliability', color: '#0ea5e9' }
];

const ratingTone = (r) => (r >= 4.5 ? 'emerald' : r >= 3.5 ? 'brand' : r >= 2.5 ? 'amber' : 'rose');
const ratingWord = (r) => (r >= 4.5 ? 'Outstanding' : r >= 3.5 ? 'Exceeds' : r >= 2.5 ? 'Meets' : r >= 1.5 ? 'Developing' : 'Below');

function ReviewCard({ review, canManage, isMine, onChange, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selfRating, setSelfRating] = useState(review.self_rating || 4);
  const rating = review.rating ? Number(review.rating) : null;

  const acknowledge = async () => {
    setBusy(true);
    try {
      await api.post(`/api/reviews/${review.id}/acknowledge`, { self_rating: selfRating });
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="animate-fade-up">
      <div className="flex items-start gap-3">
        <Ring value={rating ? rating * 20 : 0} size={62} stroke={7} tone={rating ? ratingTone(rating) : 'slate'}>
          <div className="text-center">
            <div className="text-sm font-black">{review.composite || '—'}</div>
            <div className="text-[8px] font-bold text-mute">/ 5</div>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={`#/employees/${review.employee_id}`} className="truncate text-sm font-bold hover:underline">{review.full_name}</a>
            <StatusBadge status={review.status} />
            {review.ack ? <Badge tone="emerald" size="sm">Acknowledged</Badge> : null}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-mute">
            {review.designation}{review.department ? ` · ${review.department}` : ''} · {review.cycle_name || 'Ad-hoc'} ({review.period || '—'})
          </div>
          <div className="mt-1 text-[11px] text-mute">
            Reviewed by {review.reviewer_name || '—'} · {relative(review.created_at)}
            {rating ? ` · ${ratingWord(rating)}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button type="button" className="text-mute transition hover:text-soft" onClick={() => setOpen((o) => !o)} aria-label="Toggle details">
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
          </button>
          {canManage && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit(review)}>Edit</Button>
              <Button size="sm" variant="ghost" icon="trash" onClick={() => onDelete(review)} />
            </div>
          )}
        </div>
      </div>

      {review.summary && <p className="mt-2 text-xs leading-relaxed text-soft">{review.summary}</p>}

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="grid gap-2 sm:grid-cols-2">
            {SUB_SCORES.map((s) => (
              <div key={s.key}>
                <div className="mb-0.5 flex justify-between text-[11px] font-bold">
                  <span>{s.label}</span>
                  <span className="text-mute">{review[s.key] ?? 0}</span>
                </div>
                <Progress height={6} value={review[s.key] ?? 0} tone={s.key === 'productivity' ? 'brand' : review[s.key] >= 70 ? 'emerald' : 'amber'} />
              </div>
            ))}
            <div>
              <div className="mb-0.5 flex justify-between text-[11px] font-bold">
                <span>Potential</span>
                <span className="text-mute">{review.potential ?? '—'}/5</span>
              </div>
              <Progress height={6} value={(review.potential || 0) * 20} tone="violet" />
            </div>
          </div>

          {!!review.strengths?.length && (
            <div>
              <div className="mb-1 text-[11px] font-bold text-emerald-600">Strengths</div>
              <ul className="space-y-1">
                {review.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-soft">
                    <Icon name="check" size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!review.improvements?.length && (
            <div>
              <div className="mb-1 text-[11px] font-bold text-amber-600">Focus areas</div>
              <ul className="space-y-1">
                {review.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-soft">
                    <Icon name="trending" size={13} className="mt-0.5 shrink-0 text-amber-500" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isMine && review.status === 'published' && !review.ack && (
            <div className="rounded-xl p-3" style={{ background: 'var(--brand-soft)' }}>
              <div className="mb-1.5 text-xs font-bold">Acknowledge this review</div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setSelfRating(n)} className={`chip ${selfRating === n ? 'chip-active' : ''}`}>
                    {n} — {ratingWord(n)}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="primary" icon="check" loading={busy} onClick={acknowledge}>
                Sign &amp; acknowledge
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ReviewModal({ open, onClose, onDone, review, cycles, team }) {
  const { toast } = useStore();
  const blank = {
    employee_id: '',
    cycle_id: '',
    rating: 4,
    potential: 3,
    productivity: 75,
    quality: 75,
    teamwork: 75,
    initiative: 75,
    reliability: 75,
    summary: '',
    strengths: '',
    improvements: '',
    status: 'draft'
  };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(
      review
        ? {
            id: review.id,
            employee_id: review.employee_id,
            cycle_id: review.cycle_id || '',
            rating: review.rating ?? 4,
            potential: review.potential ?? 3,
            productivity: review.productivity ?? 75,
            quality: review.quality ?? 75,
            teamwork: review.teamwork ?? 75,
            initiative: review.initiative ?? 75,
            reliability: review.reliability ?? 75,
            summary: review.summary || '',
            strengths: (review.strengths || []).join('\n'),
            improvements: (review.improvements || []).join('\n'),
            status: review.status
          }
        : blank
    );
  }, [open, review]);

  const lines = (s) => String(s).split('\n').map((x) => x.trim()).filter(Boolean);

  const submit = async (status) => {
    const payload = {
      employee_id: Number(form.employee_id),
      cycle_id: form.cycle_id ? Number(form.cycle_id) : null,
      rating: Number(form.rating),
      potential: Number(form.potential),
      productivity: Number(form.productivity),
      quality: Number(form.quality),
      teamwork: Number(form.teamwork),
      initiative: Number(form.initiative),
      reliability: Number(form.reliability),
      summary: form.summary,
      strengths: lines(form.strengths),
      improvements: lines(form.improvements),
      status
    };
    setBusy(true);
    try {
      if (form.id) await api.patch(`/api/reviews/${form.id}`, payload);
      else await api.post('/api/reviews', payload);
      toast(status === 'published' ? 'Review published' : 'Review saved as draft', 'success');
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
      title={form.id ? 'Edit review' : 'New performance review'}
      subtitle="Scores feed the rating distribution and payroll-linked increments"
      icon="trophy"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="outline" loading={busy} onClick={() => submit('draft')}>Save draft</Button>
          <Button variant="primary" icon="share" loading={busy} onClick={() => submit('published')}>Publish</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Employee *</span>
            <Select
              value={String(form.employee_id)}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              placeholder="Choose employee"
              disabled={!!form.id}
              options={team.map((p) => ({ value: String(p.id), label: `${p.full_name} — ${p.designation}` }))}
            />
          </label>
          <label className="block">
            <span className="label">Cycle</span>
            <Select
              value={String(form.cycle_id)}
              onChange={(e) => setForm({ ...form, cycle_id: e.target.value })}
              placeholder="Active cycle"
              options={cycles.map((c) => ({ value: String(c.id), label: `${c.name} (${c.period})` }))}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Overall rating — {Number(form.rating).toFixed(1)} ({ratingWord(Number(form.rating))})</span>
            <input type="range" min="1" max="5" step="0.5" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="w-full" />
          </label>
          <label className="block">
            <span className="label">Potential — {form.potential}/5</span>
            <input type="range" min="1" max="5" step="1" value={form.potential} onChange={(e) => setForm({ ...form, potential: e.target.value })} className="w-full" />
          </label>
        </div>

        <div>
          <span className="label">Competency scores</span>
          <div className="space-y-2">
            {SUB_SCORES.map((s) => (
              <label key={s.key} className="block">
                <span className="text-[11px] font-bold text-mute">{s.label} — {form[s.key]}</span>
                <input type="range" min="0" max="100" step="5" value={form[s.key]} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} className="w-full" />
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="label">Strengths (one per line)</span>
          <Textarea rows={3} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} placeholder="Owns the mobile release train end to end" />
        </label>
        <label className="block">
          <span className="label">Focus areas (one per line)</span>
          <Textarea rows={3} value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} placeholder="Delegation across the pod" />
        </label>
        <label className="block">
          <span className="label">Summary</span>
          <Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
}

export default function Performance() {
  const { can, toast } = useStore();
  const [tab, setTab] = useState('mine');
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const manages = can('performance.manage');

  const { data, loading, reload } = useResource(
    () => api.get(`/api/reviews?scope=${tab}${cycleId ? `&cycle_id=${cycleId}` : ''}${status ? `&status=${status}` : ''}`),
    [tab, cycleId, status]
  );
  const { data: cycles } = useResource(() => api.get('/api/review-cycles'), []);
  const { data: team } = useResource(() => (manages ? api.get('/api/employees?limit=200') : Promise.resolve({ rows: [] })), [manages]);

  const rows = data?.rows || [];
  const totals = data?.totals || {};
  const distribution = (data?.distribution || []).map((d) => ({ label: `${d.band}★`, value: d.count }));
  const activeCycle = (cycles?.rows || []).find((c) => c.status === 'active');

  return (
    <div className="page">
      <PageHeader
        icon="trophy"
        title="Performance"
        subtitle="Review cycles, ratings and competency tracking"
        actions={
          manages ? (
            <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setModal(true); }}>
              New review
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="trophy" label="Reviews" value={totals.count ?? 0} tone="indigo" hint={activeCycle ? `Active: ${activeCycle.name}` : undefined} />
        <Stat icon="star" label="Average rating" value={totals.avgRating ? `${totals.avgRating} / 5` : '—'} tone="amber" />
        <Stat icon="share" label="Published" value={totals.published ?? 0} tone="emerald" />
        <Stat icon="clock" label="In progress" value={totals.pending ?? 0} tone="rose" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card padded={false}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="font-bold">Active cycles</div>
            <p className="text-[11px] text-mute">Completion and average rating per cycle</p>
          </div>
          {(cycles?.rows || []).length ? (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr><th>Cycle</th><th>Period</th><th>Status</th><th>Reviews</th><th>Avg</th></tr>
                </thead>
                <tbody>
                  {(cycles?.rows || []).map((c) => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => setCycleId(String(c.id))} style={cycleId === String(c.id) ? { background: 'var(--brand-soft)' } : undefined}>
                      <td className="font-bold">{c.name}</td>
                      <td className="text-mute">{c.period}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>{c.completed}/{c.reviews}</td>
                      <td className="font-bold">{c.avgRating ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4"><EmptyState icon="calendar" title="No review cycles" message="HR can start a cycle from the admin panel." compact /></div>
          )}
        </Card>

        <Card>
          <div className="mb-2 font-bold">Rating distribution</div>
          {distribution.some((d) => d.value > 0) ? (
            <BarChart data={distribution} height={150} valueFormat={(v) => `${v}`} />
          ) : (
            <p className="text-xs text-mute">No ratings in this selection yet.</p>
          )}
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'mine', label: 'My reviews', icon: '🙋' },
            ...(manages || can('performance.view_team') ? [{ key: 'team', label: 'Team reviews', icon: '👥' }] : [])
          ]}
        />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Select className="input-sm w-auto" value={cycleId} onChange={(e) => setCycleId(e.target.value)} placeholder="All cycles" options={(cycles?.rows || []).map((c) => ({ value: String(c.id), label: c.name }))} />
          {['', 'draft', 'in_progress', 'published'].map((s) => (
            <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-active' : ''}`}>
              {s ? titleCase(s) : 'Any'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4"><Card><SkeletonRows rows={4} /></Card></div>
      ) : rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              canManage={manages}
              isMine={tab === 'mine'}
              onChange={() => reload({ silent: true })}
              onEdit={(rev) => { setEditing(rev); setModal(true); }}
              onDelete={setRemoving}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="trophy"
            title="No reviews in this view"
            message={manages ? 'Start a review to record ratings and feedback.' : 'Your next review will appear here once your manager publishes it.'}
            action={manages ? <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setModal(true); }}>New review</Button> : null}
          />
        </Card>
      )}

      <ReviewModal
        open={modal}
        onClose={() => setModal(false)}
        onDone={() => reload({ silent: true })}
        review={editing}
        cycles={cycles?.rows || []}
        team={team?.rows || []}
      />
      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete this review?"
        message={`The review for ${removing?.full_name || ''} will be permanently removed.`}
        confirmLabel="Delete review"
        onConfirm={async () => {
          await api.del(`/api/reviews/${removing.id}`, {});
          toast('Review deleted', 'warn');
          reload({ silent: true });
        }}
      />
    </div>
  );
}
