import React, { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useDebounced, useResource } from '../lib/hooks.js';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, PageHeader, SearchInput, Segmented, SkeletonRows, StatusBadge
} from '../ui/index.jsx';
import { titleCase } from '../lib/format.js';

function OrgNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)]"
        style={{ paddingLeft: `${10 + depth * 16}px` }}
      >
        {node.reports?.length ? (
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} className="shrink-0 text-mute rtl:-rotate-90" />
        ) : (
          <span className="w-[15px]" />
        )}
        <Avatar person={node} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{node.full_name}</span>
          <span className="block truncate text-[11px] text-mute">{node.designation} · {node.department}</span>
        </span>
        <Badge tone="slate">{node.role_label}</Badge>
        {node.reports?.length > 0 && <span className="text-[10px] font-bold text-mute">{node.reports.length}</span>}
      </button>
      {open && node.reports?.map((r) => <OrgNode key={r.id} node={r} depth={depth + 1} />)}
    </div>
  );
}

export default function Directory() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('list');
  const debounced = useDebounced(search, 250);
  const { data: directory, loading } = useResource(() => api.get(`/api/directory${debounced ? `?search=${encodeURIComponent(debounced)}` : ''}`), [debounced]);
  const { data: org } = useResource(() => api.get('/api/org-tree'), []);

  const grouped = directory?.grouped || {};
  const groups = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="page">
      <PageHeader
        icon="sitemap"
        title="Team directory"
        subtitle={`${directory?.people?.length ?? 0} people · ${groups.length} departments`}
        actions={
          <Segmented
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'list', label: 'List', icon: '☰' },
              { value: 'org', label: 'Org chart', icon: '🌳' }
            ]}
          />
        }
      />

      <SearchInput className="mb-4" value={search} onChange={setSearch} placeholder="Search by name, designation or email…" />

      {view === 'org' ? (
        <Card padded={false}>
          {org?.tree?.length ? (
            <div className="p-2">
              {org.tree.map((n) => (
                <OrgNode key={n.id} node={n} />
              ))}
            </div>
          ) : (
            <div className="p-4"><EmptyState compact icon="sitemap" title="Loading org chart…" /></div>
          )}
        </Card>
      ) : loading ? (
        <SkeletonRows rows={8} />
      ) : groups.length ? (
        <div className="space-y-4">
          {groups.map(([dept, people]) => (
            <Card key={dept} padded={false}>
              <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold">{dept}</h3>
                <Badge tone="slate">{people.length}</Badge>
              </div>
              <div className="divide-line">
                {people.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar person={p} size={38} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (window.location.hash = `/employees/${p.id}`)}>
                      <span className="block truncate text-sm font-bold">{p.full_name}</span>
                      <span className="block truncate text-[11px] text-mute">{p.designation} · {p.role_label}</span>
                    </button>
                    <a className="icon-btn" href={`tel:${p.phone}`} aria-label={`Call ${p.full_name}`}><Icon name="phone" size={16} /></a>
                    <a className="icon-btn" href={`mailto:${p.email}`} aria-label={`Email ${p.full_name}`}><Icon name="mail" size={16} /></a>
                    <button type="button" className="icon-btn" onClick={() => (window.location.hash = `/employees/${p.id}`)} aria-label="Open profile">
                      <Icon name="chevronRight" size={16} className="rtl:rotate-180" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon="search" title="No people found" message={`Nothing matches “${search}”.`} action={<Button onClick={() => setSearch('')}>Clear search</Button>} />
      )}
    </div>
  );
}
