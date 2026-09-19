import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useDebounced, useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, EmptyState, Icon, IconButton, Input, Modal, PageHeader,
  SearchInput, Select, SkeletonRows, Stat, StatusBadge, Tabs, DataTable, Avatar as Av
} from '../ui/index.jsx';
import { fmtDate, relative, titleCase } from '../lib/format.js';

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  designation: '',
  role: 'employee',
  department_id: '',
  location_id: '',
  manager_id: '',
  shift_id: '',
  employment_type: 'full_time',
  work_mode: 'onsite',
  join_date: new Date().toISOString().slice(0, 10),
  salary: '',
  city: '',
  status: 'active'
};

function EmployeeForm({ open, onClose, initial, departments, locations, shifts, people, onSaved }) {
  const { toast } = useStore();
  const editing = !!initial?.id;
  const [form, setForm] = useState(initial || EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => setForm(initial || EMPTY), [initial, open]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = { ...form, salary: form.salary ? Number(form.salary) : null };
      ['department_id', 'location_id', 'manager_id', 'shift_id'].forEach((k) => {
        payload[k] = payload[k] ? Number(payload[k]) : null;
      });
      if (editing) await api.patch(`/api/employees/${initial.id}`, payload);
      else await api.post('/api/employees', payload);
      toast(editing ? 'Employee updated' : 'Employee onboarded 🎉', 'success');
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }));
  const locOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const shiftOptions = shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.start_time}–${s.end_time})` }));
  const mgrOptions = people.filter((p) => p.id !== initial?.id).map((p) => ({ value: p.id, label: `${p.full_name} · ${p.designation || p.role_label}` }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${initial.full_name}` : 'Onboard new employee'}
      subtitle={editing ? 'Update the employee record' : 'Creates a login, leave balances and a device slot'}
      icon={editing ? 'edit' : 'plus'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit} icon="check">
            {editing ? 'Save changes' : 'Create employee'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">First name *</span>
          <Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="Asha" />
        </label>
        <label>
          <span className="label">Last name</span>
          <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Rao" />
        </label>
        <label>
          <span className="label">Work email *</span>
          <Input icon="mail" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="asha.rao@northpeak.io" />
        </label>
        <label>
          <span className="label">Phone</span>
          <Input icon="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 90000 00000" />
        </label>
        <label>
          <span className="label">Designation</span>
          <Input value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="Product Designer" />
        </label>
        <label>
          <span className="label">Role</span>
          <Select
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
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
        <label>
          <span className="label">Department</span>
          <Select placeholder="Select department" value={form.department_id} onChange={(e) => set('department_id', e.target.value)} options={deptOptions} />
        </label>
        <label>
          <span className="label">Reporting manager</span>
          <Select placeholder="Select manager" value={form.manager_id} onChange={(e) => set('manager_id', e.target.value)} options={mgrOptions} />
        </label>
        <label>
          <span className="label">Location</span>
          <Select placeholder="Select location" value={form.location_id} onChange={(e) => set('location_id', e.target.value)} options={locOptions} />
        </label>
        <label>
          <span className="label">Shift</span>
          <Select placeholder="Select shift" value={form.shift_id} onChange={(e) => set('shift_id', e.target.value)} options={shiftOptions} />
        </label>
        <label>
          <span className="label">Join date</span>
          <Input type="date" value={form.join_date} onChange={(e) => set('join_date', e.target.value)} />
        </label>
        <label>
          <span className="label">Employment type</span>
          <Select
            value={form.employment_type}
            onChange={(e) => set('employment_type', e.target.value)}
            options={[
              { value: 'full_time', label: 'Full time' },
              { value: 'part_time', label: 'Part time' },
              { value: 'contract', label: 'Contract' },
              { value: 'intern', label: 'Intern' }
            ]}
          />
        </label>
        <label>
          <span className="label">Work mode</span>
          <Select
            value={form.work_mode}
            onChange={(e) => set('work_mode', e.target.value)}
            options={[
              { value: 'onsite', label: 'On-site' },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'remote', label: 'Remote' }
            ]}
          />
        </label>
        <label>
          <span className="label">Annual CTC (INR)</span>
          <Input type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} placeholder="1200000" />
        </label>
        <label>
          <span className="label">City</span>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Bengaluru" />
        </label>
        <label>
          <span className="label">Status</span>
          <Select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'on_notice', label: 'On notice' },
              { value: 'sabbatical', label: 'Sabbatical' },
              { value: 'terminated', label: 'Exited' }
            ]}
          />
        </label>
      </div>
      <p className="mt-3 rounded-xl soft px-3 py-2 text-[11px] text-mute">
        New employees get the default password <code className="font-bold">Demo@1234</code> and a full leave balance allocation for the current year.
      </p>
    </Modal>
  );
}

