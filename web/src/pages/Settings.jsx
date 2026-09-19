import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import { LOCALES, coverageOf } from '../lib/i18n.js';
import {
  Badge, Button, Card, Icon, Input, PageHeader, Progress, SectionTitle, Segmented, Select,
  SkeletonRows, Toggle
} from '../ui/index.jsx';
import { titleCase } from '../lib/format.js';

const THEMES = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' }
];

function PasswordCard() {
  const { toast } = useStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 8) return toast('Password must be at least 8 characters', 'warn');
    if (next !== confirm) return toast('The two new passwords do not match', 'warn');
    setBusy(true);
    try {
      await api.patch('/api/auth/password', { current, next });
      toast('Password updated', 'success');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle icon="lock" title="Password" subtitle="Used for web and email sign-in" />
      <div className="mt-3 space-y-3">
        <label className="block"><span className="label">Current password</span><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">New password</span><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" /></label>
          <label className="block"><span className="label">Confirm new</span><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" icon="check" loading={busy} onClick={submit}>Update password</Button>
          <span className="text-[11px] text-mute">You will stay signed in on this device.</span>
        </div>
      </div>
    </Card>
  );
}

function PinCard({ hasPin, onChanged }) {
  const { toast } = useStore();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <SectionTitle
        icon="pin"
        title="App PIN"
        subtitle={hasPin ? 'A PIN is set — update it any time' : 'Set a 4–8 digit PIN for fast mobile sign-in'}
        action={hasPin ? <Badge tone="emerald" size="sm">Enabled</Badge> : <Badge tone="amber" size="sm">Not set</Badge>}
      />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block min-w-[180px] flex-1">
          <span className="label">{hasPin ? 'New PIN' : 'Choose a PIN'}</span>
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="4–8 digits" />
        </label>
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.patch('/api/auth/pin', { pin });
              toast('PIN saved', 'success');
              setPin('');
              onChanged?.();
            } catch (err) {
              toast(err.message, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {hasPin ? 'Update PIN' : 'Set PIN'}
        </Button>
      </div>
    </Card>
  );
}

