import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, EmptyState, Icon, Input, Modal, PageHeader, Progress,
  Select, SkeletonRows, Stat, StatusBadge, Tabs
} from '../ui/index.jsx';
import { csvDownload, fmtDateTime, relative, titleCase } from '../lib/format.js';

const PLATFORM_ICON = { iOS: '📱', Android: '🤖', iPadOS: '📲', Web: '💻' };

function EnrollModal({ open, onClose, onDone }) {
  const { toast } = useStore();
  const [form, setForm] = useState({ label: '', platform: 'Android', model: '' });
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll a device"
      subtitle="New devices start as pending until an admin trusts them"
      icon="device"
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
                await api.post('/api/devices', { ...form, model: form.model || 'Unknown device' });
                toast('Device enrolled — awaiting trust', 'success');
                setForm({ label: '', platform: 'Android', model: '' });
                onDone?.();
                onClose();
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Enroll
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label">Label</span>
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Work phone" />
        </label>
        <label className="block">
          <span className="label">Platform</span>
          <Select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} options={Object.keys(PLATFORM_ICON).map((p) => ({ value: p, label: `${PLATFORM_ICON[p]} ${p}` }))} />
        </label>
        <label className="block">
          <span className="label">Model</span>
          <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Pixel 9 Pro" />
        </label>
      </div>
    </Modal>
  );
}

export default function Devices() {
  const { can, toast } = useStore();
  const manages = can('devices.manage');
  const [tab, setTab] = useState(manages ? 'all' : 'mine');
  const [status, setStatus] = useState('');
  const [platform, setPlatform] = useState('');
  const [enroll, setEnroll] = useState(false);
  const [removing, setRemoving] = useState(null);

  const { data, loading, reload } = useResource(
    () => api.get(`/api/devices?scope=${tab}${tab === 'all' && status ? `&status=${status}` : ''}`),
    [tab, status]
  );

  const rows = (data?.rows || []).filter((d) => !platform || d.platform === platform);
  const totals = data?.totals || {};
  const platforms = data?.platforms || [];

  const change = async (device, next, reason) => {
    try {
      await api.patch(`/api/devices/${device.id}`, { status: next, revoked_reason: reason });
      toast(`Device ${next === 'trusted' ? 'trusted' : next}`, next === 'trusted' ? 'success' : 'warn');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="device"
        title="Device management"
        subtitle="Trusted mobile clients, biometric enrolment and remote revocation"
        actions={
          <div className="flex gap-2">
            <Button icon="download" onClick={() => csvDownload('devices.csv', rows)}>Export</Button>
            <Button variant="primary" icon="plus" onClick={() => setEnroll(true)}>Enroll device</Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="device" label="Registered" value={totals.all ?? 0} tone="indigo" />
        <Stat icon="checkCircle" label="Trusted" value={totals.trusted ?? 0} tone="emerald" />
        <Stat icon="clock" label="Pending trust" value={totals.pending ?? 0} tone="amber" />
        <Stat icon="lock" label="Blocked / revoked" value={(totals.blocked ?? 0) + (totals.revoked ?? 0)} tone="rose" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_240px]">
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[
                { key: 'mine', label: 'My devices', icon: '📱' },
                ...(manages ? [{ key: 'all', label: 'All devices', icon: '🗂️' }] : [])
              ]}
            />
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Select className="input-sm w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="All platforms" options={platforms.map((p) => ({ value: p.platform, label: `${PLATFORM_ICON[p.platform] || ''} ${p.platform} (${p.count})` }))} />
              {manages && (
                <Select className="input-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Any status" options={['trusted', 'pending', 'blocked', 'revoked'].map((s) => ({ value: s, label: titleCase(s) }))} />
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-4"><SkeletonRows rows={6} /></div>
          ) : rows.length ? (
            <div className="divide-line">
              {rows.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: 'var(--bg-soft)' }}>
                    {PLATFORM_ICON[d.platform] || '📟'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold">{d.label}</span>
                      <StatusBadge status={d.status} />
                      {d.fingerprint_enrolled ? <Badge tone="brand" size="sm">👆 Fingerprint</Badge> : null}
                      {d.face_enrolled ? <Badge tone="violet" size="sm">🙂 Face ID</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-mute">
                      {d.model} · app {d.app_version}
                      {tab === 'all' ? ` · ${d.owner}${d.location ? ` · ${d.location}` : ''}` : ''}
                      {' · '}seen {relative(d.last_seen_at)}
                      {d.revoked_reason ? ` · ${d.revoked_reason}` : ''}
                    </p>
                  </div>
                  {manages && (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {d.status !== 'trusted' && <Button size="sm" variant="primary" icon="check" onClick={() => change(d, 'trusted')}>Trust</Button>}
                      {d.status === 'trusted' && <Button size="sm" variant="outline" icon="alert" onClick={() => change(d, 'blocked')}>Block</Button>}
                      {d.status !== 'revoked' && <Button size="sm" variant="danger" icon="lock" onClick={() => change(d, 'revoked', 'Revoked from device console')}>Revoke</Button>}
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => setRemoving(d)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState icon="device" title="No devices here" message="Enroll a phone or tablet to punch in with biometrics." action={<Button variant="primary" icon="plus" onClick={() => setEnroll(true)}>Enroll device</Button>} />
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-2 font-bold">Biometric coverage</div>
          <Progress value={totals.all ? Math.round(((totals.biometric ?? 0) / totals.all) * 100) : 0} tone="brand" />
          <p className="mt-1 text-[11px] text-mute">
            {totals.biometric ?? 0} of {totals.all ?? 0} devices have a fingerprint or face template enrolled.
          </p>
          <div className="mt-3 space-y-1.5">
            {platforms.map((p) => (
              <div key={p.platform} className="flex items-center justify-between text-xs">
                <span className="font-bold">{PLATFORM_ICON[p.platform]} {p.platform}</span>
                <span className="text-mute">{p.count}</span>
              </div>
            ))}
          </div>
          {totals.stale > 0 && (
            <div className="mt-3 rounded-xl p-2.5 text-[11px] font-bold text-amber-700" style={{ background: 'var(--bg-soft)' }}>
              ⚠️ {totals.stale} devices have not checked in for over a week.
            </div>
          )}
        </Card>
      </div>

      <EnrollModal open={enroll} onClose={() => setEnroll(false)} onDone={() => reload({ silent: true })} />
      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.label}?`}
        message="The device will no longer be able to authenticate."
        confirmLabel="Remove device"
        onConfirm={async () => {
          await api.del(`/api/devices/${removing.id}`, {});
          toast('Device removed', 'warn');
          reload({ silent: true });
        }}
      />
    </div>
  );
}
