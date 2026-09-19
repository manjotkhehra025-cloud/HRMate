import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Avatar, Badge, Icon, IconButton, Spinner } from '../ui/index.jsx';
import { relative } from '../lib/format.js';
import CommandPalette from './CommandPalette.jsx';

export const NAV = [
  {
    key: 'workspace',
    label: 'Workspace',
    items: [
      { to: '/dashboard', icon: 'home', labelKey: 'nav.home', label: 'Dashboard' },
      { to: '/attendance', icon: 'clock', labelKey: 'nav.attendance', label: 'Attendance' },
      { to: '/approvals', icon: 'checkCircle', labelKey: 'nav.approvals', label: 'Approvals', perm: 'approval.view_own' },
      { to: '/calendar', icon: 'calendar', labelKey: 'nav.calendar', label: 'Calendar' }
    ]
  },
  {
    key: 'people',
    label: 'People',
    items: [
      { to: '/employees', icon: 'users', labelKey: 'nav.employees', label: 'Employees' },
      { to: '/directory', icon: 'sitemap', labelKey: 'nav.directory', label: 'Team directory' }
    ]
  },
  {
    key: 'workforce',
    label: 'Workforce',
    items: [
      { to: '/roster', icon: 'grid', labelKey: 'nav.roster', label: 'Shift roster' },
      { to: '/shifts', icon: 'layers', labelKey: 'nav.shifts', label: 'Shifts' },
      { to: '/leaves', icon: 'calendarCheck', labelKey: 'nav.leaves', label: 'Leaves' }
    ]
  },
  {
    key: 'records',
    label: 'My records',
    items: [
      { to: '/profile', icon: 'user', labelKey: 'nav.profile', label: 'My profile' },
      { to: '/id-card', icon: 'idCard', labelKey: 'nav.idcard', label: 'Digital ID card' },
      { to: '/documents', icon: 'document', labelKey: 'nav.documents', label: 'Documents' },
      { to: '/kyc', icon: 'shield', labelKey: 'nav.kyc', label: 'KYC verification' }
    ]
  },
  {
    key: 'performance',
    label: 'Performance',
    items: [
      { to: '/goals', icon: 'target', labelKey: 'nav.goals', label: 'KRA & goals' },
      { to: '/performance', icon: 'trending', labelKey: 'nav.reviews', label: 'Reviews' }
    ]
  },
  {
    key: 'engage',
    label: 'Engagement',
    items: [
      { to: '/social', icon: 'heart', labelKey: 'nav.social', label: 'Social wall' },
      { to: '/star-workers', icon: 'star', labelKey: 'nav.star', label: 'Star workers' },
      { to: '/helpdesk', icon: 'ticket', labelKey: 'nav.helpdesk', label: 'Helpdesk' },
      { to: '/announcements', icon: 'megaphone', labelKey: 'nav.announcements', label: 'Announcements' }
    ]
  },
  {
    key: 'insights',
    label: 'Insights',
    items: [{ to: '/reports', icon: 'chart', labelKey: 'nav.reports', label: 'Reports', anyPerm: ['report.team', 'report.company'] }]
  },
  {
    key: 'admin',
    label: 'Administration',
    items: [
      { to: '/admin', icon: 'settings', labelKey: 'nav.adminpanel', label: 'Admin panel', anyPerm: ['admin.settings', 'admin.departments', 'admin.locations', 'admin.roles'] },
      { to: '/devices', icon: 'device', labelKey: 'nav.devices', label: 'Devices' },
      { to: '/audit', icon: 'history', labelKey: 'nav.audit', label: 'Audit logs', perm: 'audit.view' }
    ]
  }
];

export const BOTTOM_NAV = [
  { to: '/dashboard', icon: 'home', labelKey: 'nav.home', label: 'Home' },
  { to: '/attendance', icon: 'clock', labelKey: 'nav.attendance', label: 'Punch' },
  { to: '/approvals', icon: 'checkCircle', labelKey: 'nav.approvals', label: 'Approvals', badgeKey: 'approvals' },
  { to: '/social', icon: 'heart', labelKey: 'nav.social', label: 'Social' },
  { to: '/more', icon: 'grid', label: 'More' }
];

