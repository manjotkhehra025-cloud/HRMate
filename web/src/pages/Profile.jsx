import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, Input, KeyValue, Modal, PageHeader, Progress,
  Ring, SectionTitle, Select, SkeletonRows, Stat, StatusBadge, Tabs, Textarea
} from '../ui/index.jsx';
import { fmtDate, relative, titleCase } from '../lib/format.js';

const EMOJIS = ['😀', '😎', '🧑‍💻', '👩‍💼', '🧑‍🔬', '👨‍🎨', '🦸', '🧙', '🐯', '🦊', '🐼', '🚀', '⚡', '🌟', '🎯', '🧭'];
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e', '#14b8a6', '#64748b', '#ef4444'];

function EditProfileModal({ open, onClose, employee, onSaved }) {
  const { toast, refreshSession } = useStore();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && employee) {
      setForm({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        phone: employee.phone || '',
        date_of_birth: employee.date_of_birth || '',
        gender: employee.gender || '',
        address: employee.address || '',
        city: employee.city || '',
        emergency_contact: employee.emergency_contact || '',
        emergency_phone: employee.emergency_phone || '',
        bio: employee.bio || '',
        avatar_color: employee.avatar_color || '#6366f1',
        avatar_emoji: employee.avatar_emoji || '😀',
        skills: (employee.skills || []).join(', ')
      });
    }
  }, [open, employee]);

  if (!form) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/employees/${employee.id}`, {
        ...form,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean)
      });
      toast('Profile updated', 'success');
      onSaved?.();
      refreshSession?.();
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
      title="Edit profile"
      subtitle="These details are visible to your team and HR"
      icon="edit"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" loading={busy} onClick={submit}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="label">Avatar</span>
          <div className="flex items-center gap-3">
            <Avatar person={{ ...form, full_name: `${form.first_name} ${form.last_name}` }} size={56} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => setForm({ ...form, avatar_emoji: e })} className="grid h-7 w-7 place-items-center rounded-lg text-sm transition" style={{ background: form.avatar_emoji === e ? 'var(--brand-soft)' : 'var(--bg-soft)' }}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, avatar_color: c })} className="h-6 w-6 rounded-full transition" style={{ background: c, outline: form.avatar_color === c ? '2px solid var(--brand)' : 'none', outlineOffset: 2 }} aria-label={c} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">First name</span><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
          <label className="block"><span className="label">Last name</span><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
          <label className="block"><span className="label">Phone</span><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="block"><span className="label">Date of birth</span><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></label>
          <label className="block">
            <span className="label">Gender</span>
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} placeholder="Prefer not to say" options={['female', 'male', 'non_binary', 'other'].map((g) => ({ value: g, label: titleCase(g) }))} />
          </label>
          <label className="block"><span className="label">City</span><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
        </div>

        <label className="block"><span className="label">Address</span><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Emergency contact</span><Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></label>
          <label className="block"><span className="label">Emergency phone</span><Input value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} /></label>
        </div>

        <label className="block"><span className="label">Skills (comma separated)</span><Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, SQLite, Coaching" /></label>
        <label className="block"><span className="label">About you</span><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

export default function Profile() {
  const { employee: me, can } = useStore();
  const [tab, setTab] = useState('about');
  const [edit, setEdit] = useState(false);
  const { data, loading, reload } = useResource(() => (me ? api.get(`/api/employees/${me.id}`) : Promise.resolve(null)), [me?.id]);

  if (loading || !data) {
    return (
      <div className="page">
        <PageHeader icon="user" title="My profile" />
        <Card><SkeletonRows rows={8} /></Card>
      </div>
    );
  }

  const e = data.employee;
  const m = data.metrics || {};
  const sensitive = can('employee.view_sensitive');

  return (
    <div className="page">
      <PageHeader icon="user" title="My profile" subtitle="Your employee record as HR and your team see it" />

      <Card className="mb-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar person={e} size={84} ring />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black">{e.full_name}</h2>
              <StatusBadge status={e.status} />
              <Badge tone="brand" size="sm">{e.role_label}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-soft">{e.designation}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-mute">
              <span className="font-mono font-bold">{e.emp_code}</span>
              <span>·</span>
              <span>{e.department}</span>
              {e.location && <><span>·</span><span>{e.location}{e.city ? `, ${e.city}` : ''}</span></>}
              <span>·</span>
              <span>joined {fmtDate(e.join_date)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(e.skills || []).slice(0, 8).map((s) => (
                <Badge key={s} tone="slate" size="sm">{s}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="primary" icon="edit" onClick={() => setEdit(true)}>Edit profile</Button>
            <a href={`#/id-card/${e.id}`} className="btn-soft"><Icon name="idCard" size={15} /> My ID card</a>
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="checkCircle" label="Attendance (30d)" value={`${m.attendanceRate ?? 0}%`} tone="emerald" />
        <Stat icon="sparkles" label="Kudos received" value={m.kudosReceived ?? 0} tone="amber" />
        <Stat icon="history" label="Tenure" value={`${Math.floor((m.tenureDays ?? 0) / 365)}y ${Math.round(((m.tenureDays ?? 0) % 365) / 30)}m`} tone="brand" />
        <Stat icon="alert" label="Docs expiring" value={m.docsExpiring ?? 0} tone={m.docsExpiring ? 'rose' : 'slate'} />
      </div>

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'about', label: 'About', icon: '🙋' },
          { key: 'employment', label: 'Employment', icon: '💼' },
          { key: 'records', label: 'Documents & KYC', icon: '📄' },
          { key: 'security', label: 'Security', icon: '🔐' }
        ]}
      />

      {tab === 'about' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle icon="user" title="About you" subtitle="Shown on your profile and directory card" />
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-soft">{e.bio || 'No bio yet — add a few lines about what you do.'}</p>
            <div className="mt-3">
              <span className="label">Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {(e.skills || []).map((s) => <Badge key={s} tone="brand" size="sm">{s}</Badge>)}
                {!(e.skills || []).length && <span className="text-xs text-mute">None listed.</span>}
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle icon="phone" title="Contact & personal" subtitle="Only you and HR can edit these" />
            <div className="mt-3">
              <KeyValue
                items={[
                  ['Email', e.email],
                  ['Phone', e.phone],
                  ['Date of birth', e.date_of_birth ? fmtDate(e.date_of_birth) : '—'],
                  ['Gender', e.gender ? titleCase(e.gender) : '—'],
                  ['Address', e.address],
                  ['City', e.city],
                  ['Emergency contact', e.emergency_contact],
                  ['Emergency phone', e.emergency_phone]
                ]}
              />
            </div>
          </Card>

          <Card padded={false}>
            <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-bold">Reporting line</div>
              <p className="text-[11px] text-mute">Who you report to and who reports to you</p>
            </div>
            <div className="p-4">
              {data.manager ? (
                <a href={`#/employees/${data.manager.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[var(--bg-soft)]">
                  <Avatar person={data.manager} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{data.manager.name}</div>
                    <div className="truncate text-[11px] text-mute">{data.manager.designation} · reports to</div>
                  </div>
                  <Icon name="chevronRight" size={16} className="text-mute" />
                </a>
              ) : (
                <p className="text-xs text-mute">No manager on record.</p>
              )}
            </div>
            {data.reports?.length > 0 && (
              <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-2 text-xs font-bold text-mute">{data.reports.length} direct reports</div>
                <div className="flex flex-wrap gap-2">
                  {data.reports.slice(0, 12).map((r) => (
                    <a key={r.id} href={`#/employees/${r.id}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[var(--bg-soft)]">
                      <Avatar person={r} size={26} />
                      <span className="text-xs font-bold">{r.first_name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle icon="clock" title="Last 30 days" subtitle="Attendance at a glance" />
            <div className="mt-3 flex flex-wrap gap-1">
              {(data.last30 || []).map((d) => (
                <span
                  key={d.date}
                  title={`${d.date}: ${d.status}`}
                  className="h-4 w-4 rounded"
                  style={{
                    background:
                      d.status === 'present' ? '#10b981'
                        : d.status === 'late' ? '#f59e0b'
                        : d.status === 'wfh' ? '#0ea5e9'
                        : d.status === 'on_leave' ? '#8b5cf6'
                        : d.status === 'half_day' ? '#fbbf24'
                        : d.status === 'absent' ? '#f43f5e'
                        : '#e2e8f0'
                  }}
                />
              ))}
              {!(data.last30 || []).length && <span className="text-xs text-mute">No attendance recorded.</span>}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Ring value={m.attendanceRate ?? 0} size={80} tone="emerald">
                <span className="text-sm font-black">{m.attendanceRate ?? 0}%</span>
              </Ring>
              <p className="text-[11px] text-mute">
                {m.attendanceRate >= 95 ? 'Excellent consistency.' : m.attendanceRate >= 85 ? 'Solid — a few missed days.' : 'Attendance needs attention.'}
              </p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'employment' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle icon="briefcase" title="Employment" subtitle="Maintained by HR" />
            <div className="mt-3">
              <KeyValue
                items={[
                  ['Employment type', e.employment_type ? titleCase(e.employment_type) : '—'],
                  ['Work mode', e.work_mode ? titleCase(e.work_mode) : '—'],
                  ['Join date', e.join_date ? fmtDate(e.join_date) : '—'],
                  ['Probation ends', e.probation_end ? fmtDate(e.probation_end) : '—'],
                  ['Notice period', e.notice_period_days ? `${e.notice_period_days} days` : '—'],
                  ['Department code', e.department_code || '—'],
                  ['Default shift', e.shift?.name ? `${e.shift.name} (${e.shift.start}–${e.shift.end})` : '—'],
                  ['Status', e.status ? titleCase(e.status) : '—']
                ]}
              />
            </div>
          </Card>

          <Card>
            <SectionTitle icon="cash" title="Compensation" subtitle={sensitive ? 'Full detail visible to your role' : 'Masked — ask HR for full detail'} />
            <div className="mt-3">
              <KeyValue
                items={[
                  ['Currency', e.currency || 'INR'],
                  ['Annual CTC', sensitive && e.salary ? e.salary.toLocaleString('en-IN') : '••••••'],
                  ['Bank account', sensitive && e.bank_account ? e.bank_account : '••••••'],
                  ['Tax ID', sensitive && e.tax_id ? e.tax_id : '••••••']
                ]}
              />
            </div>
            {!sensitive && (
              <p className="mt-3 rounded-xl p-3 text-[11px] text-mute" style={{ background: 'var(--bg-soft)' }}>
                Compensation fields are hidden unless your role holds <span className="font-mono">employee.view_sensitive</span>.
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === 'records' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card padded={false}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="font-bold">Documents</div>
                <p className="text-[11px] text-mute">{data.documents?.length || 0} on file</p>
              </div>
              <a href="#/documents" className="btn-soft btn-xs">Open documents</a>
            </div>
            {data.documents?.length ? (
              <div className="divide-line">
                {data.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl soft"><Icon name="document" size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{d.title}</div>
                      <div className="truncate text-[10px] text-mute">{titleCase(d.category)} · {d.file_name}</div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4"><EmptyState icon="document" title="No documents" message="Upload your ID and employment proofs." compact /></div>
            )}
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="font-bold">KYC verification</div>
                <p className="text-[11px] text-mute">{data.kyc?.length || 0} checks</p>
              </div>
              <a href="#/kyc" className="btn-soft btn-xs">Open KYC</a>
            </div>
            {data.kyc?.length ? (
              <div className="divide-line">
                {data.kyc.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl soft"><Icon name="shield" size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{k.type}</div>
                      <div className="truncate text-[10px] text-mute">submitted {relative(k.submitted_at)}{k.score ? ` · score ${k.score}` : ''}</div>
                    </div>
                    <StatusBadge status={k.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4"><EmptyState icon="shield" title="No KYC checks" message="Submit an identity verification to get started." compact /></div>
            )}
          </Card>
        </div>
      )}

      {tab === 'security' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle icon="lock" title="Sign-in methods" subtitle="What can authenticate you" />
            <div className="mt-3 space-y-2">
              {[
                ['Password', true, 'Always available'],
                ['App PIN', e.has_pin, e.has_pin ? 'Set — sign in with 4–8 digits' : 'Not configured'],
                ['Face unlock', e.face_enrolled, e.face_enrolled ? 'Template enrolled' : 'Not enrolled'],
                ['Fingerprint', e.fingerprint_enrolled, e.fingerprint_enrolled ? 'Template enrolled' : 'Not enrolled']
              ].map(([label, on, hint]) => (
                <div key={label} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--bg-soft)' }}>
                  <span className={`grid h-8 w-8 place-items-center rounded-xl ${on ? 'text-emerald-600' : 'text-mute'}`} style={{ background: on ? '#10b98122' : undefined }}>
                    <Icon name={on ? 'checkCircle' : 'xCircle'} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{label}</div>
                    <div className="text-[11px] text-mute">{hint}</div>
                  </div>
                </div>
              ))}
            </div>
            <a href="#/settings" className="btn-soft mt-3 inline-flex"><Icon name="settings" size={15} /> Manage security</a>
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="font-bold">Your devices</div>
                <p className="text-[11px] text-mute">{data.devices?.length || 0} enrolled</p>
              </div>
              <a href="#/devices" className="btn-soft btn-xs">Open devices</a>
            </div>
            {data.devices?.length ? (
              <div className="divide-line">
                {data.devices.slice(0, 6).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl soft"><Icon name="device" size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{d.label}</div>
                      <div className="truncate text-[10px] text-mute">{d.model} · seen {relative(d.last_seen_at)}</div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4"><EmptyState icon="device" title="No devices" message="Enroll a phone to punch in with biometrics." compact /></div>
            )}
          </Card>
        </div>
      )}

      <EditProfileModal open={edit} onClose={() => setEdit(false)} employee={e} onSaved={() => reload({ silent: true })} />
    </div>
  );
}
