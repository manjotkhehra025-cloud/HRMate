import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, EmptyState, Icon, Input, Modal, PageHeader, Progress,
  Ring, SectionTitle, Select, SkeletonRows, Stat, StatusBadge, Tabs, Textarea, Toggle
} from '../ui/index.jsx';
import { currency, fmtDateTime, relative, titleCase } from '../lib/format.js';

const PUNCH_METHODS = [
  { key: 'gps', label: 'GPS geofence', icon: '📍' },
  { key: 'face', label: 'Face ID', icon: '🙂' },
  { key: 'fingerprint', label: 'Fingerprint', icon: '👆' },
  { key: 'pin', label: 'Numeric PIN', icon: '🔢' },
  { key: 'qr', label: 'QR badge', icon: '🔳' },
  { key: 'manual', label: 'Manual entry', icon: '✍️' }
];
const LOCALES = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Español' },
  { key: 'hi', label: 'हिन्दी' },
  { key: 'fr', label: 'Français' },
  { key: 'ar', label: 'العربية' },
  { key: 'de', label: 'Deutsch' },
  { key: 'pt', label: 'Português' }
];
const WEEKDAYS = [
  { key: 1, label: 'Mon' }, { key: 2, label: 'Tue' }, { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' }, { key: 5, label: 'Fri' }, { key: 6, label: 'Sat' }, { key: 0, label: 'Sun' }
];

function CompanyTab({ data, reload }) {
  const { toast } = useStore();
  const [form, setForm] = useState(null);
  const [settings, setSettings] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({ ...data.company });
    setSettings({ ...data.settings });
  }, [data]);

  if (!form) return <SkeletonRows rows={8} />;

  const saveCompany = async () => {
    setBusy(true);
    try {
      await api.patch('/api/admin/company', form);
      toast('Company profile saved', 'success');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    try {
      await api.patch('/api/admin/settings', patch);
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const listValue = (key, fallback = []) => {
    try {
      return JSON.parse(settings[key] || 'null') || fallback;
    } catch {
      return fallback;
    }
  };
  const punchMethods = listValue('punch_methods', []);
  const locales = listValue('locales', ['en']);
  const bioRoles = listValue('biometric_required_roles', []);
  const roles = ['super_admin', 'hr_admin', 'hr_manager', 'dept_manager', 'supervisor', 'team_leader', 'employee'];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <SectionTitle icon="building" title="Company profile" subtitle="Shown on ID cards, reports and emails" />
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Legal name</span><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className="label">Logo emoji</span><Input value={form.logo_emoji} onChange={(e) => setForm({ ...form, logo_emoji: e.target.value })} /></label>
            <label className="block"><span className="label">Industry</span><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></label>
            <label className="block">
              <span className="label">Timezone</span>
              <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} options={['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York'].map((t) => ({ value: t, label: t }))} />
            </label>
            <label className="block">
              <span className="label">Currency</span>
              <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} options={['INR', 'USD', 'EUR', 'AED', 'GBP'].map((c) => ({ value: c, label: c }))} />
            </label>
            <label className="block">
              <span className="label">Plan</span>
              <Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} options={['starter', 'growth', 'enterprise'].map((p) => ({ value: p, label: titleCase(p) }))} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Work hours / day</span><Input type="number" value={form.work_hours_per_day} onChange={(e) => setForm({ ...form, work_hours_per_day: Number(e.target.value) })} /></label>
            <label className="block"><span className="label">Late grace (min)</span><Input type="number" value={form.late_grace_min} onChange={(e) => setForm({ ...form, late_grace_min: Number(e.target.value) })} /></label>
            <label className="block"><span className="label">Geofence radius (m)</span><Input type="number" value={form.punch_radius_m} onChange={(e) => setForm({ ...form, punch_radius_m: Number(e.target.value) })} /></label>
            <label className="block"><span className="label">Week starts on</span>
              <Select value={String(form.week_start)} onChange={(e) => setForm({ ...form, week_start: Number(e.target.value) })} options={WEEKDAYS.map((d) => ({ value: String(d.key), label: d.label }))} />
            </label>
          </div>
          <div>
            <span className="label">Working days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = (form.work_days || []).includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setForm({ ...form, work_days: on ? form.work_days.filter((x) => x !== d.key) : [...form.work_days, d.key] })}
                    className={`chip ${on ? 'chip-active' : ''}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Toggle label="Allow remote punching" description="Employees can clock in outside a geofence with a reason" checked={!!form.allow_remote_punch} onChange={(v) => setForm({ ...form, allow_remote_punch: v ? 1 : 0 })} />
            <Toggle label="Overtime tracking" description="Track and pay hours beyond the shift end" checked={!!form.overtime_enabled} onChange={(v) => setForm({ ...form, overtime_enabled: v ? 1 : 0 })} />
          </div>
          <Button variant="primary" icon="check" loading={busy} onClick={saveCompany}>Save company profile</Button>
        </div>
      </Card>

      <div className="space-y-5">
        <Card>
          <SectionTitle icon="fingerprint" title="Punch & biometrics" subtitle="Which clock-in methods the mobile app offers" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PUNCH_METHODS.map((m) => {
              const on = punchMethods.includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => saveSettings({ punch_methods: on ? punchMethods.filter((x) => x !== m.key) : [...punchMethods, m.key] })}
                  className={`chip ${on ? 'chip-active' : ''}`}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <span className="label">Biometric required for</span>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => {
                const on = bioRoles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => saveSettings({ biometric_required_roles: on ? bioRoles.filter((x) => x !== r) : [...bioRoles, r] })}
                    className={`chip ${on ? 'chip-active' : ''}`}
                  >
                    {titleCase(r)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Toggle label="Selfie punch" description="Attach a photo when punching in" checked={settings.allow_selfie_punch === '1'} onChange={(v) => saveSettings({ allow_selfie_punch: v ? '1' : '0' })} />
            <Toggle label="Two-factor for admins" description="Require a PIN in addition to the password" checked={settings.two_factor_required === '1'} onChange={(v) => saveSettings({ two_factor_required: v ? '1' : '0' })} />
          </div>
        </Card>

        <Card>
          <SectionTitle icon="globe" title="Languages & policy" subtitle="Multilingual UI and HR policy defaults" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LOCALES.map((l) => {
              const on = locales.includes(l.key);
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => saveSettings({ locales: on ? locales.filter((x) => x !== l.key) : [...locales, l.key] })}
                  className={`chip ${on ? 'chip-active' : ''}`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Default language</span>
              <Select value={settings.default_locale || 'en'} onChange={(e) => saveSettings({ default_locale: e.target.value })} options={LOCALES.map((l) => ({ value: l.key, label: l.label }))} />
            </label>
            <label className="block">
              <span className="label">Geofence strictness</span>
              <Select value={settings.geofence_strictness || 'moderate'} onChange={(e) => saveSettings({ geofence_strictness: e.target.value })} options={['lenient', 'moderate', 'strict'].map((s) => ({ value: s, label: titleCase(s) }))} />
            </label>
            <label className="block"><span className="label">Overtime multiplier</span><Input type="number" step="0.25" value={settings.overtime_multiplier || 2} onChange={(e) => saveSettings({ overtime_multiplier: e.target.value })} /></label>
            <label className="block"><span className="label">Helpdesk SLA (hours)</span><Input type="number" value={settings.helpdesk_sla_hours || 18} onChange={(e) => saveSettings({ helpdesk_sla_hours: e.target.value })} /></label>
            <label className="block"><span className="label">Probation (months)</span><Input type="number" value={settings.probation_months || 6} onChange={(e) => saveSettings({ probation_months: e.target.value })} /></label>
            <label className="block"><span className="label">Notice period (days)</span><Input type="number" value={settings.notice_period_days || 60} onChange={(e) => saveSettings({ notice_period_days: e.target.value })} /></label>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RolesTab({ data, reload }) {
  const { toast } = useStore();
  const [selected, setSelected] = useState('hr_admin');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  const roles = data?.roles || [];
  const groups = data?.groups || [];
  const role = roles.find((r) => r.key === selected) || roles[0];

  useEffect(() => {
    if (role) setDraft(new Set(role.permissions));
  }, [selected, data]);

  if (!role) return <SkeletonRows rows={8} />;

  const toggle = (perm) => {
    const next = new Set(draft);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    setDraft(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/roles/${role.key}`, { permissions: [...draft] });
      toast(`${role.label} permissions updated`, 'success');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const dirty = role.permissions.length !== draft.size || role.permissions.some((p) => !draft.has(p));

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <Card padded={false}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold">Roles</div>
          <p className="text-[11px] text-mute">{roles.length} roles · {roles.reduce((a, r) => a + r.headcount, 0)} people</p>
        </div>
        <div className="divide-line">
          {roles.map((r) => (
            <button key={r.key} type="button" onClick={() => setSelected(r.key)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-[var(--bg-soft)]" style={selected === r.key ? { background: 'var(--brand-soft)' } : undefined}>
              <span className="text-base">{r.icon?.startsWith?.('id-') ? '🪪' : '🛡️'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">{r.label}</span>
                <span className="block truncate text-[10px] text-mute">{r.scope} scope · {r.permissions.length} perms</span>
              </span>
              <Badge tone="slate" size="sm">{r.headcount}</Badge>
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{role.label}</span>
                <Badge tone="brand" size="sm">level {role.level}</Badge>
                <Badge tone="slate" size="sm">{role.scope}</Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-mute">{draft.size} of {groups.reduce((a, g) => a + g.perms.length, 0)} permissions enabled</p>
            </div>
            <Button variant="outline" icon="refresh" onClick={() => setDraft(new Set(role.permissions))}>Reset</Button>
            <Button variant="primary" icon="check" disabled={!dirty} loading={busy} onClick={save}>Save changes</Button>
          </div>
          <div className="mt-3 rounded-xl p-3 text-[11px] text-amber-700" style={{ background: 'var(--bg-soft)' }}>
            ⚠️ Role edits apply to the running server only. They are not persisted to the database, so a restart restores the
            shipped matrix.
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const enabled = g.perms.filter((p) => draft.has(p)).length;
            return (
              <Card key={g.key} padded={false}>
                <div className="flex items-center justify-between border-b p-3" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs font-bold">{g.label}</span>
                  <span className="text-[10px] font-bold text-mute">{enabled}/{g.perms.length}</span>
                </div>
                <div className="max-h-56 overflow-y-auto p-2">
                  {g.perms.map((p) => (
                    <label key={p} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[11px] transition hover:bg-[var(--bg-soft)]">
                      <input type="checkbox" className="checkbox" checked={draft.has(p)} onChange={() => toggle(p)} />
                      <span className="truncate font-mono">{p}</span>
                    </label>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StructureTab() {
  const { data: depts, loading: dLoading } = useResource(() => api.get('/api/departments'), []);
  const { data: locs, loading: lLoading } = useResource(() => api.get('/api/locations'), []);
  const departments = depts?.rows || [];
  const locations = locs?.rows || locs || [];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card padded={false}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold">Departments</div>
          <p className="text-[11px] text-mute">{departments.length} departments in the org tree</p>
        </div>
        {dLoading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : (
          <div className="divide-line">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm" style={{ background: `${d.color}22`, color: d.color }}>{d.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{d.name}</div>
                  <div className="truncate text-[10px] text-mute">{d.code}{d.parent_name ? ` · part of ${d.parent_name}` : ''}{d.head_name ? ` · head ${d.head_name}` : ''}</div>
                </div>
                <Badge tone="slate" size="sm">{d.headcount} people</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padded={false}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold">Locations & geofences</div>
          <p className="text-[11px] text-mute">Punch-ins are validated against these coordinates</p>
        </div>
        {lLoading ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : (
          <div className="divide-line">
            {locations.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl soft"><Icon name="mapPin" size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{l.name}</div>
                  <div className="truncate text-[10px] text-mute">{l.address || l.city}{l.country ? `, ${l.country}` : ''} · {l.type}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-mono text-mute">{Number(l.latitude).toFixed(3)}, {Number(l.longitude).toFixed(3)}</div>
                  <Badge tone="brand" size="sm">{l.radius_m} m</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SystemTab() {
  const { data, loading, reload } = useResource(() => api.get('/api/admin/system'), []);
  const { toast } = useStore();
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState(null);

  if (loading || !data) return <SkeletonRows rows={8} />;

  const tables = Object.entries(data.database.tables || {}).sort((a, b) => b[1] - a[1]);
  const maxRows = tables[0]?.[1] || 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="layers" label="Database rows" value={data.database.totalRows} tone="indigo" hint={data.database.engine} />
        <Stat icon="device" label="Active sessions" value={data.sessions} tone="brand" />
        <Stat icon="clock" label="Pending approvals" value={data.pendingApprovals} tone="amber" />
        <Stat icon="alert" label="Docs expiring <60d" value={data.expiringDocs} tone="rose" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <Card padded={false}>
          <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div className="font-bold">Storage breakdown</div>
            <p className="text-[11px] text-mute">{data.database.file}</p>
          </div>
          <div className="space-y-2 p-4">
            {tables.map(([name, count]) => (
              <div key={name}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className="font-mono font-bold">{name}</span>
                  <span className="text-mute">{count.toLocaleString()}</span>
                </div>
                <Progress height={6} value={Math.max(2, Math.round((count / maxRows) * 100))} tone="brand" />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionTitle icon="settings" title="Runtime" subtitle="Server process health" />
            <div className="mt-3 space-y-2 text-sm">
              {[
                ['Node', data.node],
                ['Uptime', `${Math.floor(data.uptimeSeconds / 60)} min`],
                ['Memory', `${data.memoryMb} MB`],
                ['Tables', Object.keys(data.database.tables || {}).length],
                ['Last audit entry', data.lastAudit?.created_at ? fmtDateTime(data.lastAudit.created_at) : '—']
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b pb-2 last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-mute">{k}</span>
                  <span className="truncate font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="refresh" title="Demo data" subtitle="Rebuild the seeded dataset" />
            <p className="mt-2 text-[11px] text-mute">
              Resetting regenerates every table from the deterministic seed. This must be run on the server.
            </p>
            <Button
              className="mt-3"
              variant="danger"
              icon="refresh"
              loading={resetting}
              onClick={async () => {
                setResetting(true);
                try {
                  const res = await api.post('/api/admin/reset-demo-data', {});
                  setResult(res.message || 'Requested');
                  toast(res.message || 'Requested', 'warn');
                } catch (err) {
                  toast(err.message, 'error');
                } finally {
                  setResetting(false);
                }
              }}
            >
              Request reset
            </Button>
            {result && <p className="mt-2 rounded-xl p-2 text-[11px] font-bold" style={{ background: 'var(--bg-soft)' }}>{result}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { can } = useStore();
  const [tab, setTab] = useState('company');
  const { data, loading, reload } = useResource(() => api.get('/api/admin/company'), []);
  const { data: roles, loading: rLoading, reload: reloadRoles } = useResource(
    () => (can('admin.roles') || can('admin.settings') ? api.get('/api/admin/roles') : Promise.resolve(null)),
    []
  );

  const tabs = [
    { key: 'company', label: 'Company', icon: '🏢' },
    ...(can('admin.roles') || can('admin.settings') ? [{ key: 'roles', label: 'Roles & access', icon: '🛡️' }] : []),
    { key: 'structure', label: 'Departments & sites', icon: '🗺️' },
    { key: 'system', label: 'System', icon: '⚙️' }
  ];

  return (
    <div className="page">
      <PageHeader icon="settings" title="Admin panel" subtitle="Company configuration, access control and platform health" />

      <Tabs className="mb-4" active={tab} onChange={setTab} tabs={tabs} />

      {tab === 'company' && <CompanyTab data={data} reload={reload} />}
      {tab === 'roles' && (rLoading ? <Card><SkeletonRows rows={8} /></Card> : <RolesTab data={roles} reload={reloadRoles} />)}
      {tab === 'structure' && <StructureTab />}
      {tab === 'system' && <SystemTab />}
    </div>
  );
}
