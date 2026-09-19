import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource, useLive } from '../lib/hooks.js';
import { Badge, Button, Card, EmptyState, Icon, PageHeader, SkeletonRows, Tabs, Toggle } from '../ui/index.jsx';
import { relative } from '../lib/format.js';

const TYPE_META = {
  leave: { icon: 'plane', tone: 'emerald', label: 'Leave' },
  approval: { icon: 'checkCircle', tone: 'brand', label: 'Approvals' },
  attendance: { icon: 'clock', tone: 'sky', label: 'Attendance' },
  shift: { icon: 'calendarCheck', tone: 'violet', label: 'Roster' },
  goal: { icon: 'target', tone: 'indigo', label: 'Goals' },
  document: { icon: 'document', tone: 'amber', label: 'Documents' },
  kyc: { icon: 'shield', tone: 'amber', label: 'KYC' },
  announcement: { icon: 'megaphone', tone: 'rose', label: 'Announcements' },
  social: { icon: 'heart', tone: 'rose', label: 'Social' },
  kudos: { icon: 'sparkles', tone: 'amber', label: 'Kudos' },
  ticket: { icon: 'lifebuoy', tone: 'sky', label: 'Helpdesk' },
  security: { icon: 'lock', tone: 'rose', label: 'Security' },
  profile: { icon: 'user', tone: 'slate', label: 'Profile' },
  welcome: { icon: 'sparkle', tone: 'brand', label: 'Welcome' }
};
const meta = (type) => TYPE_META[type] || { icon: 'bell', tone: 'slate', label: type };

export default function NotificationsPage() {
  const { markNotificationsRead, toast, employee } = useStore();
  const [type, setType] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [settings, setSettings] = useState(null);
  const bump = useLive();

  const { data, loading, reload } = useResource(
    () => api.get(`/api/notifications?limit=120${onlyUnread ? '&unread=1' : ''}`),
    [onlyUnread, bump]
  );

  useEffect(() => {
    api.get('/api/notifications/settings').then(setSettings).catch(() => setSettings(null));
  }, [employee?.id]);

  const rows = useMemo(() => (data?.rows || []).filter((n) => !type || n.type === type), [data, type]);
  const typeCounts = useMemo(() => {
    const m = new Map();
    for (const n of data?.rows || []) m.set(n.type, (m.get(n.type) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const markOne = async (id) => {
    await api.post('/api/notifications/read', { id });
    markNotificationsRead(id);
    reload({ silent: true });
  };

  const markAll = async () => {
    await api.post('/api/notifications/read', {});
    markNotificationsRead();
    reload({ silent: true });
    toast('All caught up', 'success');
  };

  const remove = async (n) => {
    try {
      await api.del(`/api/notifications/${n.id}`, {});
      reload({ silent: true });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const enablePush = async (want) => {
    if (want && 'Notification' in window && Notification.permission !== 'granted') {
      const res = await Notification.requestPermission();
      if (res !== 'granted') {
        toast('Browser blocked notifications — allow them in site settings', 'warn');
        return;
      }
    }
    try {
      await api.patch('/api/auth/preferences', { push_enabled: want });
      setSettings((s) => ({ ...(s || {}), pushEnabled: want }));
      toast(want ? 'Push notifications enabled' : 'Push notifications paused', want ? 'success' : 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="bell"
        title="Notifications"
        subtitle={`${data?.unread ?? 0} unread · delivered live over the event stream`}
        actions={
          <Button icon="check" onClick={markAll}>
            Mark all read
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        active={type}
        onChange={setType}
        tabs={[
          { key: '', label: 'All', count: (data?.rows || []).length },
          ...typeCounts.map(([k, c]) => ({ key: k, label: meta(k).label, count: c }))
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_290px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-mute">
              <input type="checkbox" className="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
              Unread only
            </label>
            <span className="text-[11px] text-mute">{rows.length} shown</span>
          </div>

          <Card padded={false}>
            {loading ? (
              <div className="p-4"><SkeletonRows rows={6} /></div>
            ) : rows.length ? (
              <div className="divide-line">
                {rows.map((n) => {
                  const m = meta(n.type);
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-3 py-3"
                      style={n.read ? undefined : { background: 'var(--brand-soft)' }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl soft">
                        {n.icon ? <span className="text-base">{n.icon}</span> : <Icon name={m.icon} size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{n.title}</span>
                          {!n.read && <Badge tone="brand" size="sm">New</Badge>}
                          {n.priority === 'high' && <Badge tone="rose" size="sm">Urgent</Badge>}
                        </div>
                        <p className="mt-0.5 text-[12px] text-soft">{n.body}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-mute">
                          <span className="uppercase tracking-wide">{m.label}</span>
                          <span>·</span>
                          <span>{relative(n.created_at)}</span>
                          {n.link && (
                            <a href={n.link} className="link">Open</a>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {!n.read && (
                          <Button size="sm" variant="ghost" icon="check" onClick={() => markOne(n.id)}>
                            Read
                          </Button>
                        )}
                        <button type="button" className="text-mute transition hover:text-rose-500" onClick={() => remove(n)} aria-label="Dismiss">
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState icon="bell" title="You're all caught up" message="New notifications arrive here in real time over the live event stream." />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Icon name="bell" size={16} className="text-mute" />
              <span className="font-bold">Push notifications</span>
            </div>
            <Toggle
              label="Browser push"
              description="Show desktop alerts the moment something lands"
              checked={!!settings?.pushEnabled}
              onChange={enablePush}
            />
            <p className="mt-2 rounded-xl p-3 text-[11px] text-mute" style={{ background: 'var(--bg-soft)' }}>
              HRMate streams events over server-sent events; granted browsers also raise a native notification.
            </p>
          </Card>

          <Card padded={false}>
            <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-bold">Topics</div>
              <p className="text-[11px] text-mute">What the platform notifies you about</p>
            </div>
            {settings?.channels ? (
              <div className="divide-line">
                {settings.channels.map((c) => (
                  <div key={c.key} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="text-base">{c.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{c.label}</span>
                    <Badge tone={c.enabled ? 'emerald' : 'slate'} size="sm">{c.enabled ? 'On' : 'Off'}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4"><SkeletonRows rows={4} /></div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
