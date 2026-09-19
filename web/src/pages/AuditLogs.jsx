import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource } from '../lib/hooks.js';
import {
  Badge, Button, Card, Donut, EmptyState, Icon, Input, PageHeader, SearchInput, Select, SkeletonRows, Stat
} from '../ui/index.jsx';
import { csvDownload, fmtDateTime, relative, titleCase } from '../lib/format.js';

const SEVERITY_TONE = { info: 'slate', warning: 'amber', critical: 'rose' };
const ENTITY_ICON = {
  employee: '🧑‍💼', attendance: '⏰', leave: '🌴', approval: '✅', goal: '🎯', review: '📈',
  ticket: '🎫', document: '📄', kyc: '🪪', post: '💬', kudos: '🌟', device: '📱',
  role: '🛡️', company: '🏢', settings: '⚙️', announcement: '📣', shift: '🕒', roster: '🗓️'
};

export default function AuditLogs() {
  const { can, toast } = useStore();
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, loading, reload } = useResource(
    () =>
      api.get(
        `/api/audit-logs?limit=${limit}&offset=${(page - 1) * limit}${action ? `&action=${action}` : ''}${entity ? `&entity=${entity}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`
      ),
    [action, entity, q, from, to, page]
  );

  const rows = data?.rows || [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  const stats = data?.stats || {};
  const severity = stats.bySeverity || [];
  const actions = data?.actions || [];
  const entities = [...new Set((stats.byEntity || []).map((e) => e.entity))];

  const exportCsv = async () => {
    try {
      const res = await api.get('/api/audit-logs/export');
      csvDownload('audit-logs.csv', res.rows || []);
      toast(`Exported ${(res.rows || []).length} audit entries`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="history"
        title="Audit logs"
        subtitle="Every privileged action, access denial and data change"
        actions={
          can('audit.view_all') ? (
            <Button icon="download" onClick={exportCsv}>Export CSV</Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="history" label="Total entries" value={total} tone="indigo" />
        <Stat icon="info" label="Informational" value={severity.find((s) => s.severity === 'info')?.count ?? 0} tone="slate" />
        <Stat icon="alert" label="Warnings" value={severity.find((s) => s.severity === 'warning')?.count ?? 0} tone="amber" />
        <Stat icon="lock" label="Critical" value={severity.find((s) => s.severity === 'critical')?.count ?? 0} tone="rose" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
            <SearchInput
              className="min-w-[170px] flex-1"
              value={q}
              onChange={(v) => { setQ(v); setPage(1); }}
              placeholder="Search actor, entity or summary…"
            />
            <Select className="input-sm w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="All actions" options={actions.map((a) => ({ value: a, label: a }))} />
            <Select className="input-sm w-auto" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} placeholder="All entities" options={entities.map((e2) => ({ value: e2, label: `${ENTITY_ICON[e2] || '🔖'} ${titleCase(e2)}` }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'var(--border)' }}>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-mute">
              From <Input type="date" className="input-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-mute">
              To <Input type="date" className="input-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </label>
            {(action || entity || q || from || to) && (
              <Button size="sm" variant="ghost" icon="x" onClick={() => { setAction(''); setEntity(''); setQ(''); setFrom(''); setTo(''); setPage(1); }}>
                Clear
              </Button>
            )}
            <span className="ml-auto text-[11px] text-mute">
              {total} entries · page {page}/{pages}
            </span>
          </div>

          {loading ? (
            <div className="p-4"><SkeletonRows rows={8} /></div>
          ) : rows.length ? (
            <>
              <div className="divide-line">
                {rows.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm" style={{ background: 'var(--bg-soft)' }}>
                      {ENTITY_ICON[log.entity] || '🔖'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold">{log.action}</span>
                        <Badge tone={SEVERITY_TONE[log.severity] || 'slate'} size="sm">{log.severity}</Badge>
                        <span className="text-[10px] font-mono text-mute">#{log.entity_id ?? '—'}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-soft">{log.summary}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-mute">
                        <span className="font-bold">{log.actor_name}</span>
                        <span>·</span>
                        <span>{fmtDateTime(log.created_at)}</span>
                        {log.ip && <><span>·</span><span className="font-mono">{log.ip}</span></>}
                      </div>
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <div className="mt-1 truncate font-mono text-[10px] text-mute">{JSON.stringify(log.meta).slice(0, 140)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t p-3" style={{ borderColor: 'var(--border)' }}>
                <Button size="sm" variant="outline" icon="chevronLeft" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="text-[11px] font-bold text-mute">Page {page} of {pages}</span>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next<Icon name="chevronRight" size={14} /></Button>
              </div>
            </>
          ) : (
            <div className="p-4">
              <EmptyState icon="history" title="No audit entries match" message="Adjust the filters or widen the date range." />
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 font-bold">Severity mix</div>
            {severity.length ? (
              <Donut
                size={150}
                data={severity.map((s) => ({
                  label: titleCase(s.severity),
                  value: s.count,
                  color: s.severity === 'critical' ? '#f43f5e' : s.severity === 'warning' ? '#f59e0b' : '#94a3b8'
                }))}
                center={<div className="text-center"><div className="text-lg font-black">{total}</div><div className="text-[9px] font-bold text-mute">entries</div></div>}
              />
            ) : (
              <p className="text-xs text-mute">No data yet.</p>
            )}
          </Card>

          <Card padded={false}>
            <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-bold">Most active entities</div>
            </div>
            <div className="divide-line">
              {(stats.byEntity || []).map((e) => (
                <button key={e.entity} type="button" onClick={() => { setEntity(e.entity); setPage(1); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-xs transition hover:bg-[var(--bg-soft)]">
                  <span className="font-bold">{ENTITY_ICON[e.entity] || '🔖'} {titleCase(e.entity)}</span>
                  <span className="text-mute">{e.count}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card padded={false}>
            <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-bold">Top actions</div>
            </div>
            <div className="divide-line">
              {(stats.recent || []).map((a) => (
                <button key={a.action} type="button" onClick={() => { setAction(a.action); setPage(1); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-xs transition hover:bg-[var(--bg-soft)]">
                  <span className="truncate font-mono font-bold">{a.action}</span>
                  <span className="shrink-0 text-mute">{a.count}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
