import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, Donut, EmptyState, Icon, IconButton, Input, Modal, PageHeader,
  Progress, SectionTitle, Select, SkeletonRows, Stat, StatusBadge, Tabs, Textarea, Toggle
} from '../ui/index.jsx';
import { addDaysISO, countdown, fmtDate, fmtDateShort, relative, todayISO } from '../lib/format.js';

function ApplyModal({ open, onClose, types, balances, onDone }) {
  const { toast } = useStore();
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(addDaysISO(todayISO(), 1));
  const [end, setEnd] = useState(addDaysISO(todayISO(), 1));
  const [half, setHalf] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if (open && !typeId && types?.length) setTypeId(String(types[0].id));
  }, [open, types, typeId]);

  const type = types?.find((t) => String(t.id) === typeId);
  const balance = balances?.find((b) => b.leave_type_id === Number(typeId));
  const days = useMemo(() => {
    if (half) return 0.5;
    let count = 0;
    let cur = start;
    while (cur <= end) {
      const dow = new Date(`${cur}T00:00:00Z`).getUTCDay();
      if (dow !== 0 && dow !== 6) count += 1;
      cur = addDaysISO(cur, 1);
    }
    return Math.max(1, count);
  }, [start, end, half]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/leaves', {
        leave_type_id: Number(typeId),
        start_date: start,
        end_date: half ? start : end,
        half_day: half,
        reason
      });
      toast(`Leave applied — ${res.days} day(s) sent for approval`, 'success');
      setReason('');
      onDone?.();
      onClose();
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for leave"
      subtitle="Routes to your manager, then HR if needed"
      icon="calendarCheck"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit} icon="check">
            Submit request
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="label">Leave type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(types || []).map((t) => {
              const b = balances?.find((x) => x.leave_type_id === t.id);
              const active = String(t.id) === typeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeId(String(t.id))}
                  className="rounded-xl border p-2.5 text-left transition active:scale-[.98]"
                  style={{ borderColor: active ? 'var(--brand)' : 'var(--border)', background: active ? 'var(--brand-soft)' : 'var(--surface)' }}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <span>{t.icon}</span>
                    {t.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold text-mute">
                    {b ? `${b.available} of ${b.entitled} left` : t.annual_quota ? `${t.annual_quota} days/yr` : 'Unpaid'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">From</span>
            <Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />
          </label>
          <label>
            <span className="label">To</span>
            <Input type="date" value={half ? start : end} disabled={half} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <Toggle checked={half} onChange={setHalf} label="Half day" description="Only applies when a single date is selected" />

        <label className="block">
          <span className="label">Reason</span>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Let your manager know the context (optional for sick leave)" />
        </label>

        <div className="flex items-center justify-between rounded-xl soft px-3 py-2.5">
          <span className="text-xs font-semibold">Total</span>
          <Badge tone="indigo">{days} day{days === 1 ? '' : 's'}</Badge>
        </div>

        {balance && type?.annual_quota > 0 && (
          <Progress label={`${type.name} utilisation`} value={(balance.used / Math.max(1, balance.entitled)) * 100} tone={balance.available < days ? 'rose' : 'indigo'} />
        )}
        {balance && balance.available < days && type?.annual_quota > 0 && (
          <p className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(225,29,72,.08)', color: 'var(--danger)' }}>
            Not enough balance — only {balance.available} day(s) remaining in {type.name}.
          </p>
        )}
        {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
      </div>
    </Modal>
  );
}

function LeaveRow({ r, canApprove, onDecide, onCancel, busy }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${r.leave_color}22` }}>
        {r.leave_icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{r.leave_name}</span>
          <Badge tone="slate">{r.days} day{r.days === 1 ? '' : 's'}</Badge>
          {r.half_day ? <Badge tone="violet">Half day</Badge> : null}
          <StatusBadge status={r.status} />
        </div>
        <p className="mt-0.5 text-xs text-mute">
          {fmtDateShort(r.start_date)} → {fmtDateShort(r.end_date)} · applied {relative(r.created_at)}
          {r.approver_name ? ` · approver ${r.approver_name}` : ''}
        </p>
        {r.reason && <p className="mt-1 text-xs text-soft">“{r.reason}”</p>}
        {r.decision_note && r.status !== 'pending' && <p className="mt-1 text-[11px] font-semibold text-mute">Note: {r.decision_note}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {r.status === 'pending' && canApprove && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" onClick={() => onDecide(r, 'approve')} loading={busy === `a${r.id}`}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => onDecide(r, 'reject')} loading={busy === `r${r.id}`}>Reject</Button>
          </div>
        )}
        {r.status === 'pending' && !canApprove && (
          <Button size="sm" variant="ghost" icon="x" onClick={() => onCancel(r)}>Withdraw</Button>
        )}
        {['approved', 'pending'].includes(r.status) && !canApprove && (
          <Button size="sm" variant="ghost" onClick={() => onCancel(r)}>Cancel</Button>
        )}
      </div>
    </div>
  );
}

export default function Leaves() {
  const { can, toast } = useStore();
  const [tab, setTab] = useState('mine');
  const [applyOpen, setApplyOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const { data: types } = useResource(() => api.get('/api/leave-types'), []);
  const { data: bal } = useResource(() => api.get('/api/leaves/balances'), []);
  const { data, loading, reload } = useResource(
    () => api.get(`/api/leaves?scope=${tab}${status ? `&status=${status}` : ''}`),
    [tab, status]
  );

  const decide = async (r, action) => {
    setBusy(`${action[0]}${r.id}`);
    try {
      await api.post(`/api/leaves/${r.id}/${action}`, { note: action === 'reject' ? 'Coverage not available' : null });
      toast(`Leave ${action === 'approve' ? 'approved ✅' : 'rejected'}`, action === 'approve' ? 'success' : 'warn');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const rows = data?.rows || [];
  const donut = useMemo(() => {
    const counts = { approved: 0, pending: 0, rejected: 0, cancelled: 0 };
    rows.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return [
      { label: 'Approved', value: counts.approved, color: '#10b981' },
      { label: 'Pending', value: counts.pending, color: '#f59e0b' },
      { label: 'Rejected', value: counts.rejected, color: '#f43f5e' },
      { label: 'Cancelled', value: counts.cancelled, color: '#94a3b8' }
    ].filter((d) => d.value > 0);
  }, [rows]);

  const tabs = [
    { key: 'mine', label: 'My leaves', icon: '🙋' },
    ...(can('leave.approve') ? [{ key: 'team', label: 'Team requests', icon: '👥', count: data?.counts?.awaitingMe }] : []),
    ...(can('leave.view_company') ? [{ key: 'company', label: 'Company', icon: '🏢' }] : [])
  ];

  return (
    <div className="page">
      <PageHeader
        icon="calendarCheck"
        title="Leaves"
        subtitle="Apply, track and approve time off"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setApplyOpen(true)}>
            Apply leave
          </Button>
        }
      />

      <Tabs className="mb-4" tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'mine' && (
        <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <SectionTitle icon="calendarCheck" title="My balance" subtitle={`${new Date().getUTCFullYear()} entitlement`} />
            {bal?.balances?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {bal.balances.map((b) => (
                  <div key={b.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        <span>{b.leave_icon}</span>
                        {b.leave_name}
                      </span>
                      <span className="text-xs font-black">{b.available} left</span>
                    </div>
                    <Progress className="mt-2" height={6} value={b.entitled ? (b.used / b.entitled) * 100 : 0} tone={b.available <= 1 ? 'rose' : 'indigo'} />
                    <p className="mt-1 text-[10px] font-semibold text-mute">
                      {b.used} used · {b.pending} pending · {b.entitled} entitled
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon="calendar" title="No balances allocated" />
            )}
          </Card>
          <Card>
            <SectionTitle icon="pie" title="Request mix" />
            {donut.length ? (
              <Donut data={donut} size={140} center={<div><div className="text-xl font-black">{rows.length}</div><div className="text-[10px] font-bold text-mute">requests</div></div>} />
            ) : (
              <EmptyState compact icon="pie" title="No requests yet" />
            )}
          </Card>
        </div>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
          <span className="text-sm font-bold">{tab === 'mine' ? 'My requests' : tab === 'team' ? 'Waiting for decisions' : 'All requests'}</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {['', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
              <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-active' : ''}`}>
                {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : rows.length ? (
          <div className="divide-line">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 border-b px-3 py-3 last:border-0" style={{ borderColor: 'var(--border)' }}>
                {tab !== 'mine' && <Avatar person={r} size={38} />}
                <div className="min-w-0 flex-1">
                  <LeaveRow
                    r={r}
                    canApprove={can('leave.approve') && tab !== 'mine'}
                    busy={busy}
                    onDecide={decide}
                    onCancel={(row) => setConfirmCancel(row)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon="calendarCheck"
              title={tab === 'team' ? 'No pending requests' : 'No leave requests yet'}
              message={tab === 'team' ? 'Your team has nothing waiting for a decision.' : 'Apply for leave and it will appear here.'}
              action={tab === 'mine' ? <Button variant="primary" icon="plus" onClick={() => setApplyOpen(true)}>Apply leave</Button> : null}
            />
          </div>
        )}
      </Card>

      <ApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        types={(types?.rows || []).filter((t) => t.active && t.applies_to === 'all')}
        balances={bal?.balances}
        onDone={() => reload({ silent: true })}
      />

      <Confirm
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Cancel this leave?"
        message={`${confirmCancel?.leave_name} from ${fmtDate(confirmCancel?.start_date)}. Your balance will be restored.`}
        confirmLabel="Cancel leave"
        onConfirm={async () => {
          await api.post(`/api/leaves/${confirmCancel.id}/cancel`, { reason: 'Cancelled by employee' });
          toast('Leave cancelled', 'warn');
          reload({ silent: true });
        }}
      />
    </div>
  );
}