export default function Employees() {
  const { can } = useStore();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [offboard, setOffboard] = useState(null);
  const debounced = useDebounced(search, 280);

  const { data: meta } = useResource(() => Promise.all([api.get('/api/departments'), api.get('/api/locations'), api.get('/api/shifts'), api.get('/api/roles')]).then(
    ([d, l, s, r]) => ({ departments: d.rows, locations: l.rows, shifts: s.rows, roles: r.roles })
  ), []);
  const { data: directory } = useResource(() => api.get('/api/directory'), []);

  const query = `limit=20&page=${page}&sort=${sort}${debounced ? `&search=${encodeURIComponent(debounced)}` : ''}${department ? `&department=${department}` : ''}${role ? `&role=${role}` : ''}${status ? `&status=${status}` : ''}`;
  const { data, loading, reload } = useResource(() => api.get(`/api/employees?${query}`), [query]);

  const departments = meta?.departments || [];
  const facets = data?.facets;

  return (
    <div className="page-wide">
      <PageHeader
        icon="users"
        title="Employees"
        subtitle={`${facets?.headcount ?? 0} active people across ${departments.length} departments`}
        actions={
          <>
            <Button variant="outline" icon="download" onClick={() => (window.location.hash = '/reports')}>
              Export
            </Button>
            {can('employee.create') && (
              <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add employee
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="users" label="Headcount" value={facets?.headcount ?? '—'} tone="indigo" />
        <Stat icon="briefcase" label="Departments" value={departments.length} tone="violet" />
        <Stat icon="sitemap" label="Managers" value={facets?.roles?.filter((r) => !['employee'].includes(r.role)).reduce((s, r) => s + r.count, 0) ?? '—'} tone="teal" />
        <Stat icon="alert" label="Exited (all time)" value={facets?.statuses?.find((s) => s.status === 'terminated')?.count ?? 0} tone="rose" />
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
          <SearchInput className="min-w-[180px] flex-1" value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, email, code, designation…" />
          <Select
            className="input-sm w-auto"
            placeholder="All departments"
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            options={departments.map((d) => ({ value: d.id, label: `${d.icon || ''} ${d.name} (${d.headcount})` }))}
          />
          <Select
            className="input-sm w-auto"
            placeholder="All roles"
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            options={(meta?.roles || []).map((r) => ({ value: r.key, label: r.label }))}
          />
          <Select
            className="input-sm w-auto"
            placeholder="Active"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'on_notice', label: 'On notice' },
              { value: 'sabbatical', label: 'Sabbatical' },
              { value: 'terminated', label: 'Exited' }
            ]}
          />
          <Select
            className="input-sm w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={[
              { value: 'name', label: 'Sort: Name' },
              { value: 'recent', label: 'Sort: Newest' },
              { value: 'join_date', label: 'Sort: Join date' },
              { value: 'department', label: 'Sort: Department' }
            ]}
          />
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonRows rows={8} />
          </div>
        ) : data?.rows?.length ? (
          <>
            <div className="divide-line">
              {data.rows.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-[var(--surface-2)]">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => (window.location.hash = `/employees/${e.id}`)}>
                    <Avatar person={e} size={40} showStatus status={e.today?.status} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold">{e.full_name}</span>
                        <span className="hidden rounded px-1.5 text-[10px] font-bold text-mute sm:inline">{e.emp_code}</span>
                      </span>
                      <span className="block truncate text-[11px] text-mute">
                        {e.designation} {e.department ? `· ${e.department}` : ''} {e.location ? `· ${e.location}` : ''}
                      </span>
                    </span>
                  </button>
                  <span className="hidden items-center gap-1.5 md:flex">
                    <Badge tone="slate">{e.role_label}</Badge>
                    {e.today ? <StatusBadge status={e.today.status} /> : null}
                  </span>
                  {can('employee.update') && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <IconButton icon="edit" label="Edit" onClick={() => { setEditing(e); setFormOpen(true); }} />
                      {can('employee.delete') && e.status !== 'terminated' && (
                        <IconButton icon="logout" label="Offboard" onClick={() => setOffboard(e)} />
                      )}
                    </span>
                  )}
                  <IconButton icon="chevronRight" label="Open profile" onClick={() => (window.location.hash = `/employees/${e.id}`)} className="rtl:rotate-180" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t px-3 py-2.5 text-xs font-semibold text-mute" style={{ borderColor: 'var(--border)' }}>
              <span>
                Page {data.page} of {data.pages} · {data.total} people
              </span>
              <span className="flex gap-1.5">
                <Button size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)} icon="chevronLeft">Prev</Button>
                <Button size="sm" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next<Icon name="chevronRight" size={14} /></Button>
              </span>
            </div>
          </>
        ) : (
          <div className="p-4">
            <EmptyState
              icon="search"
              title="No employees match"
              message="Try clearing the search or filters."
              action={<Button onClick={() => { setSearch(''); setDepartment(''); setRole(''); setStatus(''); }}>Clear filters</Button>}
            />
          </div>
        )}
      </Card>

      <EmployeeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        departments={departments}
        locations={meta?.locations || []}
        shifts={meta?.shifts || []}
        people={directory?.people || []}
        onSaved={() => reload({ silent: true })}
      />

      <Confirm
        open={!!offboard}
        onClose={() => setOffboard(null)}
        title={`Offboard ${offboard?.full_name}?`}
        message="The employee is marked as exited, loses access immediately and their reports are unassigned. This is reversible from the Exited filter."
        confirmLabel="Offboard"
        onConfirm={async () => {
          await api.del(`/api/employees/${offboard.id}`, {});
          reload({ silent: true });
        }}
      />
    </div>
  );
}
