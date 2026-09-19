import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource, useLive } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, EmptyState, Icon, IconButton, Input, Modal, PageHeader,
  SearchInput, Select, SkeletonRows, Stat, StatusBadge, Tabs, Textarea
} from '../ui/index.jsx';
import { fmtDateTime, relative, titleCase } from '../lib/format.js';

const PRIORITY_TONE = { high: 'rose', medium: 'amber', low: 'slate' };

function TicketDrawer({ ticket, onClose, onChange }) {
  const { employee: me, can, toast } = useStore();
  const [detail, setDetail] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignee, setAssignee] = useState('');
  const { data: staff } = useResource(
    () => (can('ticket.assign') ? api.get('/api/employees?limit=200') : Promise.resolve({ rows: [] })),
    []
  );

  const load = () => api.get(`/api/tickets/${ticket.id}`).then(setDetail).catch(() => {});
  useEffect(() => {
    load();
  }, [ticket.id]);

  const patch = async (body, msg) => {
    setBusy(true);
    try {
      await api.patch(`/api/tickets/${ticket.id}`, body);
      toast(msg, 'success');
      await load();
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const t = detail?.ticket;
  const isMine = t?.employee_id === me?.id;

  return (
    <Modal
      open={!!ticket}
      onClose={onClose}
      title={t?.subject || 'Ticket'}
      subtitle={t ? `#${t.id} · ${titleCase(t.category)} · raised ${relative(t.created_at)}` : ''}
      icon="lifebuoy"
      size="lg"
      footer={
        t && (
          <div className="flex w-full flex-wrap items-center gap-2">
            {can('ticket.assign') && (
              <Select
                className="input-sm w-auto"
                value={String(assignee || t.assignee_id || '')}
                onChange={(e) => {
                  setAssignee(e.target.value);
                  patch({ assignee_id: e.target.value ? Number(e.target.value) : null }, 'Assignee updated');
                }}
                placeholder="Unassigned"
                options={(staff?.rows || []).map((p) => ({ value: String(p.id), label: p.full_name }))}
              />
            )}
            <span className="ml-auto flex flex-wrap gap-2">
              {t.status === 'open' && <Button size="sm" variant="soft" loading={busy} onClick={() => patch({ status: 'in_progress' }, 'Moved to in progress')}>Start</Button>}
              {['open', 'in_progress'].includes(t.status) && <Button size="sm" variant="outline" loading={busy} onClick={() => patch({ status: 'escalated' }, 'Ticket escalated')}>Escalate</Button>}
              {!['resolved', 'closed'].includes(t.status) && <Button size="sm" variant="primary" icon="check" loading={busy} onClick={() => patch({ status: 'resolved' }, 'Marked resolved')}>Resolve</Button>}
              {isMine && t.status === 'resolved' && (
                <Button size="sm" variant="primary" icon="star" loading={busy} onClick={() => api.post(`/api/tickets/${t.id}/rate`, { rating: 5 }).then(() => { toast('Thanks for the feedback!', 'success'); load(); onChange?.(); })}>
                  Rate &amp; close
                </Button>
              )}
            </span>
          </div>
        )
      }
    >
      {!t ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <Badge tone={PRIORITY_TONE[t.priority]} size="sm">{titleCase(t.priority)} priority</Badge>
            <Badge tone="slate" size="sm">SLA {t.slaHours ?? 0}h elapsed</Badge>
            {t.due_date && <span className="text-[11px] text-mute">due {fmtDateTime(t.due_date)}</span>}
          </div>

          <div className="flex items-center gap-2.5 rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
            <Avatar person={t} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{t.requester}</div>
              <div className="truncate text-[11px] text-mute">{t.designation}</div>
            </div>
            <div className="text-right text-[11px] text-mute">
              <div>Assignee</div>
              <div className="font-bold text-soft">{t.assignee || 'Unassigned'}</div>
            </div>
          </div>

          {t.body && <p className="whitespace-pre-wrap text-sm leading-relaxed text-soft">{t.body}</p>}

          {t.rating ? (
            <div className="rounded-xl p-3 text-sm font-bold" style={{ background: 'var(--bg-soft)' }}>
              Rated {t.rating}/5 by {t.requester}
            </div>
          ) : null}

          <div>
            <div className="mb-2 text-xs font-bold text-mute">Conversation ({detail?.comments?.length || 0})</div>
            <div className="space-y-2">
              {(detail?.comments || []).map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar person={c} size={28} />
                  <div className="min-w-0 flex-1 rounded-xl px-3 py-2" style={{ background: 'var(--bg-soft)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{c.author}</span>
                      <span className="text-[10px] text-mute">{relative(c.created_at)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-soft">{c.body}</p>
                  </div>
                </div>
              ))}
              {!(detail?.comments || []).length && <p className="text-xs text-mute">No replies yet.</p>}
            </div>
            <div className="mt-2 flex items-start gap-2">
              <Textarea rows={2} className="flex-1" value={comment} placeholder="Add a reply…" onChange={(e) => setComment(e.target.value)} />
              <Button
                variant="primary"
                disabled={!comment.trim()}
                onClick={async () => {
                  try {
                    await api.post(`/api/tickets/${t.id}/comments`, { body: comment });
                    setComment('');
                    await load();
                    onChange?.();
                  } catch (err) {
                    toast(err.message, 'error');
                  }
                }}
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function NewTicketModal({ open, onClose, onDone }) {
  const { toast } = useStore();
  const [form, setForm] = useState({ subject: '', body: '', category: 'it', priority: 'medium' });
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !cats.length) api.get('/api/tickets?scope=mine').then((r) => setCats(r.categories || [])).catch(() => {});
  }, [open]);

  const submit = async () => {
    if (!form.subject.trim()) {
      toast('Add a subject', 'warn');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/tickets', form);
      toast('Ticket raised — the support team has been notified', 'success');
      setForm({ subject: '', body: '', category: 'it', priority: 'medium' });
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
      title="Raise a ticket"
      subtitle="IT, HR, payroll, facilities and admin requests"
      icon="lifebuoy"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Submit ticket</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label">Subject *</span>
          <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Laptop will not connect to the VPN" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Category</span>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={cats.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
          </label>
          <label className="block">
            <span className="label">Priority</span>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High — blocking' }]} />
          </label>
        </div>
        <label className="block">
          <span className="label">Details</span>
          <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What happened, what you tried, and any error messages…" />
        </label>
      </div>
    </Modal>
  );
}

export default function Helpdesk() {
  const { can } = useStore();
  const [tab, setTab] = useState('mine');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null);
  const [open, setOpen] = useState(false);
  const bump = useLive();

  const { data, loading, reload } = useResource(
    () => api.get(`/api/tickets?scope=${tab}${status ? `&status=${status}` : ''}${category ? `&category=${category}` : ''}${priority ? `&priority=${priority}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    [tab, status, category, priority, search, bump]
  );

  const rows = data?.rows || [];
  const totals = data?.totals || {};
  const cats = data?.categories || [];
  const views = can('ticket.view_all')
    ? [{ key: 'mine', label: 'My tickets', icon: '🙋' }, { key: 'assigned', label: 'Queue', icon: '📥' }, { key: 'all', label: 'All tickets', icon: '🗂️' }]
    : [{ key: 'mine', label: 'My tickets', icon: '🙋' }];

  return (
    <div className="page">
      <PageHeader
        icon="lifebuoy"
        title="Helpdesk"
        subtitle="Raise, track and resolve internal support requests"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
            Raise ticket
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat icon="ticket" label="Open" value={totals.open ?? 0} tone="brand" />
        <Stat icon="clock" label="In progress" value={totals.inProgress ?? 0} tone="amber" />
        <Stat icon="checkCircle" label="Resolved" value={totals.resolved ?? 0} tone="emerald" />
        <Stat icon="alert" label="Escalated" value={totals.escalated ?? 0} tone="rose" />
        <Stat icon="history" label="SLA breached" value={totals.breached ?? 0} tone="violet" />
      </div>

      <Card padded={false} className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
          <Tabs active={tab} onChange={setTab} tabs={views} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SearchInput className="min-w-[150px]" value={search} onChange={setSearch} placeholder="Search tickets…" />
            <Select className="input-sm w-auto" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" options={cats.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 p-3">
          {['', 'open', 'in_progress', 'escalated', 'resolved', 'closed'].map((s) => (
            <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-active' : ''}`}>
              {s ? titleCase(s) : 'Any status'}
            </button>
          ))}
          <span className="mx-1 w-px" style={{ background: 'var(--border)' }} />
          {['', 'high', 'medium', 'low'].map((p) => (
            <button key={p || 'any'} type="button" onClick={() => setPriority(p)} className={`chip ${priority === p ? 'chip-active' : ''}`}>
              {p ? `${titleCase(p)} priority` : 'Any priority'}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Card><SkeletonRows rows={6} /></Card>
      ) : rows.length ? (
        <Card padded={false}>
          <div className="divide-line">
            {rows.map((t) => (
              <button key={t.id} type="button" onClick={() => setActive(t)} className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[var(--bg-soft)]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl soft">
                  <Icon name="ticket" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold">{t.subject}</span>
                    <StatusBadge status={t.status} />
                    <Badge tone={PRIORITY_TONE[t.priority]} size="sm">{titleCase(t.priority)}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-mute">
                    #{t.id} · {titleCase(t.category)} · {t.requester} · {relative(t.created_at)} · {t.slaHours}h elapsed
                    {t.assignee ? ` · ${t.assignee}` : ' · unassigned'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-mute">
                  {t.comment_count > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-bold">
                      <Icon name="chat" size={13} /> {t.comment_count}
                    </span>
                  )}
                  {t.rating ? <span className="text-[11px] font-bold text-amber-600">★ {t.rating}</span> : null}
                  <Icon name="chevronRight" size={15} />
                </div>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon="lifebuoy"
            title="No tickets here"
            message="Everything looks quiet in this view. Raise a ticket if something needs attention."
            action={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Raise ticket</Button>}
          />
        </Card>
      )}

      {active && <TicketDrawer ticket={active} onClose={() => setActive(null)} onChange={() => reload({ silent: true })} />}
      <NewTicketModal open={open} onClose={() => setOpen(false)} onDone={() => reload({ silent: true })} />
    </div>
  );
}
