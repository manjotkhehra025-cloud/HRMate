import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon, Icons } from './Icons.jsx';
import { initials, toneOf, STATUS_TONE, STATUS_LABEL } from '../lib/format.js';
import { useLockBody } from '../lib/hooks.js';
import { useStore as useGlobalStore } from '../lib/store.jsx';

/* ------------------------------------------------------------------ *
 * Avatar
 * ------------------------------------------------------------------ */
export function Avatar({ person, size = 40, ring = false, className = '', showStatus = false, status }) {
  const name = person?.full_name || person?.name || [person?.first_name, person?.last_name].filter(Boolean).join(' ') || '?';
  const color = person?.avatar_color || '#6366f1';
  const emoji = person?.avatar_emoji;
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white ${
        ring ? 'ring-2 ring-white/70 dark:ring-white/10' : ''
      } ${className}`}
      style={{ width: px, height: px, background: `linear-gradient(140deg, ${color}, ${color}bb)`, fontSize: `calc(${px} * 0.36)` }}
      title={name}
    >
      {emoji && size >= 34 ? <span style={{ fontSize: `calc(${px} * 0.5)` }}>{emoji}</span> : initials(name)}
      {showStatus && status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-ink-950 ${toneOf(
            STATUS_TONE[status] || 'slate'
          ).dot}`}
        />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Badges & chips
 * ------------------------------------------------------------------ */
