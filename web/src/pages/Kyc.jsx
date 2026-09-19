import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, Input, Modal, PageHeader, Progress, Ring,
  SectionTitle, SkeletonRows, Stat, StatusBadge, Tabs
} from '../ui/index.jsx';
import { relative } from '../lib/format.js';

const TYPES = ['Aadhaar Verification', 'PAN Verification', 'Passport Verification', 'Background Check', 'Address Verification', 'Education Verification'];

function SubmitModal({ open, onClose, onDone }) {
  const { toast } = useStore();
  const [type, setType] = useState(TYPES[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit KYC check"
      subtitle="Verification runs asynchronously and notifies you when complete"
      icon="shield"
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
                await api.post('/api/kyc', { type, note });
                toast('KYC check submitted', 'success');
                onDone?.();
                onClose();
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Submit
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="label">Check type</span>
          <div className="grid gap-1.5">
            {TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold ${type === t ? '' : ''}`} style={{ borderColor: type === t ? 'var(--brand)' : 'var(--border)', background: type === t ? 'var(--brand-soft)' : 'var(--surface)' }}>
                <Icon name="shield" size={15} />
                {t}
              </button>
            ))}
          </div>
        </div>
        <label className="block"><span className="label">Note (optional)</span><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reference number or comments" /></label>
      </div>
    </Modal>
  );
}

export default function Kyc() {
  const { can, toast } = useStore();
  const [tab, setTab] = useState('mine');
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [note, setNote] = useState('');
  const { data, loading, reload } = useResource(() => api.get(`/api/kyc?scope=${tab}`), [tab]);
  const rows = data?.rows || [];
  const totals = data?.totals;

  const review = async (status) => {
    try {
      await api.patch(`/api/kyc/${reviewing.id}`, { status, note, score: status === 'verified' ? reviewing.score || 95 : reviewing.score || 45 });
      toast(`KYC ${status}`, status === 'verified' ? 'success' : 'warn');
      setReviewing(null);
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="shield"
        title="KYC verification"
        subtitle="Identity, address and background verification status"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
            New check
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="grid place-items-center">
          <Ring value={totals?.coverage || 0} size={150} tone={totals?.coverage >= 80 ? 'emerald' : 'amber'}>
            <div>
              <div className="text-2xl font-black">{totals?.coverage || 0}%</div>
              <div className="text-[10px] font-bold text-mute">verified</div>
            </div>
          </Ring>
          <div className="mt-3 grid w-full grid-cols-3 gap-2 text-center">
            <div><div className="text-lg font-black text-emerald-600">{totals?.verified ?? 0}</div><div className="text-[10px] font-bold text-mute">Verified</div></div>
            <div><div className="text-lg font-black text-amber-600">{totals?.pending ?? 0}</div><div className="text-[10px] font-bold text-mute">Pending</div></div>
            <div><div className="text-lg font-black text-rose-600">{totals?.flagged ?? 0}</div><div className="text-[10px] font-bold text-mute">Flagged</div></div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon="shield" label="Total checks" value={rows.length} tone="indigo" />
          <Stat icon="checkCircle" label="Verified" value={totals?.verified ?? 0} tone="emerald" />
          <Stat icon="clock" label="Pending" value={totals?.pending ?? 0} tone="amber" />
          <Stat icon="alert" label="Flagged" value={totals?.flagged ?? 0} tone="rose" />
        </div>
      </div>

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'mine', label: 'My verifications', icon: '🙋' },
          ...(can('kyc.review') ? [{ key: 'all', label: 'All employees', icon: '👥' }] : [])
        ]}
      />

      <Card padded={false}>
        {loading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : rows.length ? (
          <div className="divide-line">
            {rows.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-3 py-3">
                {tab === 'all' && <Avatar person={k} size={38} />}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl soft">
                  <Icon name="shield" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold">{k.type}</span>
                    <StatusBadge status={k.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-mute">
                    {tab === 'all' ? `${k.full_name} · ${k.department || ''} · ` : ''}submitted {relative(k.submitted_at)}
                    {k.score ? ` · score ${k.score}` : ''}
                  </p>
                  {k.note && <p className="mt-1 text-[11px] text-soft">“{k.note}”</p>}
                  {k.score != null && <Progress className="mt-1.5 max-w-[220px]" height={5} value={k.score} tone={k.score >= 80 ? 'emerald' : k.score >= 60 ? 'amber' : 'rose'} />}
                </div>
                {can('kyc.review') && k.status !== 'verified' && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="primary" icon="check" onClick={() => { setReviewing(k); setNote(k.note || ''); }}>Review</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState icon="shield" title="No KYC checks yet" message="Submit your first identity verification." action={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>New check</Button>} />
          </div>
        )}
      </Card>

      <SubmitModal open={open} onClose={() => setOpen(false)} onDone={() => reload({ silent: true })} />
      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={`Review ${reviewing?.type || ''}`}
        subtitle={reviewing ? `${reviewing.full_name || 'Employee'} · submitted ${relative(reviewing.submitted_at)}` : ''}
        icon="shield"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => review('flagged')}>Flag issue</Button>
            <Button variant="primary" icon="check" onClick={() => review('verified')}>Verify</Button>
          </>
        }
      >
        <label className="block">
          <span className="label">Reviewer note</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Documents match the HR record" />
        </label>
      </Modal>
    </div>
  );
}
