import React, { useMemo, useState } from 'react';
import { api, fileToDataUrl } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, Confirm, EmptyState, Icon, IconButton, Input, Modal, PageHeader,
  Progress, SearchInput, Select, SkeletonRows, Stat, StatusBadge, Tabs
} from '../ui/index.jsx';
import { countdown, fmtDate, relative } from '../lib/format.js';

const CATEGORIES = [
  { key: 'kyc', label: 'KYC / ID proof', icon: '🪪' },
  { key: 'employment', label: 'Employment', icon: '📄' },
  { key: 'finance', label: 'Finance & bank', icon: '💰' },
  { key: 'education', label: 'Education', icon: '🎓' },
  { key: 'policy', label: 'Policy & agreements', icon: '📜' },
  { key: 'benefits', label: 'Benefits', icon: '🎁' },
  { key: 'it', label: 'IT & assets', icon: '💻' },
  { key: 'other', label: 'Other', icon: '📁' }
];

function UploadModal({ open, onClose, onDone }) {
  const { toast } = useStore();
  const [form, setForm] = useState({ title: '', category: 'kyc', expiry_date: '', issue_date: new Date().toISOString().slice(0, 10) });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (f) => {
    if (!f) return;
    setFile(f);
    if (!form.title) setForm((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload document"
      subtitle="Stored encrypted at rest and routed to HR for verification"
      icon="upload"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const dataUrl = file ? await fileToDataUrl(file) : null;
                await api.post('/api/documents', {
                  ...form,
                  expiry_date: form.expiry_date || null,
                  dataUrl,
                  file_name: file?.name || null,
                  doc_type: file?.name?.split('.').pop() || 'pdf'
                });
                toast('Document uploaded — pending verification', 'success');
                setFile(null);
                setForm({ title: '', category: 'kyc', expiry_date: '', issue_date: new Date().toISOString().slice(0, 10) });
                onDone?.();
                onClose();
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label
          className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition hover:bg-[var(--surface-2)]"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <Icon name="upload" size={26} className="text-mute" />
          <span className="mt-2 text-sm font-bold">{file ? file.name : 'Tap to choose a file'}</span>
          <span className="text-[11px] text-mute">PDF, JPG or PNG · max 10 MB</span>
          <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <label className="block"><span className="label">Title *</span><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Aadhaar Card" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Category</span>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
          </label>
          <label><span className="label">Expiry (optional)</span><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></label>
        </div>
      </div>
    </Modal>
  );
}

function DocRow({ d, canVerify, onVerify, onDelete }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base" style={{ background: 'var(--bg-soft)' }}>
        {CATEGORIES.find((c) => c.key === d.category)?.icon || '📁'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-bold">{d.title}</span>
          <StatusBadge status={d.status} />
        </div>
        <p className="mt-0.5 truncate text-[11px] text-mute">
          {d.owner} · {d.file_name} · {d.size_kb}KB · uploaded {relative(d.created_at)}
          {d.expiry_date ? ` · expires ${fmtDate(d.expiry_date)} (${countdown(d.expiry_date)})` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canVerify && d.status === 'pending' && (
          <>
            <Button size="sm" variant="primary" icon="check" onClick={() => onVerify(d, 'verified')}>Verify</Button>
            <Button size="sm" variant="outline" icon="x" onClick={() => onVerify(d, 'rejected')}>Reject</Button>
          </>
        )}
        <IconButton icon="trash" label="Delete" onClick={() => onDelete(d)} />
      </div>
    </div>
  );
}

export default function Documents() {
  const { can, toast } = useStore();
  const [tab, setTab] = useState('mine');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [removing, setRemoving] = useState(null);

  const { data, loading, reload } = useResource(
    () => api.get(`/api/documents?scope=${tab}${category ? `&category=${category}` : ''}${status ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    [tab, category, status, search]
  );

  const rows = (data?.rows || []).filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()));
  const totals = data?.totals;

  const verify = async (d, status) => {
    try {
      await api.patch(`/api/documents/${d.id}`, { status, verification_note: status === 'rejected' ? 'Document unclear or mismatched' : null });
      toast(`Document ${status}`, status === 'verified' ? 'success' : 'warn');
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="document"
        title="Documents"
        subtitle="HR documents, KYC proofs and policy acknowledgements"
        actions={
          <Button variant="primary" icon="upload" onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="document" label="Total documents" value={totals?.all ?? '—'} tone="indigo" />
        <Stat icon="checkCircle" label="Verified" value={totals?.verified ?? '—'} tone="emerald" />
        <Stat icon="clock" label="Pending review" value={totals?.pending ?? '—'} tone="amber" />
        <Stat icon="alert" label="Expiring < 60d" value={totals?.expiring ?? '—'} tone="rose" />
      </div>

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'mine', label: 'My documents', icon: '📁' },
          ...(can('document.view_team') || can('document.view_company') ? [{ key: 'all', label: 'All documents', icon: '🗂️' }] : [])
        ]}
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
          <SearchInput className="min-w-[160px] flex-1" value={search} onChange={setSearch} placeholder="Search documents…" />
          <Select className="input-sm w-auto" placeholder="All categories" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES.map((c) => ({ value: c.key, label: `${c.icon} ${c.label}` }))} />
          <div className="flex gap-1.5">
            {['', 'pending', 'verified', 'rejected'].map((s) => (
              <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={`chip ${status === s ? 'chip-active' : ''}`}>
                {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : rows.length ? (
          <div className="divide-line">
            {rows.map((d) => (
              <DocRow key={d.id} d={d} canVerify={can('document.verify') && tab === 'all'} onVerify={verify} onDelete={setRemoving} />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState icon="document" title="No documents found" message="Upload your first document or clear the filters." action={<Button variant="primary" icon="upload" onClick={() => setUploadOpen(true)}>Upload document</Button>} />
          </div>
        )}
      </Card>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onDone={() => reload({ silent: true })} />
      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.title}?`}
        message="This removes the document from the employee record permanently."
        confirmLabel="Delete"
        onConfirm={async () => {
          await api.del(`/api/documents/${removing.id}`, {});
          toast('Document deleted', 'warn');
          reload({ silent: true });
        }}
      />
    </div>
  );
}
