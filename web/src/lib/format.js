// Date / time / number helpers. All server timestamps are UTC ISO strings and
// are rendered as UTC so every device shows the same roster and punch times.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = (n) => String(n).padStart(2, '0');

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const startOfWeekISO = (iso, weekStart = 1) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const diff = (d.getUTCDay() - weekStart + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
};

export const rangeISO = (from, to) => {
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
};

export const weekdayShort = (iso) => DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const dayNum = (iso) => Number(iso.slice(8, 10));
export const monthKey = (iso) => iso.slice(0, 7);
/** `YYYY-MM` for a Date object *or* any ISO-ish string. */
export const fmtMonth = (d = new Date()) => (d instanceof Date ? d.toISOString().slice(0, 7) : String(d).slice(0, 7));
export const monthLabel = (key) => {
  const [y, m] = String(key).split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(iso);
  return `${dayNum(s)} ${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
};

export const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  return `${dayNum(s)} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
};

export const fmtWeekday = (iso) => {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  return `${DAYS[new Date(`${s}T00:00:00Z`).getUTCDay()]}, ${dayNum(s)} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
};

export const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

export const fmtTimeLabel = (hhmm) => hhmm || '—';

export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)} · ${fmtTime(iso)}` : '—');

export const relative = (iso) => {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
};

export const countdown = (iso) => {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `in ${days}d`;
};

export const minutesToHM = (mins) => {
  const m = Math.max(0, Math.round(mins || 0));
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};

export const minutesToHours = (mins) => Number(((mins || 0) / 60).toFixed(1));

export const currency = (n, code = 'INR') => {
  if (n === null || n === undefined) return '—';
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `${code} ${Number(n).toLocaleString()}`;
  }
};

export const compact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
};

export const pct = (n, digits = 0) => `${Number(n || 0).toFixed(digits)}%`;

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export const titleCase = (s = '') => String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const timeToMinutes = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

export const isSameDay = (a, b) => String(a).slice(0, 10) === String(b).slice(0, 10);

export const csvDownload = (filename, rows) => {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const TONES = {
  emerald: { bg: 'bg-emerald-500/12', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  sky: { bg: 'bg-sky-500/12', text: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
  violet: { bg: 'bg-violet-500/12', text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  orange: { bg: 'bg-orange-500/12', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  rose: { bg: 'bg-rose-500/12', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  slate: { bg: 'bg-slate-500/12', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  indigo: { bg: 'bg-indigo-500/12', text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500' },
  teal: { bg: 'bg-teal-500/12', text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500' }
};

export const toneOf = (key) => TONES[key] || TONES.slate;

export const STATUS_TONE = {
  present: 'emerald',
  late: 'amber',
  absent: 'rose',
  on_leave: 'sky',
  half_day: 'orange',
  wfh: 'violet',
  holiday: 'slate',
  week_off: 'slate',
  off: 'slate',
  missed_punch: 'rose',
  not_punched: 'amber',
  pending: 'amber',
  approved: 'emerald',
  rejected: 'rose',
  cancelled: 'slate',
  verified: 'emerald',
  flagged: 'rose',
  open: 'sky',
  in_progress: 'violet',
  escalated: 'rose',
  resolved: 'emerald',
  closed: 'slate',
  trusted: 'emerald',
  blocked: 'rose',
  revoked: 'slate',
  active: 'emerald',
  terminated: 'slate',
  on_track: 'emerald',
  ahead: 'sky',
  at_risk: 'amber',
  behind: 'rose',
  draft: 'slate',
  published: 'emerald',
  paid: 'emerald'
};

export const STATUS_LABEL = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  on_leave: 'On leave',
  half_day: 'Half day',
  wfh: 'Work from home',
  holiday: 'Holiday',
  week_off: 'Week off',
  off: 'Off',
  missed_punch: 'Missed punch',
  not_punched: 'Not punched',
  in_progress: 'In progress'
};
