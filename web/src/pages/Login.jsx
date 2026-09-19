import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { Avatar, Badge, Button, Icon, Input, Segmented, Spinner } from '../ui/index.jsx';
import { LOCALES } from '../lib/i18n.js';

const ROLE_META = {
  super_admin: { tone: 'violet', label: 'Super Admin' },
  hr_admin: { tone: 'indigo', label: 'HR Admin' },
  hr_manager: { tone: 'sky', label: 'HR Manager' },
  dept_manager: { tone: 'teal', label: 'Department Manager' },
  supervisor: { tone: 'amber', label: 'Supervisor' },
  team_leader: { tone: 'orange', label: 'Team Leader' },
  employee: { tone: 'slate', label: 'Employee' }
};

export default function Login() {
  const { login, loginWithPin, loginWithBiometric, t, locale, setLocale, theme, setTheme, resolvedTheme, toast } = useStore();
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [boot, setBoot] = useState(null);
  const [scan, setScan] = useState({ active: false, stage: 0, method: 'face' });

  useEffect(() => {
    api.get('/api/auth/bootstrap').then(setBoot).catch(() => setBoot({ demoAccounts: [] }));
  }, []);

  const accounts = boot?.demoAccounts || [];

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'password') {
        await login({ email, password, device: { label: 'Web / Mobile browser', platform: 'Web' } });
      } else if (mode === 'pin') {
        await loginWithPin({ identifier: email, pin, device: { label: 'Mobile PIN unlock', platform: 'Mobile' } });
      }
      toast('Welcome back 👋', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runBiometric = async (method) => {
    setScan({ active: true, stage: 0, method });
    setError(null);
    // simulated capture: advance through liveness stages, then verify server-side
    for (let i = 1; i <= 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 420));
      setScan((s) => ({ ...s, stage: i }));
    }
    setBusy(true);
    try {
      await loginWithBiometric({ identifier: email || accounts[0]?.email, method, score: 0.97, device: { label: `${method === 'face' ? 'Face' : 'Fingerprint'} unlock`, platform: 'Mobile' } });
      toast(method === 'face' ? t('attendance.faceVerified') : t('attendance.fingerVerified'), 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setScan({ active: false, stage: 0, method });
    }
  };

  const useDemo = (acc) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setPin(acc.pin);
    setMode('password');
    setError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex" style={{ background: 'linear-gradient(150deg,#1d30a8 0%,#3563f6 45%,#8b5cf6 100%)' }}>
        <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-2xl backdrop-blur">{boot?.company?.logo_emoji || '⛰️'}</span>
            <div>
              <p className="text-lg font-black tracking-tight">{boot?.company?.name || 'HRMate'}</p>
              <p className="text-xs text-white/70">{t('app.tagline')}</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-black leading-tight tracking-tight">
            Attendance, workforce & people —<br /> in one mobile-first app.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Punch in with face, fingerprint or GPS geofencing. Manage rosters, leaves, approvals, KRA goals, performance,
            documents and helpdesk from any device — with role-based access and a full audit trail.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ['📍', 'GPS geofencing'],
              ['🧬', 'Face & fingerprint'],
              ['🗓️', 'Shift rosters'],
              ['🧾', 'Approvals'],
              ['🎯', 'KRA & goals'],
              ['🛡️', 'Audit logs']
            ].map(([icon, label]) => (
              <div key={label} className="rounded-2xl bg-white/10 px-3 py-2.5 text-xs font-semibold backdrop-blur">
                <span className="mr-1.5">{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-4 text-xs text-white/70">
          <span>{boot?.stats?.employees || 0} employees</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>{boot?.stats?.attendanceToday || 0} punched today</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>server {new Date(boot?.serverTime || Date.now()).toUTCString().slice(17, 22)} UTC</span>
        </div>
      </div>

      {/* form panel */}
      <div className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl text-xl text-white" style={{ background: 'linear-gradient(140deg,#3563f6,#8b5cf6)' }}>
                {boot?.company?.logo_emoji || '⛰️'}
              </span>
              <div>
                <p className="text-sm font-black">{boot?.company?.name || 'HRMate'}</p>
                <p className="text-[11px] text-mute">{t('app.tagline')}</p>
              </div>
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">{t('login.title')}</h2>
              <p className="mt-1 text-sm text-mute">{t('login.subtitle')}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLocale(LOCALES[(LOCALES.findIndex((l) => l.code === locale) + 1) % LOCALES.length].code)}
                className="icon-btn"
                title={t('settings.language')}
              >
                <Icon name="globe" size={18} />
              </button>
              <button type="button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="icon-btn" title={t('settings.theme')}>
                <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} size={18} />
              </button>
            </div>
          </div>

          <div className="card p-5">
            <Segmented
              className="mb-4 w-full [&>button]:flex-1"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'password', label: 'Password' },
                { value: 'pin', label: 'PIN' },
                { value: 'bio', label: 'Biometric' }
              ]}
            />

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold" style={{ borderColor: 'rgba(225,29,72,.35)', background: 'rgba(225,29,72,.08)', color: 'var(--danger)' }}>
                <Icon name="alert" size={15} />
                <span>{error}</span>
              </div>
            )}

            {mode === 'bio' ? (
              <div className="py-2 text-center">
                <div className="relative mx-auto mb-4 grid h-40 w-40 place-items-center overflow-hidden rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--border-strong)' }}>
                  <div className="punch-ring absolute inset-0" />
                  {scan.active ? (
                    <>
                      <Icon name={scan.method === 'face' ? 'face' : 'fingerprint'} size={72} className="relative" />
                      <span className="scan-line absolute inset-x-0 h-0.5 animate-scan" />
                    </>
                  ) : (
                    <Icon name={scan.method === 'face' ? 'face' : 'fingerprint'} size={64} className="text-mute" />
                  )}
                </div>
                <p className="text-sm font-bold">{scan.active ? (scan.method === 'face' ? t('attendance.scanFace') : t('attendance.scanFinger')) : 'Choose a biometric method'}</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-mute">
                  {scan.active
                    ? ['Align your face in the frame', 'Hold still — checking liveness', 'Matching template on file'][Math.min(2, scan.stage)]
                    : 'Templates are matched on the server against the biometric you enrolled in Settings.'}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button variant="primary" icon="face" loading={busy && scan.method === 'face'} onClick={() => runBiometric('face')}>
                    Face ID
                  </Button>
                  <Button variant="outline" icon="fingerprint" loading={busy && scan.method === 'fingerprint'} onClick={() => runBiometric('fingerprint')}>
                    Fingerprint
                  </Button>
                </div>
                {accounts[0] && !email && (
                  <p className="mt-3 text-[11px] text-mute">
                    Using <button type="button" className="link" onClick={() => setEmail(accounts[0].email)}>{accounts[0].email}</button> — or pick a demo account below first.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3.5">
                <div>
                  <span className="label">{t('login.email')}</span>
                  <Input
                    icon="mail"
                    type="text"
                    autoComplete="username"
                    placeholder="kabir.malhotra@northpeak.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {mode === 'password' ? (
                  <div>
                    <span className="label">{t('login.password')}</span>
                    <span className="relative block">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">
                        <Icon name="lock" size={16} />
                      </span>
                      <input
                        className="input pl-9 pr-10"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Demo@1234"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-mute hover:bg-black/5">
                        <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} />
                      </button>
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="label">{t('login.pin')}</span>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3].map((i) => (
                        <input
                          key={i}
                          inputMode="numeric"
                          maxLength={1}
                          value={pin[i] || ''}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '');
                            const next = (pin.slice(0, i) + v + pin.slice(i + 1)).slice(0, 4);
                            setPin(next);
                            const el = e.target.parentElement?.children[i + 1];
                            if (v && el) el.focus();
                          }}
                          className="input h-14 text-center text-xl font-black tracking-widest"
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-mute">Demo PIN: 123456 (first four digits work)</p>
                  </div>
                )}
                <Button variant="primary" className="w-full" loading={busy} onClick={submit}>
                  {t('login.signIn')}
                </Button>
              </form>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-mute">{t('login.demoAccounts')}</span>
              <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
            </div>
            <div className="grid gap-2">
              {accounts.map((acc) => {
                const meta = ROLE_META[acc.role] || ROLE_META.employee;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => useDemo(acc)}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition hover:bg-[var(--surface-2)] active:scale-[.99] ${
                      email === acc.email ? '' : ''
                    }`}
                    style={{ borderColor: email === acc.email ? 'var(--brand)' : 'var(--border)', background: email === acc.email ? 'var(--brand-soft)' : 'var(--surface)' }}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl soft text-sm font-black">
                      {acc.email.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{acc.designation}</span>
                      <span className="block truncate text-[11px] text-mute">{acc.email}</span>
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[11px] text-mute">
              Password <code className="font-bold">Demo@1234</code> · PIN <code className="font-bold">123456</code> · biometrics enrolled for every demo user
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
