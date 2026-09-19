import React, { useState } from 'react';
import { api } from '../lib/api.js';
import KudoModal from '../components/KudoModal.jsx';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, BarChart, Button, Card, Confirm, Donut, EmptyState, Icon, IconButton, Input, KeyValue,
  Modal, PageHeader, Progress, Ring, SectionTitle, SkeletonRows, Stat, StatusBadge, Tabs, Select, Textarea
} from '../ui/index.jsx';
import { currency, fmtDate, fmtDateTime, minutesToHM, pct, relative, titleCase } from '../lib/format.js';

function AttendanceTab({ id }) {
  const { data, loading } = useResource(() => api.get(`/api/attendance/employee/${id}`), [id]);
  const rollup = data?.rollup;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="checkCircle" label="Present" value={rollup?.present ?? '—'} tone="emerald" />
        <Stat icon="alert" label="Late" value={rollup?.late ?? '—'} tone="amber" />
        <Stat icon="calendarCheck" label="On leave" value={rollup?.leave ?? '—'} tone="sky" />
        <Stat icon="clock" label="Hours worked" value={rollup ? Math.round(rollup.workedMinutes / 60) : '—'} tone="indigo" />
      </div>
      <Card padded={false}>
        {loading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : data?.rows?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Worked</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{fmtDate(r.date)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.first_in ? new Date(r.first_in).toISOString().slice(11, 16) : '—'}</td>
                    <td>{r.last_out ? new Date(r.last_out).toISOString().slice(11, 16) : '—'}</td>
                    <td className="font-bold">{minutesToHM(r.work_minutes)}</td>
                    <td className="text-mute">{r.in_method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4"><EmptyState compact icon="clock" title="No attendance in range" /></div>
        )}
      </Card>
    </div>
  );
}