function BiometricCard({ employee, onChanged }) {
  const { toast } = useStore();
  const [busy, setBusy] = useState('');

  const enroll = async (method) => {
    setBusy(method);
    try {
      await api.post('/api/auth/biometric/enroll', { method });
      toast(`${method === 'face' ? 'Face' : 'Fingerprint'} template enrolled`, 'success');
      onChanged?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const revoke = async (method) => {
    setBusy(method);
    try {
      await api.del(`/api/auth/biometric/${method}`, {});
      toast(`${method === 'face' ? 'Face' : 'Fingerprint'} template removed`, 'warn');
      onChanged?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const rows = [
    { method: 'face', label: 'Face unlock', icon: '🙂', on: employee?.face_enrolled, hint: 'Uses the front camera and a liveness check' },
    { method: 'fingerprint', label: 'Fingerprint', icon: '👆', on: employee?.fingerprint_enrolled, hint: 'Uses the device secure enclave' }
  ];

  return (
    <Card>
      <SectionTitle icon="fingerprint" title="Biometrics" subtitle="Simulated templates stored server-side for the demo" />
      <div className="mt-3 space-y-3">
        {rows.map((r) => (
          <div key={r.method} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
            <span className="text-xl">{r.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{r.label}</div>
              <div className="text-[11px] text-mute">{r.hint}</div>
            </div>
            {r.on ? (
              <Button size="sm" variant="outline" icon="trash" loading={busy === r.method} onClick={() => revoke(r.method)}>Remove</Button>
            ) : (
              <Button size="sm" variant="primary" icon="plus" loading={busy === r.method} onClick={() => enroll(r.method)}>Enroll</Button>
            )}
          </div>
        ))}
        <p className="rounded-xl p-3 text-[11px] text-mute" style={{ background: 'var(--bg-soft)' }}>
          Templates are deterministic hashes derived from your account in this build — no camera or sensor data leaves the device.
        </p>
      </div>
    </Card>
  );
}

export default function Settings() {
  const { theme, setTheme, locale, setLocale, t, employee, refreshSession, toast } = useStore();
  const [pushEnabled, setPushEnabled] = useState(false);
  const { data: notifSettings } = useResource(() => api.get('/api/notifications/settings'), []);
  const [busyPush, setBusyPush] = useState(false);

  useEffect(() => {
    setPushEnabled(!!notifSettings?.pushEnabled);
  }, [notifSettings]);

  const togglePush = async (want) => {
    if (want && 'Notification' in window && Notification.permission !== 'granted') {
      const res = await Notification.requestPermission();
      if (res !== 'granted') return toast('Browser blocked notifications', 'warn');
    }
    setBusyPush(true);
    try {
      await api.patch('/api/auth/preferences', { push_enabled: want });
      setPushEnabled(want);
      toast(want ? 'Push notifications on' : 'Push notifications off', want ? 'success' : 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyPush(false);
    }
  };

  return (
    <div className="page">
      <PageHeader icon="settings" title="Settings" subtitle="Appearance, language, security and notification preferences" />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <SectionTitle icon="moon" title="Appearance" subtitle="Theme follows your device by default" />
            <div className="mt-3">
              <Segmented options={THEMES} value={theme} onChange={setTheme} />
            </div>
            <p className="mt-2 text-[11px] text-mute">Currently showing the {theme === 'system' ? 'system' : theme} theme.</p>
          </Card>

          <Card>
            <SectionTitle icon="globe" title="Language" subtitle="Interface language and text direction" action={<Badge tone="brand" size="sm">{locale.toUpperCase()}</Badge>} />
            <div className="mt-3 space-y-2">
              {LOCALES.map((l) => {
                const cov = coverageOf(l.code);
                const active = locale === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLocale(l.code)}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition"
                    style={{ borderColor: active ? 'var(--brand)' : 'var(--border)', background: active ? 'var(--brand-soft)' : undefined }}
                  >
                    <span className="text-lg">{l.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{l.label}</span>
                      <span className="block text-[10px] text-mute">{l.code.toUpperCase()}{l.dir === 'rtl' ? ' · right-to-left' : ''}</span>
                    </span>
                    <span className="w-24 shrink-0">
                      <Progress height={5} value={cov} tone={cov > 90 ? 'emerald' : cov > 50 ? 'amber' : 'slate'} />
                    </span>
                    <span className="w-8 shrink-0 text-right text-[10px] font-bold text-mute">{cov}%</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="bell" title="Notifications" subtitle="How alerts reach you" />
            <div className="mt-3 space-y-3">
              <Toggle label="Push notifications" description="Live event stream plus native browser alerts" checked={pushEnabled} disabled={busyPush} onChange={togglePush} />
              {notifSettings?.channels && (
                <div className="divide-line rounded-xl" style={{ background: 'var(--bg-soft)' }}>
                  {notifSettings.channels.map((c) => (
                    <div key={c.key} className="flex items-center gap-2.5 px-3 py-2">
                      <span className="text-base">{c.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">{c.label}</span>
                      <Badge tone={c.enabled ? 'emerald' : 'slate'} size="sm">{c.enabled ? 'On' : 'Off'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <PasswordCard />
          <PinCard hasPin={!!employee?.has_pin} onChanged={refreshSession} />
          <BiometricCard employee={employee} onChanged={refreshSession} />

          <Card>
            <SectionTitle icon="shield" title="Session & security" subtitle="Where you are signed in" />
            <div className="mt-3 space-y-2 text-sm">
              {[
                ['Role', employee ? titleCase(employee.role) : '—'],
                ['Permissions', `${employee?.permissions?.length ?? 0} keys`],
                ['Two-factor (PIN)', employee?.has_pin ? 'Enabled' : 'Not set'],
                ['Biometric unlock', employee?.biometric_enabled ? 'Enabled' : 'Off'],
                ['Last seen', employee?.last_seen_at ? new Date(employee.last_seen_at).toLocaleString() : '—']
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b pb-2 last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-mute">{k}</span>
                  <span className="truncate font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <a href="#/devices" className="btn-soft mt-3 inline-flex">
              <Icon name="device" size={15} /> Manage devices
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}