export function Badge({ tone = 'slate', children, className = '', dot = false, icon }) {
  const t = toneOf(tone);
  return (
    <span className={`badge ${t.bg} ${t.text} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }) {
  const tone = STATUS_TONE[status] || 'slate';
  return (
    <Badge tone={tone} dot>
      {label || STATUS_LABEL[status] || String(status || '—').replace(/_/g, ' ')}
    </Badge>
  );
}

export function Chip({ active, children, onClick, icon, count }) {
  return (
    <button type="button" onClick={onClick} className={`chip ${active ? 'chip-active' : ''} ${onClick ? 'cursor-pointer' : ''}`}>
      {icon && <span className="text-sm">{icon}</span>}
      {children}
      {count !== undefined && <span className={`rounded px-1 text-[10px] ${active ? 'bg-white/25' : 'bg-black/5 dark:bg-white/10'}`}>{count}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */
export function Button({ variant = 'soft', size, icon, children, loading, className = '', ...rest }) {
  const cls = { primary: 'btn-primary', soft: 'btn-soft', outline: 'btn-outline', ghost: 'btn-ghost', danger: 'btn-danger' }[variant];
  return (
    <button type="button" className={`${cls} ${size === 'sm' ? 'btn-xs' : ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Spinner size={14} /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, size = 18, className = '', ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} className={`icon-btn ${className}`} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Spinner({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Layout atoms
 * ------------------------------------------------------------------ */
export function Card({ children, className = '', padded = true, ...rest }) {
  return (
    <section className={`card ${padded ? 'p-4' : ''} ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({ icon, title, subtitle, action, className = '' }) {
  return (
    <div className={`mb-3 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          {icon && <Icon name={icon} size={17} className="text-mute" />}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, icon, actions, back, children }) {
  const { navigate } = useRouterShim();
  return (
    <header className="mb-4">
      <div className="flex items-center gap-3">
        {back && (
          <IconButton icon="chevronLeft" label="Back" onClick={() => navigate(typeof back === 'string' ? back : -1)} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-xl font-extrabold tracking-tight">
            {icon && <Icon name={icon} size={20} className="text-mute" />}
            {title}
          </h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-mute">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/* ------------------------------------------------------------------ *
 * Stats
 * ------------------------------------------------------------------ */
export function Stat({ label, value, icon, tone = 'indigo', delta, hint, onClick, loading }) {
  const t = toneOf(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card group p-4 text-left transition ${onClick ? 'hover:-translate-y-0.5 hover:shadow-pop active:scale-[.99]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.bg} ${t.text}`}>
          <Icon name={icon} size={17} />
        </span>
        {delta !== undefined && (
          <span className={`text-[11px] font-bold ${Number(delta) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {Number(delta) >= 0 ? '▲' : '▼'} {Math.abs(Number(delta))}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="skeleton h-6 w-16" />
          <div className="skeleton h-3 w-24" />
        </div>
      ) : (
        <>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
          <div className="text-xs font-semibold text-mute">{label}</div>
          {hint && <div className="mt-1 text-[11px] text-mute">{hint}</div>}
        </>
      )}
    </button>
  );
}

export function Progress({ value = 0, tone = 'indigo', className = '', height = 8, label }) {
  const t = toneOf(tone);
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-mute">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div className="w-full overflow-hidden rounded-full soft" style={{ height }}>
        <div className={`h-full rounded-full ${t.dot} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export function Ring({ value = 0, size = 84, stroke = 9, tone = 'indigo', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = `var(--${tone === 'emerald' ? 'success' : tone === 'rose' ? 'danger' : 'brand'})`;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.min(100, Math.max(0, value)) / 100) * c}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Empty / loading / error states
 * ------------------------------------------------------------------ */
export function EmptyState({ icon = 'sparkle', title, message, action, className = '', compact = false }) {
  return (
    <div className={`grid place-items-center rounded-2xl border border-dashed px-6 text-center ${compact ? 'py-8' : 'py-14'} ${className}`} style={{ borderColor: 'var(--border-strong)' }}>
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl soft" style={{ color: 'var(--brand)' }}>
        <Icon name={icon} size={26} />
      </div>
      <h3 className="text-sm font-bold">{title || 'Nothing here yet'}</h3>
      {message && <p className="mt-1 max-w-sm text-xs text-mute">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-1/2" />
          </div>
          <div className="skeleton h-6 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className="skeleton h-9 w-9 rounded-xl" />
          <div className="skeleton h-6 w-16" />
          <div className="skeleton h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      icon="alert"
      title="We couldn't load this"
      message={error?.message || 'Unexpected error'}
      action={onRetry && <Button variant="primary" icon="refresh" onClick={onRetry}>Retry</Button>}
    />
  );
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="grid place-items-center gap-3 py-16 text-mute">
      <Spinner size={26} />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Form controls
 * ------------------------------------------------------------------ */
export function Field({ label, hint, error, children, className = '', required }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-mute">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-semibold text-rose-500">{error}</span>}
    </label>
  );
}

export function Input({ icon, className = '', ...rest }) {
  if (!icon) return <input className={`input ${className}`} {...rest} />;
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">
        <Icon name={icon} size={16} />
      </span>
      <input className={`input pl-9 ${className}`} {...rest} />
    </span>
  );
}

export function Textarea({ className = '', rows = 3, ...rest }) {
  return <textarea className={`input resize-y ${className}`} rows={rows} {...rest} />;
}

export function Select({ options = [], className = '', placeholder, ...rest }) {
  return (
    <select className={`input ${className}`} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        )
      )}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-semibold">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-mute">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50"
        style={{ background: checked ? 'var(--brand)' : 'var(--border-strong)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 22 : 2 }}
        />
      </button>
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '', size = 'md' }) {
  return (
    <div className={`inline-flex rounded-xl border p-1 ${className}`} style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg font-semibold transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              active ? 'text-white shadow-sm' : 'text-soft hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={active ? { background: 'var(--brand)' } : undefined}
          >
            {o.icon && <span className="mr-1">{o.icon}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`scroll-x no-scrollbar ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`relative shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
            active === t.key ? 'text-white' : 'text-soft hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={active === t.key ? { background: 'var(--brand)' } : undefined}
        >
          {t.icon && <span className="mr-1.5">{t.icon}</span>}
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${active === t.key ? 'bg-white/25' : 'soft'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <span className={`relative block ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">
        <Icon name="search" size={16} />
      </span>
      <input className="input pl-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-mute hover:bg-black/5">
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Overlays
 * ------------------------------------------------------------------ */
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', icon }) {
  useLockBody(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close overlay" className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm animate-[fade-up_.2s_ease-out]" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[92vh] w-full ${width} overflow-hidden rounded-t-3xl border bg-[var(--surface)] shadow-pop animate-sheet-up sm:rounded-3xl sm:animate-pop-in`}
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          {icon && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
              <Icon name={icon} size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-mute">{subtitle}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', tone = 'danger' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      icon="alert"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-soft">{message}</p>
    </Modal>
  );
}

export function Drawer({ open, onClose, title, children, side = 'right', width = 380 }) {
  useLockBody(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <aside
        className="absolute inset-y-0 flex w-full flex-col border-l bg-[var(--surface)] shadow-pop animate-sheet-up sm:animate-none"
        style={{ [side]: 0, maxWidth: width, borderColor: 'var(--border)', transform: 'translateX(0)' }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-bold">{title}</h3>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useGlobalStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => {
        const tone = { success: 'emerald', error: 'rose', info: 'indigo', warn: 'amber' }[t.tone] || 'indigo';
        const tm = toneOf(tone);
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border px-3.5 py-3 shadow-pop animate-fade-up`}
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${tm.bg} ${tm.text}`}>
              <Icon name={t.tone === 'error' ? 'alert' : t.tone === 'success' ? 'checkCircle' : 'info'} size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{t.message}</p>
              {t.action && (
                <button type="button" className="mt-1 text-xs font-bold" style={{ color: 'var(--brand)' }} onClick={() => { t.action.onClick(); dismissToast(t.id); }}>
                  {t.action.label}
                </button>
              )}
            </div>
            <IconButton icon="x" label="Dismiss" onClick={() => dismissToast(t.id)} className="h-6 w-6" />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Lists
 * ------------------------------------------------------------------ */
export function ListRow({ avatar, person, title, subtitle, right, meta, onClick, selected, className = '', dense }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 text-left transition ${dense ? 'py-2' : 'py-3'} ${
        onClick ? 'hover:bg-[var(--surface-2)] active:scale-[.995]' : ''
      } ${selected ? 'bg-[var(--brand-soft)]' : ''} ${className}`}
    >
      {avatar !== false && (person ? <Avatar person={person} size={dense ? 32 : 40} showStatus={!!person?.status && person?.today} status={person?.status} /> : null)}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-mute">{subtitle}</div>}
        {meta && <div className="mt-1 flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
      {onClick && <Icon name="chevronRight" size={16} className="shrink-0 text-mute rtl:rotate-180" />}
    </button>
  );
}

export function KeyValue({ items, columns = 2 }) {
  return (
    <dl className={`grid gap-x-4 gap-y-3 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-mute">{k}</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Divider({ label }) {
  if (!label) return <hr className="my-4" style={{ borderColor: 'var(--border)' }} />;
  return (
    <div className="my-4 flex items-center gap-3">
      <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
      <span className="text-[11px] font-bold uppercase tracking-wide text-mute">{label}</span>
      <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
    </div>
  );
}

export function DataTable({ columns, rows, onRowClick, empty, loading, rowKey = 'id' }) {
  if (loading) return <SkeletonRows rows={5} />;
  if (!rows?.length) return empty || <EmptyState icon="search" title="No records found" message="Try changing the filters or date range." />;
  return (
    <div className="table-wrap rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey] ?? Math.random()} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer' : ''}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Charts (dependency-free SVG)
 * ------------------------------------------------------------------ */
export function LineChart({ data, keys = [{ key: 'value', label: 'Value', color: 'var(--brand)' }], height = 180, xKey = 'label', loading, valueFormat = (v) => v }) {
  if (loading) return <div className="skeleton" style={{ height }} />;
  if (!data?.length) return <EmptyState compact icon="chart" title="No data" />;
  const w = 640;
  const h = height;
  const pad = { l: 34, r: 12, t: 14, b: 22 };
  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => Number(d[k.key]) || 0)));
  const stepX = (w - pad.l - pad.r) / Math.max(1, data.length - 1);
  const y = (v) => pad.t + (1 - (Number(v) || 0) / max) * (h - pad.t - pad.b);
  const path = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${(pad.l + i * stepX).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = (key) => `${path(key)} L${pad.l + (data.length - 1) * stepX},${h - pad.b} L${pad.l},${h - pad.b} Z`;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={pad.t + f * (h - pad.t - pad.b)} y2={pad.t + f * (h - pad.t - pad.b)} stroke="var(--border)" strokeWidth="1" />
            <text x={4} y={pad.t + f * (h - pad.t - pad.b) + 4} fontSize="10" fill="var(--text-mute)">
              {Math.round(max * (1 - f))}
            </text>
          </g>
        ))}
        {keys.map((k) => (
          <g key={k.key}>
            {k.fill !== false && <path d={area(k.key)} fill={k.color} opacity="0.1" />}
            <path d={path(k.key)} fill="none" stroke={k.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 7) === 0 ? (
            <text key={d[xKey] + i} x={pad.l + i * stepX} y={h - 6} fontSize="10" textAnchor="middle" fill="var(--text-mute)">
              {d[xKey]}
            </text>
          ) : null
        )}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {keys.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5 text-[11px] font-semibold text-mute">
            <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data, xKey = 'label', keys = [{ key: 'value', label: 'Value', color: 'var(--brand)' }], height = 190, horizontal, loading, valueFormat = (v) => v }) {
  if (loading) return <div className="skeleton" style={{ height }} />;
  if (!data?.length) return <EmptyState compact icon="chart" title="No data" />;
  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => Number(d[k.key]) || 0)));
  if (horizontal) {
    return (
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d[xKey]}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold">{d[xKey]}</span>
              <span className="text-mute">{valueFormat(keys.reduce((s, k) => s + (Number(d[k.key]) || 0), 0))}</span>
            </div>
            <div className="flex gap-1 overflow-hidden rounded-lg soft" style={{ height: 10 }}>
              {keys.map((k) => (
                <div
                  key={k.key}
                  className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${((Number(d[k.key]) || 0) / max) * 100}%`, background: k.color }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d) => (
          <div key={d[xKey]} className="group relative flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex w-full flex-col items-center gap-0.5" style={{ height: '100%', justifyContent: 'flex-end' }}>
              {keys.map((k) => (
                <div
                  key={k.key}
                  title={`${k.label}: ${valueFormat(d[k.key])}`}
                  className="w-full rounded-t-md transition-all duration-500 group-hover:opacity-80"
                  style={{ height: `${Math.max(2, ((Number(d[k.key]) || 0) / max) * 100)}%`, background: k.color }}
                />
              ))}
            </div>
            <span className="w-full truncate text-center text-[9px] font-semibold text-mute">{d[xKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Donut({ data, size = 168, thickness = 22, center, loading }) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (loading) return <div className="skeleton rounded-full" style={{ width: size, height: size }} />;
  if (!total) return <EmptyState compact icon="pie" title="No data" />;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness} />
          {data.map((d) => {
            const len = (Number(d.value) / total) * c;
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
      </div>
      <ul className="min-w-[140px] flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate font-semibold text-soft">{d.label}</span>
            <span className="font-bold">{d.value}</span>
            <span className="w-9 text-right text-mute">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ values = [], color = 'var(--brand)', height = 34, width = 100 }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Router shim — lets primitives navigate without prop drilling
 * ------------------------------------------------------------------ */
let navigateRef = () => {};
export const setRouterNavigate = (fn) => {
  navigateRef = fn;
};
export function useRouterShim() {
  return { navigate: (to) => (typeof to === 'number' ? window.history.go(to) : navigateRef(to)) };
}

export { Icon, Icons };
