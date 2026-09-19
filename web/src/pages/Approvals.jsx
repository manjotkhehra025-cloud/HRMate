import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, Modal, PageHeader, SkeletonRows, Stat, StatusBadge, Tabs, Textarea
} from '../ui/index.jsx';
import { csvDownload, fmtDate, relative } from '../lib/format.js';

export default function Approvals() {
  const { can, toast } = useStore();
  const [tab, setTab] = useState('inbox');
  const [status, setStatus] = useState('pending');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState([]);
  const [decide, setDecide] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, reload } = useResource(
    () => api.get(`/api/approvals?scope=${tab}${status ? `&status=${status}` : ''}${type ? `&type=${type}` : ''}`),
    [tab, status, type]
  );

  const rows = data?.rows || [];
  const counts = data?.counts;

  const submit = async (action) => {
    setBusy(true);
    try {
      if (selected.length > 1) {
        const res = await api.post('/api/approvals/bulk', { ids: selected, action, note });
        toast(`${res.count} request(s) ${action}d`, action === 'approve' ? 'success' : 'warn');
        setSelected([]);
      } else {
        await api.post(`/api/approvals/${decide.id}/decide`, { action, note });
        toast(`Request ${action}d`, action === 'approve' ? 'success' : 'warn');
      }
      setDecide(null);
      setNote('');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const tabs = [
    ...(can('approval.inbox') ? [{ key: 'inbox', label: 'My inbox', icon: '📥', count: counts?.inbox }] : []),
    { key: 'mine', label: 'I requested', icon: '📤', count: counts?.mine },
    ...(can('leave.view_company') || can('report.team') ? [{ key: 'all', label: 'All activity', icon: '🗂️' }] : [])
  ];

  return (
    <div className="page">
      <PageHeader
        icon="checkCircle"
        title="Approvals"
        subtitle="Leave, shift swaps, overtime, expenses and attendance fixes in one queue"
        actions={
          <>
            <Button variant="outline" icon="download" onClick={() => csvDownload(`approvals-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((r) => ({ id: r.id, type: r.type, requester: r.full_name, summary: r.summary, status: r.status, created: r.created_at })))}>
              Export
            </Button>
            {selected.length > 0 && (
              <>
                <Button variant="primary" icon="check" onClick={() => setDecide({ bulk: true })}>
                  Approve {selected.length}
                </Button>
                <Button variant="outline" icon="x" onClick={() => setDecide({ bulk: true, action: 'reject' })}>
                  Reject
                </Button>
              </>
            )}
          </>
        }
      />

      <Tabs className="mb-4" tabs={tabs} active={tab} onChange={(k) => { setTab(k); setSelected([]); }} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="checkCircle" label="Waiting on me" value={counts?.inbox ?? '—'} tone="amber" />
        <Stat icon="check" label="Approved this month" value={counts?.approvedThisMonth ?? '—'} tone="emerald" />
        <Stat icon="clock" label="Avg decision time" value={counts ? `${counts.avgDecisionHours}h` : '—'} tone="indigo" />
        <Stat icon="history" label="My open requests" value={counts?.mine ?? '—'} tone="sky" />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-1.5">
            {['pending', 'approved', 'rejected', ''].map((s) => (
              <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-active' : ''}`}>
                {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {(data?.types || []).map((t) => (
              <button key={t.key} type="button" onClick={() => setType(type === t.key ? '' : t.key)} className={`chip ${type === t.key ? 'chip-active' : ''}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : rows.length ? (
          <div className="divide-line">
            {rows.map((r) => (
              <div key={`${r.type}-${r.ref_id}-${r.id}`} className="flex items-start gap-3 px-3 py-3">
                {tab === 'inbox' && status === 'pending' && (
                  <input type="checkbox" className="checkbox mt-3" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} aria-label="Select request" />
                )}
                <Avatar person={r} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{r.full_name}</span>
                    <span className="text-[11px] text-mute">{r.designation} {r.department ? `· ${r.department}` : ''}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.detail && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl soft px-3 py-2">
                      <span className="text-base">{r.detail.icon}</span>
                      <span className="text-xs font-bold">{r.detail.label}</span>
                      <Badge tone="slate">{r.detail.value}</Badge>
                      <span className="text-[11px] text-mute">{r.detail.range}</span>
                    </div>
                  )}
                  {r.detail?.reason && <p className="mt-1 text-xs text-soft">“{r.detail.reason}”</p>}
                  <p className="mt-1 text-[11px] text-mute">{r.summary} · raised {relative(r.created_at)}</p>
                </div>
                {tab === 'inbox' && r.status === 'pending' ? (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="primary" icon="check" onClick={() => { setSelected([r.id]); setDecide(r); }}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" icon="x" onClick={() => { setSelected([r.id]); setDecide({ ...r, action: 'reject' }); }}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold text-mute">{r.decided_at ? relative(r.decided_at) : '—'}</p>
                    {r.decision_note && <p className="text-[10px] text-mute">{r.decision_note}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon="checkCircle"
              title={tab === 'inbox' ? 'Inbox zero 🎉' : 'Nothing here'}
              message={tab === 'inbox' ? 'Every request in your queue has been decided.' : 'Change the status filter to see more activity.'}
            />
          </div>
        )}
      </Card>

      <Modal
        open={!!decide}
        onClose={() => setDecide(null)}
        title={decide?.action === 'reject' ? 'Reject request' : 'Approve request'}
        subtitle={decide?.bulk ? `${selected.length} selected requests` : decide?.summary}
        icon={decide?.action === 'reject' ? 'x' : 'check'}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDecide(null)}>Cancel</Button>
            <Button variant={decide?.action === 'reject' ? 'danger' : 'primary'} loading={busy} onClick={() => submit(decide?.action === 'reject' ? 'reject' : 'approve')}>
              {decide?.action === 'reject' ? 'Reject' : 'Approve'}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="label">Note {decide?.action === 'reject' ? '(recommended)' : '(optional)'}</span>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context for the requester…" />
        </label>
        <p className="mt-2 text-[11px] text-mute">
          The requester gets a push notification immediately, and the decision is written to the audit log.
        </p>
      </Modal>
    </div>
  );
}
