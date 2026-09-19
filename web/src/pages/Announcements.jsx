import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, EmptyState, Icon, IconButton, Input, Modal, PageHeader,
  SearchInput, Select, SkeletonRows, Stat, Textarea, Toggle
} from '../ui/index.jsx';
import { fmtDateTime, relative, titleCase } from '../lib/format.js';

const CATEGORIES = [
  { key: 'general', label: 'General', icon: '📣' },
  { key: 'policy', label: 'Policy', icon: '📜' },
  { key: 'hr', label: 'HR', icon: '🧑‍💼' },
  { key: 'it', label: 'IT', icon: '🖥️' },
  { key: 'culture', label: 'Culture', icon: '🎉' },
  { key: 'achievement', label: 'Achievement', icon: '🏆' },
  { key: 'health', label: 'Health & safety', icon: '🩺' },
  { key: 'engineering', label: 'Engineering', icon: '⚙️' },
  { key: 'operations', label: 'Operations', icon: '📦' }
];
const catOf = (k) => CATEGORIES.find((c) => c.key === k) || { label: titleCase(k), icon: '📣' };
const PRIORITY_TONE = { critical: 'rose', high: 'amber', normal: 'slate' };

function ComposeModal({ open, onClose, onDone, departments }) {
  const { toast } = useStore();
  const [form, setForm] = useState({ title: '', body: '', category: 'general', audience: 'all', priority: 'normal', pinned: false });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast('Title and message are required', 'warn');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/announcements', form);
      toast('Announcement published 📣', 'success');
      setForm({ title: '', body: '', category: 'general', audience: 'all', priority: 'normal', pinned: false });
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
      title="New announcement"
      subtitle="Published immediately and pushed to every recipient"
      icon="megaphone"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="megaphone" loading={busy} onClick={submit}>Publish</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label">Title *</span>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Diwali holiday schedule published" />
        </label>
        <label className="block">
          <span className="label">Message *</span>
          <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the announcement…" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Category</span>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
          </label>
          <label className="block">
            <span className="label">Audience</span>
            <Select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              options={[
                { value: 'all', label: 'Everyone' },
                ...departments.map((d) => ({ value: d.name, label: d.name }))
              ]}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {['normal', 'high', 'critical'].map((p) => (
            <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })} className={`chip ${form.priority === p ? 'chip-active' : ''}`}>
              {titleCase(p)}
            </button>
          ))}
          <span className="ml-auto"><Toggle label="Pin to top" checked={form.pinned} onChange={(v) => setForm({ ...form, pinned: v })} /></span>
        </div>
      </div>
    </Modal>
  );
}

export default function Announcements() {
  const { can, toast } = useStore();
  const manages = can('announcement.manage');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const { data, loading, reload } = useResource(() => api.get('/api/announcements'), []);
  const { data: depts } = useResource(() => api.get('/api/departments'), []);

  const all = data?.rows || [];
  const rows = useMemo(
    () => all.filter((a) => (!category || a.category === category) && (!search || `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase()))),
    [all, category, search]
  );
  const categories = useMemo(() => {
    const m = new Map();
    for (const a of all) m.set(a.category, (m.get(a.category) || 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [all]);

  const togglePin = async (a) => {
    try {
      await api.patch(`/api/announcements/${a.id}`, { pinned: a.pinned ? 0 : 1 });
      toast(a.pinned ? 'Unpinned' : 'Pinned to top', 'success');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="megaphone"
        title="Announcements"
        subtitle="Company-wide news, policy changes and celebrations"
        actions={
          manages ? (
            <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
              New announcement
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="megaphone" label="Announcements" value={all.length} tone="brand" />
        <Stat icon="pin" label="Pinned" value={all.filter((a) => a.pinned).length} tone="amber" />
        <Stat icon="alert" label="Critical" value={all.filter((a) => a.priority === 'critical').length} tone="rose" />
        <Stat icon="calendar" label="Categories" value={categories.length} tone="emerald" />
      </div>

      <Card padded={false} className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
          <SearchInput className="min-w-[180px] flex-1" value={search} onChange={setSearch} placeholder="Search announcements…" />
        </div>
        <div className="flex flex-wrap gap-1.5 p-3">
          <button type="button" onClick={() => setCategory('')} className={`chip ${category === '' ? 'chip-active' : ''}`}>All</button>
          {categories.map(([k, n]) => (
            <button key={k} type="button" onClick={() => setCategory(k)} className={`chip ${category === k ? 'chip-active' : ''}`}>
              {catOf(k).icon} {catOf(k).label} · {n}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-4"><Card><SkeletonRows rows={4} /></Card><Card><SkeletonRows rows={3} /></Card></div>
      ) : rows.length ? (
        <div className="space-y-4">
          {rows.map((a) => {
            const meta = catOf(a.category);
            const isOpen = expanded === a.id;
            return (
              <Card key={a.id} className="animate-fade-up">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: 'var(--bg-soft)' }}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{a.title}</span>
                      {a.pinned ? <Badge tone="amber" size="sm" icon="pin">Pinned</Badge> : null}
                      {a.priority !== 'normal' && <Badge tone={PRIORITY_TONE[a.priority]} size="sm">{titleCase(a.priority)}</Badge>}
                      <Badge tone="slate" size="sm">{meta.label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-mute">
                      <Avatar person={a} size={18} />
                      <span>{a.author}</span>
                      <span>·</span>
                      <span>{relative(a.publish_at || a.created_at)}</span>
                      <span>·</span>
                      <span>audience: {a.audience === 'all' ? 'everyone' : a.audience}</span>
                    </div>
                    <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed text-soft ${isOpen ? '' : 'line-clamp-2'}`}>{a.body}</p>
                    {a.body?.length > 180 && (
                      <button type="button" className="link mt-1 text-xs font-bold" onClick={() => setExpanded(isOpen ? null : a.id)}>
                        {isOpen ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                  {manages && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <IconButton icon="pin" label={a.pinned ? 'Unpin' : 'Pin to top'} size={15} onClick={() => togglePin(a)} />
                      <IconButton icon="trash" label="Delete" size={15} onClick={() => setRemoving(a)} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="megaphone"
            title="Nothing announced yet"
            message={manages ? 'Publish the first announcement for your team.' : 'Company news will show up here.'}
            action={manages ? <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>New announcement</Button> : null}
          />
        </Card>
      )}

      <ComposeModal open={open} onClose={() => setOpen(false)} onDone={() => reload({ silent: true })} departments={depts?.rows || depts || []} />
      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete “${removing?.title}”?`}
        message="Recipients keep any notification they already received."
        confirmLabel="Delete"
        onConfirm={async () => {
          await api.del(`/api/announcements/${removing.id}`, {});
          toast('Announcement deleted', 'warn');
          reload({ silent: true });
        }}
      />
    </div>
  );
}
