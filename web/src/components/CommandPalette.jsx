import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { Avatar, Icon, Spinner } from '../ui/index.jsx';
import { useDebounced, useLockBody } from '../lib/hooks.js';
import { NAV } from './Layout.jsx';

export default function CommandPalette({ open, onClose, onNavigate }) {
  const { t, can, theme, setTheme, locale, setLocale, logout } = useStore();
  const [q, setQ] = useState('');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const debounced = useDebounced(q, 220);
  useLockBody(open);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!debounced || debounced.length < 2) {
      setPeople([]);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .get(`/api/directory?search=${encodeURIComponent(debounced)}`)
      .then((res) => alive && setPeople(res.people.slice(0, 6)))
      .catch(() => alive && setPeople([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced, open]);

  const commands = useMemo(() => {
    const navCommands = NAV.flatMap((g) =>
      g.items
        .filter((i) => (i.perm ? can(i.perm) : i.anyPerm ? i.anyPerm.some(can) : true))
        .map((i) => ({
          id: `nav:${i.to}`,
          type: 'Navigate',
          icon: i.icon,
          label: t(i.labelKey) !== i.labelKey ? t(i.labelKey) : i.label,
          group: g.label,
          run: () => onNavigate(i.to)
        }))
    );
    const actions = [
      { id: 'act:theme', type: 'Action', icon: theme === 'dark' ? 'sun' : 'moon', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', group: 'Preferences', run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      { id: 'act:lang', type: 'Action', icon: 'globe', label: `Language: ${locale.toUpperCase()} (cycle)`, group: 'Preferences', run: () => {
        const order = ['en', 'es', 'hi', 'fr', 'ar', 'de', 'pt'];
        setLocale(order[(order.indexOf(locale) + 1) % order.length]);
      } },
      { id: 'act:punch', type: 'Action', icon: 'clock', label: 'Go to punch in / out', group: 'Quick actions', run: () => onNavigate('/attendance') },
      { id: 'act:leave', type: 'Action', icon: 'calendarCheck', label: 'Apply for leave', group: 'Quick actions', run: () => onNavigate('/leaves') },
      { id: 'act:ticket', type: 'Action', icon: 'ticket', label: 'Raise a helpdesk ticket', group: 'Quick actions', run: () => onNavigate('/helpdesk') },
      { id: 'act:id', type: 'Action', icon: 'idCard', label: 'Show my digital ID card', group: 'Quick actions', run: () => onNavigate('/id-card') },
      { id: 'act:logout', type: 'Action', icon: 'logout', label: 'Sign out', group: 'Account', run: () => logout() }
    ];
    const all = [...navCommands, ...actions];
    if (!q) return all.slice(0, 12);
    const needle = q.toLowerCase();
    return all.filter((c) => c.label.toLowerCase().includes(needle) || c.type.toLowerCase().includes(needle)).slice(0, 10);
  }, [q, t, can, theme, locale, onNavigate, setTheme, setLocale, logout]);

  const results = useMemo(
    () => [
      ...commands.map((c) => ({ kind: 'command', ...c })),
      ...people.map((p) => ({ kind: 'person', id: `p:${p.id}`, label: p.full_name, sub: `${p.designation} · ${p.department}`, person: p, run: () => onNavigate(`/employees/${p.id}`) }))
    ],
    [commands, people, onNavigate]
  );

  useEffect(() => setCursor(0), [q]);

  if (!open) return null;

  const exec = (item) => {
    item.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[8vh]">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-pop animate-pop-in" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <Icon name="search" size={17} className="text-mute" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[cursor]) exec(results[cursor]);
              } else if (e.key === 'Escape') onClose();
            }}
            placeholder="Search modules, people, actions…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-bold text-mute" style={{ borderColor: 'var(--border-strong)' }}>ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && <div className="flex items-center gap-2 px-3 py-2 text-xs text-mute"><Spinner size={13} /> Searching people…</div>}
          {results.length === 0 && !loading && <p className="px-3 py-6 text-center text-xs text-mute">No matches for “{q}”</p>}
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => exec(r)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                i === cursor ? 'bg-[var(--brand-soft)]' : 'hover:bg-[var(--surface-2)]'
              }`}
            >
              {r.kind === 'person' ? (
                <Avatar person={r.person} size={30} />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-lg soft">
                  <Icon name={r.icon} size={15} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.label}</span>
                {r.sub && <span className="block truncate text-[11px] text-mute">{r.sub}</span>}
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-mute">{r.type || 'Person'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