function DocumentsTab({ documents, kyc }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle icon="document" title="HR documents" subtitle={`${documents?.length || 0} on file`} />
        {documents?.length ? (
          <div className="divide-line">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl soft">
                  <Icon name="document" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.title}</p>
                  <p className="truncate text-[11px] text-mute">{d.category} · {d.file_name} · {d.size_kb}KB</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon="document" title="No documents" />
        )}
      </Card>
      <Card>
        <SectionTitle icon="shield" title="KYC checks" />
        {kyc?.length ? (
          <div className="divide-line">
            {kyc.map((k) => (
              <div key={k.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl soft">
                  <Icon name="shield" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{k.type}</p>
                  <p className="truncate text-[11px] text-mute">Score {k.score ?? '—'} · {relative(k.submitted_at)}</p>
                </div>
                <StatusBadge status={k.status} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon="shield" title="No KYC checks" />
        )}
      </Card>
    </div>
  );
}

function GoalsTab({ id }) {
  const { data, loading } = useResource(() => api.get(`/api/goals?employee_id=${id}`), [id]);
  return (
    <div className="space-y-3">
      {loading ? (
        <SkeletonRows rows={4} />
      ) : data?.rows?.length ? (
        data.rows.map((g) => (
          <Card key={g.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{g.title}</p>
                <p className="mt-0.5 text-xs text-mute">{g.category} · weight {g.weight}% · due {fmtDate(g.due_date)}</p>
              </div>
              <StatusBadge status={g.status} />
            </div>
            <Progress className="mt-3" value={g.progress} tone={g.status === 'ahead' ? 'sky' : g.status === 'on_track' ? 'emerald' : 'amber'} label="Progress" />
            {g.keyResults?.length > 0 && (
              <ul className="mt-3 space-y-2">
                {g.keyResults.map((kr) => (
                  <li key={kr.id} className="rounded-xl soft px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold">{kr.title}</span>
                      <span className="font-bold text-mute">{kr.current}/{kr.target}{kr.unit}</span>
                    </div>
                    <Progress className="mt-1.5" height={5} value={kr.percent} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))
      ) : (
        <EmptyState compact icon="target" title="No goals assigned" />
      )}
    </div>
  );
}

function PerformanceTab({ id }) {
  const { data, loading } = useResource(() => api.get(`/api/reviews?employee_id=${id}`), [id]);
  if (loading) return <SkeletonRows rows={3} />;
  if (!data?.rows?.length) return <EmptyState compact icon="trending" title="No reviews yet" message="Performance cycles appear here once published." />;
  return (
    <div className="space-y-3">
      {data.rows.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">{r.cycle_name || 'Review'}</p>
              <p className="text-xs text-mute">{r.period} · by {r.reviewer_name || '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              {r.rating ? <Badge tone="indigo">⭐ {r.rating}</Badge> : null}
              <StatusBadge status={r.status} />
            </div>
          </div>
          {r.summary && <p className="mt-2 text-xs text-soft">{r.summary}</p>}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ['Productivity', r.productivity],
              ['Quality', r.quality],
              ['Teamwork', r.teamwork],
              ['Initiative', r.initiative],
              ['Reliability', r.reliability]
            ].map(([label, v]) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase text-mute">{label}</p>
                <Progress value={v} height={6} />
              </div>
            ))}
          </div>
          {(r.strengths?.length > 0 || r.improvements?.length > 0) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(16,185,129,.08)' }}>
                <p className="text-[10px] font-black uppercase text-emerald-600">Strengths</p>
                <p className="mt-1 text-xs font-semibold">{(r.strengths || []).join(' · ')}</p>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(245,158,11,.08)' }}>
                <p className="text-[10px] font-black uppercase text-amber-600">Focus areas</p>
                <p className="mt-1 text-xs font-semibold">{(r.improvements || []).join(' · ')}</p>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function DevicesTab({ devices }) {
  return (
    <Card padded={false}>
      {devices?.length ? (
        <div className="divide-line">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl soft">
                <Icon name="device" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.label}</p>
                <p className="truncate text-[11px] text-mute">{d.platform} · {d.model} · v{d.app_version} · seen {relative(d.last_seen_at)}</p>
              </div>
              {d.fingerprint_enrolled ? <Badge tone="indigo">👆</Badge> : null}
              {d.face_enrolled ? <Badge tone="violet">🙂</Badge> : null}
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4"><EmptyState compact icon="device" title="No devices enrolled" /></div>
      )}
    </Card>
  );
}

function TimelineTab({ id }) {
  const { data, loading } = useResource(() => api.get(`/api/employees/${id}/timeline`), [id]);
  if (loading) return <SkeletonRows rows={5} />;
  if (!data?.events?.length) return <EmptyState compact icon="history" title="No activity yet" />;
  return (
    <Card>
      <ol className="relative space-y-4 border-l pl-5" style={{ borderColor: 'var(--border)' }}>
        {data.events.map((e, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-[var(--surface)]" style={{ background: 'var(--brand)' }} />
            <p className="text-sm font-semibold">{e.text}</p>
            <p className="text-[11px] text-mute">{fmtDateTime(e.at)} · {e.kind}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function EmployeeDetail({ params }) {
  const id = params.id;
  const { can, toast } = useStore();
  const { data, loading, error, reload } = useResource(() => api.get(`/api/employees/${id}`), [id]);
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({});
  const [kudoOpen, setKudoOpen] = useState(false);

  if (loading && !data) {
    return (
      <div className="page">
        <PageHeader title="Employee" back="/employees" />
        <SkeletonRows rows={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <EmptyState icon="alert" title="Employee not available" message={error.message} action={<Button variant="primary" onClick={() => (window.location.hash = '/employees')}>Back to list</Button>} />
      </div>
    );
  }

  const e = data.employee;
  const m = data.metrics;

  const openEdit = () => {
    setForm({
      phone: e.phone,
      designation: e.designation,
      address: e.address,
      city: e.city,
      emergency_contact: e.emergency_contact,
      emergency_phone: e.emergency_phone,
      bio: e.bio,
      salary: e.salary,
      role: e.role,
      status: e.status
    });
    setEditOpen(true);
  };

  return (
    <div className="page">
      <PageHeader
        back="/employees"
        title={e.full_name}
        subtitle={`${e.designation} · ${e.department} · ${e.emp_code}`}
        actions={
          <>
            <Button variant="outline" icon="star" onClick={() => setKudoOpen(true)}>
              Give kudos
            </Button>
            {can('employee.update') && (
              <Button variant="primary" icon="edit" onClick={openEdit}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-4 overflow-hidden p-0">
        <div className="relative h-24" style={{ background: `linear-gradient(120deg, ${e.department_color || '#6366f1'}, transparent)` }} />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <Avatar person={e} size={80} ring />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black">{e.full_name}</h2>
                <StatusBadge status={e.status} />
                <Badge tone="slate">{e.role_label}</Badge>
                {e.biometric_enabled && <Badge tone="violet">🧬 biometric</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-mute">
                {e.email} · {e.phone} · joined {fmtDate(e.join_date)}
              </p>
            </div>
            <div className="flex gap-2">
              <a className="btn-soft" href={`mailto:${e.email}`}><Icon name="mail" size={15} />Email</a>
              <a className="btn-soft" href={`tel:${e.phone}`}><Icon name="phone" size={15} />Call</a>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon="checkCircle" label="Attendance (30d)" value={pct(m.attendanceRate, 1)} tone="emerald" />
            <Stat icon="star" label="Avg rating" value={m.avgRating ?? '—'} tone="amber" />
            <Stat icon="target" label="Goal progress" value={pct(m.goalProgress)} tone="indigo" />
            <Stat icon="heart" label="Kudos received" value={m.kudosReceived} tone="rose" />
          </div>
        </div>
      </Card>

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'attendance', label: 'Attendance' },
          { key: 'documents', label: 'Documents & KYC' },
          { key: 'goals', label: 'KRA & goals' },
          { key: 'performance', label: 'Performance' },
          { key: 'devices', label: 'Devices' },
          { key: 'reports', label: 'Direct reports', count: data.reports?.length },
          { key: 'timeline', label: 'Timeline' }
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <Card>
              <SectionTitle icon="user" title="Employment" />
              <KeyValue
                items={[
                  ['Employee code', e.emp_code],
                  ['Designation', e.designation],
                  ['Department', `${e.department_icon || ''} ${e.department}`],
                  ['Role', e.role_label],
                  ['Employment type', titleCase(e.employment_type || '')],
                  ['Work mode', titleCase(e.work_mode || '')],
                  ['Join date', fmtDate(e.join_date)],
                  ['Probation ends', fmtDate(e.probation_end)],
                  ['Notice period', `${e.notice_period_days} days`],
                  ['Tenure', `${Math.round(m.tenureDays / 365)} years`]
                ]}
              />
            </Card>
            <Card>
              <SectionTitle icon="briefcase" title="Work assignment" />
              <KeyValue
                items={[
                  ['Shift', e.shift ? `${e.shift.name} (${e.shift.start}–${e.shift.end})` : '—'],
                  ['Location', e.location || '—'],
                  ['City', e.city],
                  ['Reporting manager', data.manager?.name || '—'],
                  ['Direct reports', data.reports?.length ?? 0],
                  ...(can('employee.view_sensitive') ? [['Annual CTC', currency(e.salary, e.currency)], ['Tax ID', e.tax_id], ['Bank account', e.bank_account]] : [])
                ]}
              />
            </Card>
            {e.bio && (
              <Card>
                <SectionTitle icon="info" title="About" />
                <p className="text-sm text-soft">{e.bio}</p>
                {e.skills?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.skills.map((s) => (
                      <span key={s} className="chip">{s}</span>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
          <div className="space-y-4">
            <Card>
              <SectionTitle icon="clock" title="Last 30 days" />
              <BarChart
                data={(data.last30 || []).slice(0, 14).reverse().map((d) => ({ label: d.date.slice(8, 10), hours: Number(((d.work_minutes || 0) / 60).toFixed(1)) }))}
                xKey="label"
                height={150}
                keys={[{ key: 'hours', label: 'Hours', color: 'var(--brand)' }]}
              />
            </Card>
            <Card>
              <SectionTitle icon="sitemap" title="Manager & team" />
              {data.manager && (
                <button type="button" className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-[var(--surface-2)]" onClick={() => (window.location.hash = `/employees/${data.manager.id}`)}>
                  <Avatar person={data.manager} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{data.manager.name}</span>
                    <span className="block truncate text-[11px] text-mute">{data.manager.designation}</span>
                  </span>
                  <Badge tone="slate">Manager</Badge>
                </button>
              )}
              {data.reports?.length > 0 && (
                <div className="mt-2 divide-line">
                  {data.reports.slice(0, 5).map((r) => (
                    <button key={r.id} type="button" className="flex w-full items-center gap-3 py-2 text-left hover:bg-[var(--surface-2)]" onClick={() => (window.location.hash = `/employees/${r.id}`)}>
                      <Avatar person={r} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.full_name}</span>
                        <span className="block truncate text-[11px] text-mute">{r.designation}</span>
                      </span>
                      <Icon name="chevronRight" size={15} className="text-mute rtl:rotate-180" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <SectionTitle icon="alert" title="Compliance" />
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-xl soft px-3 py-2.5">
                  <span className="font-semibold">Documents expiring &lt; 60d</span>
                  <Badge tone={m.docsExpiring ? 'amber' : 'emerald'}>{m.docsExpiring}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl soft px-3 py-2.5">
                  <span className="font-semibold">KYC checks</span>
                  <Badge tone={data.kyc?.some((k) => k.status !== 'verified') ? 'amber' : 'emerald'}>{data.kyc?.filter((k) => k.status === 'verified').length || 0}/{data.kyc?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl soft px-3 py-2.5">
                  <span className="font-semibold">Enrolled devices</span>
                  <Badge tone="indigo">{data.devices?.length || 0}</Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
      {tab === 'attendance' && <AttendanceTab id={id} />}
      {tab === 'documents' && <DocumentsTab documents={data.documents} kyc={data.kyc} />}
      {tab === 'goals' && <GoalsTab id={id} />}
      {tab === 'performance' && <PerformanceTab id={id} />}
      {tab === 'devices' && <DevicesTab devices={data.devices} />}
      {tab === 'reports' && (
        <Card padded={false}>
          {data.reports?.length ? (
            <div className="divide-line">
              {data.reports.map((r) => (
                <button key={r.id} type="button" className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[var(--surface-2)]" onClick={() => (window.location.hash = `/employees/${r.id}`)}>
                  <Avatar person={r} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.full_name}</span>
                    <span className="block truncate text-[11px] text-mute">{r.designation} · {r.department}</span>
                  </span>
                  <StatusBadge status={r.status} />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4"><EmptyState compact icon="users" title="No direct reports" /></div>
          )}
        </Card>
      )}
      {tab === 'timeline' && <TimelineTab id={id} />}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${e.full_name}`}
        icon="edit"
        size="lg"
        footer={
          <>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await api.patch(`/api/employees/${id}`, form);
                  toast('Employee updated', 'success');
                  setEditOpen(false);
                  reload({ silent: true });
                } catch (err) {
                  toast(err.message, 'error');
                }
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Designation</span><Input value={form.designation || ''} onChange={(ev) => setForm({ ...form, designation: ev.target.value })} /></label>
          <label><span className="label">Phone</span><Input value={form.phone || ''} onChange={(ev) => setForm({ ...form, phone: ev.target.value })} /></label>
          <label><span className="label">Role</span>
            <Select
              value={form.role || 'employee'}
              onChange={(ev) => setForm({ ...form, role: ev.target.value })}
              options={[
                { value: 'employee', label: 'Employee' },
                { value: 'team_leader', label: 'Team Leader' },
                { value: 'supervisor', label: 'Supervisor' },
                { value: 'dept_manager', label: 'Department Manager' },
                { value: 'hr_manager', label: 'HR Manager' },
                { value: 'hr_admin', label: 'HR Admin' },
                { value: 'super_admin', label: 'Super Admin' }
              ]}
            />
          </label>
          <label><span className="label">Status</span>
            <Select
              value={form.status || 'active'}
              onChange={(ev) => setForm({ ...form, status: ev.target.value })}
              options={[{ value: 'active', label: 'Active' }, { value: 'on_notice', label: 'On notice' }, { value: 'sabbatical', label: 'Sabbatical' }, { value: 'terminated', label: 'Exited' }]}
            />
          </label>
          <label><span className="label">Address</span><Input value={form.address || ''} onChange={(ev) => setForm({ ...form, address: ev.target.value })} /></label>
          <label><span className="label">City</span><Input value={form.city || ''} onChange={(ev) => setForm({ ...form, city: ev.target.value })} /></label>
          <label><span className="label">Emergency contact</span><Input value={form.emergency_contact || ''} onChange={(ev) => setForm({ ...form, emergency_contact: ev.target.value })} /></label>
          <label><span className="label">Emergency phone</span><Input value={form.emergency_phone || ''} onChange={(ev) => setForm({ ...form, emergency_phone: ev.target.value })} /></label>
          {can('employee.view_sensitive') && (
            <label><span className="label">Annual CTC</span><Input type="number" value={form.salary ?? ''} onChange={(ev) => setForm({ ...form, salary: Number(ev.target.value) })} /></label>
          )}
          <label className="sm:col-span-2"><span className="label">Bio</span><Textarea value={form.bio || ''} onChange={(ev) => setForm({ ...form, bio: ev.target.value })} /></label>
        </div>
      </Modal>

      <KudoModal open={kudoOpen} onClose={() => setKudoOpen(false)} person={e} />
    </div>
  );
}