function NavList({ route, onNavigate, badges }) {
  const { t, can } = useStore();
  return (
    <nav className="space-y-5 px-3">
      {NAV.map((group) => {
        const items = group.items.filter((i) => (i.perm ? can(i.perm) : i.anyPerm ? i.anyPerm.some(can) : true));
        if (!items.length) return null;
        return (
          <div key={group.key}>
            <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-mute">{t(`nav.${group.key}`) !== `nav.${group.key}` ? t(`nav.${group.key}`) : group.label}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = route === item.to || (item.to !== '/dashboard' && route.startsWith(`${item.to}/`));
                const badge = badges?.[item.to];
                return (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.to)}
                      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        active ? 'text-white shadow-sm' : 'text-soft hover:bg-[var(--bg-soft)] hover:text-[var(--text)]'
                      }`}
                      style={active ? { background: 'var(--brand)' } : undefined}
                    >
                      <Icon name={item.icon} size={17} className={active ? 'opacity-90' : 'text-mute group-hover:text-[var(--text-soft)]'} />
                      <span className="flex-1 truncate text-left">{t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.label}</span>
                      {badge > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                            active ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'
                          }`}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserCard({ onNavigate }) {
  const { employee, company, logout, resolvedTheme, setTheme, t } = useStore();
  const [menu, setMenu] = useState(false);
  if (!employee) return null;
  return (
    <div className="relative border-t p-3" style={{ borderColor: 'var(--border)' }}>
      {menu && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
          <div className="absolute bottom-16 left-3 right-3 z-20 overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-pop animate-pop-in" style={{ borderColor: 'var(--border)' }}>
            <button type="button" className="flex w-full items-center gap-2.5 px-3.5 py-3 text-sm font-semibold hover:bg-[var(--surface-2)]" onClick={() => { setMenu(false); onNavigate('/settings'); }}>
              <Icon name="settings" size={16} className="text-mute" /> {t('nav.settings')}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-3.5 py-3 text-sm font-semibold hover:bg-[var(--surface-2)]"
              onClick={() => { setMenu(false); setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'); }}
            >
              <Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'} size={16} className="text-mute" />
              {resolvedTheme === 'dark' ? t('settings.light') : t('settings.dark')}
            </button>
            <button type="button" className="flex w-full items-center gap-2.5 px-3.5 py-3 text-sm font-semibold text-rose-500 hover:bg-[var(--surface-2)]" onClick={() => { setMenu(false); logout(); }}>
              <Icon name="logout" size={16} /> {t('nav.logout')}
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={() => setMenu((v) => !v)} className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-[var(--bg-soft)]">
        <Avatar person={employee} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{employee.full_name}</span>
          <span className="block truncate text-[11px] text-mute">{employee.role_label} · {company?.name}</span>
        </span>
        <Icon name="more" size={16} className="text-mute" />
      </button>
    </div>
  );
}

function MoreSheet({ open, onClose, route, badges }) {
  const { t, can } = useStore();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border bg-[var(--surface)] pb-6 shadow-pop animate-sheet-up" style={{ borderColor: 'var(--border)' }}>
        <div className="sticky top-0 flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h3 className="text-base font-bold">All modules</h3>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {NAV.flatMap((g) => g.items)
            .filter((i) => (i.perm ? can(i.perm) : i.anyPerm ? i.anyPerm.some(can) : true))
            .map((item) => {
              const active = route === item.to;
              const badge = badges?.[item.to];
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => { window.location.hash = item.to; onClose(); }}
                  className={`relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition active:scale-[.98] ${active ? '' : 'hover:bg-[var(--surface-2)]'}`}
                  style={{ borderColor: active ? 'var(--brand)' : 'var(--border)', background: active ? 'var(--brand-soft)' : 'var(--surface)' }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    <Icon name={item.icon} size={17} />
                  </span>
                  <span className="text-xs font-bold leading-tight">{t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.label}</span>
                  {badge > 0 && <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">{badge}</span>}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children, route }) {
  const { employee, company, unread, t, notifications } = useStore();
  const [drawer, setDrawer] = useState(false);
  const [more, setMore] = useState(false);
  const [palette, setPalette] = useState(false);
  const [approvals, setApprovals] = useState(0);

  const navigate = (to) => {
    window.location.hash = to;
    setDrawer(false);
  };

  // light badge polling for approvals
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/approvals?scope=inbox&status=pending&limit=1', {
          headers: { Authorization: `Bearer ${localStorage.getItem('hrmate.token')}` }
        });
        const data = await res.json();
        if (alive) setApprovals(data?.counts?.inbox || 0);
      } catch {
        /* offline */
      }
    };
    load();
    const id = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [route, notifications.length]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (route === '/more') setMore(true);
  }, [route]);

  const badges = { '/approvals': approvals, '/notifications': unread };

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r bg-[var(--bg-elev)] lg:flex rtl:left-auto rtl:right-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl text-xl text-white shadow-glow" style={{ background: 'linear-gradient(140deg,#3563f6,#8b5cf6)' }}>
            {company?.logo_emoji || '⛰️'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-tight">{company?.name || 'HRMate'}</p>
            <p className="truncate text-[11px] text-mute">{t('app.tagline')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPalette(true)}
          className="mx-3 mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs text-mute transition hover:bg-[var(--bg-soft)]"
          style={{ borderColor: 'var(--border)' }}
        >
          <Icon name="search" size={15} />
          <span className="flex-1">Search or jump to…</span>
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-bold" style={{ borderColor: 'var(--border-strong)' }}>⌘K</kbd>
        </button>

        <div className="flex-1 overflow-y-auto pb-4">
          <NavList route={route} onNavigate={navigate} badges={badges} />
        </div>
        <UserCard onNavigate={navigate} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-[286px] flex-col border-r bg-[var(--bg-elev)] shadow-pop animate-fade-up rtl:left-auto rtl:right-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5 border-b px-4 py-3.5" style={{ borderColor: 'var(--border)' }}>
              <span className="grid h-9 w-9 place-items-center rounded-xl text-lg text-white" style={{ background: 'linear-gradient(140deg,#3563f6,#8b5cf6)' }}>
                {company?.logo_emoji || '⛰️'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{company?.name || 'HRMate'}</p>
                <p className="truncate text-[11px] text-mute">{employee?.role_label}</p>
              </div>
              <IconButton icon="x" label="Close" onClick={() => setDrawer(false)} />
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavList route={route} onNavigate={navigate} badges={badges} />
            </div>
            <UserCard onNavigate={navigate} />
          </aside>
        </div>
      )}

      {/* top bar */}
      <header
        className="sticky top-0 z-30 border-b bg-[var(--bg)]/85 backdrop-blur-lg lg:hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <IconButton icon="menu" label="Open navigation" onClick={() => setDrawer(true)} />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base text-white" style={{ background: 'linear-gradient(140deg,#3563f6,#8b5cf6)' }}>
              {company?.logo_emoji || '⛰️'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight">{company?.name || 'HRMate'}</p>
              <p className="truncate text-[10px] text-mute leading-tight">{employee?.department_name || employee?.role_label}</p>
            </div>
          </div>
          <IconButton icon="search" label="Search" onClick={() => setPalette(true)} />
          <button type="button" onClick={() => navigate('/notifications')} className="relative icon-btn">
            <Icon name={unread ? 'bellRing' : 'bell'} size={19} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button type="button" onClick={() => navigate('/profile')} className="shrink-0">
            <Avatar person={employee} size={32} ring />
          </button>
        </div>
      </header>

      {/* desktop top strip */}
      <div className="hidden lg:block lg:pl-[268px] rtl:lg:pl-0 rtl:lg:pr-[268px]">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-[var(--bg)]/85 px-7 py-2.5 backdrop-blur-lg" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-mute">
              {employee?.full_name} · {employee?.designation} · {employee?.department_name}
            </p>
          </div>
          <Badge tone="emerald" dot>
            {employee?.shift?.name || 'General'}
          </Badge>
          <button type="button" onClick={() => navigate('/notifications')} className="relative icon-btn">
            <Icon name={unread ? 'bellRing' : 'bell'} size={19} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button type="button" onClick={() => navigate('/profile')}>
            <Avatar person={employee} size={32} ring />
          </button>
        </div>
      </div>

      <main className="lg:pl-[268px] rtl:lg:pl-0 rtl:lg:pr-[268px]">{children}</main>

      {/* mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-[var(--bg-elev)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        <ul className="flex items-stretch">
          {BOTTOM_NAV.map((item) => {
            const active = item.to === '/more' ? more : route === item.to;
            const badge = item.to === '/approvals' ? approvals : item.to === '/more' ? unread : 0;
            return (
              <li key={item.to} className="flex-1">
                <button
                  type="button"
                  onClick={() => (item.to === '/more' ? setMore(true) : navigate(item.to))}
                  className={`relative flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition ${
                    active ? '' : 'text-mute'
                  }`}
                  style={active ? { color: 'var(--brand)' } : undefined}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.labelKey && t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.label}</span>
                  {badge > 0 && <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-rose-500" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <MoreSheet open={more} onClose={() => setMore(false)} route={route} badges={badges} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNavigate={navigate} />
    </div>
  );
}
