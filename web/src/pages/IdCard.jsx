import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useHashRoute } from '../lib/hooks.js';
import { Avatar, Button, Card, EmptyState, Icon, Input, PageHeader, SkeletonRows } from '../ui/index.jsx';
import { fmtDate } from '../lib/format.js';

/** Deterministic pseudo-barcode for the printed strip. */
function Barcode({ value }) {
  const bars = useMemo(() => {
    const out = [];
    let seed = 7;
    for (let i = 0; i < value.length; i += 1) seed = (seed * 31 + value.charCodeAt(i)) % 9973;
    for (let i = 0; i < 52; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      out.push(1 + (seed % 3));
    }
    return out;
  }, [value]);
  return (
    <div className="flex h-8 items-stretch gap-[2px]" aria-hidden="true">
      {bars.map((w, i) => (
        <span key={i} style={{ width: w, background: i % 2 ? 'transparent' : '#fff' }} />
      ))}
    </div>
  );
}

/** Deterministic pseudo-QR with three finder squares. */
function QRBlock({ value }) {
  const cells = useMemo(() => {
    let seed = 13;
    for (let i = 0; i < value.length; i += 1) seed = (seed * 33 + value.charCodeAt(i)) % 65521;
    const grid = [];
    for (let y = 0; y < 11; y += 1) {
      const row = [];
      for (let x = 0; x < 11; x += 1) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        row.push(seed % 2 === 0);
      }
      grid.push(row);
    }
    const finder = (ox, oy) => {
      for (let y = 0; y < 3; y += 1) {
        for (let x = 0; x < 3; x += 1) {
          const edge = x === 0 || x === 2 || y === 0 || y === 2;
          grid[oy + y][ox + x] = edge ? true : x === 1 && y === 1;
        }
      }
    };
    finder(0, 0);
    finder(8, 0);
    finder(0, 8);
    return grid;
  }, [value]);
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(11, 1fr)', width: 88 }} aria-hidden="true">
      {cells.flat().map((on, i) => (
        <span key={i} className="aspect-square rounded-[1px]" style={{ background: on ? '#fff' : 'transparent' }} />
      ))}
    </div>
  );
}

function CardFace({ p, company, flipped, onFlip }) {
  const bg = flipped
    ? 'linear-gradient(140deg,#0b1220 0%,#1f2937 60%,#312e81 100%)'
    : 'linear-gradient(140deg,var(--brand) 0%,#4338ca 60%,#7c3aed 100%)';
  return (
    <div
      className="relative overflow-hidden rounded-3xl text-white shadow-xl"
      style={{ background: bg, aspectRatio: '1.62 / 1', width: '100%' }}
    >
      <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full" style={{ background: 'rgba(255,255,255,.14)' }} />
      <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full" style={{ background: 'rgba(255,255,255,.10)' }} />

      <div className="relative flex h-full flex-col p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] opacity-85">
              {company?.logo_emoji ? `${company.logo_emoji} ` : ''}{company?.name || 'NorthPeak'}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">Employee identity card</div>
          </div>
          <button type="button" onClick={onFlip} className="rounded-lg p-1.5 transition hover:bg-white/15" aria-label="Flip card">
            <Icon name="refresh" size={15} />
          </button>
        </div>

        {!flipped ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-2xl bg-white/20 p-1">
                <Avatar person={p} size={64} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-black leading-tight">{p.full_name}</div>
                <div className="truncate text-[12px] font-bold opacity-90">{p.designation}</div>
                <div className="truncate text-[11px] opacity-70">
                  {p.department}
                  {p.location ? ` · ${p.location}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <div className="grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-wide opacity-70">
                <div>
                  <div className="opacity-60">Employee ID</div>
                  <div className="text-[11px] font-black normal-case text-white">{p.emp_code}</div>
                </div>
                <div>
                  <div className="opacity-60">Role</div>
                  <div className="text-[11px] font-black normal-case text-white">{p.role_label}</div>
                </div>
                <div>
                  <div className="opacity-60">Work mode</div>
                  <div className="text-[11px] font-black normal-case text-white">{p.work_mode || 'onsite'}</div>
                </div>
              </div>
              <div className="mt-2">
                <Barcode value={p.emp_code} />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3 flex flex-1 flex-col justify-between">
            <div className="space-y-1 text-[10px] leading-snug">
              <div>
                <span className="opacity-60">Emergency: </span>
                <span className="font-bold">{p.emergency_contact || '—'}{p.emergency_phone ? ` · ${p.emergency_phone}` : ''}</span>
              </div>
              <div>
                <span className="opacity-60">Work location: </span>
                <span className="font-bold">{p.location || '—'}{p.city ? `, ${p.city}` : ''}</span>
              </div>
              <div>
                <span className="opacity-60">Email: </span>
                <span className="font-bold">{p.email}</span>
              </div>
              <div>
                <span className="opacity-60">Phone: </span>
                <span className="font-bold">{p.phone || '—'}</span>
              </div>
              <div>
                <span className="opacity-60">Joined: </span>
                <span className="font-bold">{p.join_date ? fmtDate(p.join_date) : '—'}</span>
              </div>
              <p className="pt-1 text-[8px] leading-tight opacity-70">
                This card remains the property of {company?.name || 'the company'}. If found, please return it to the address on
                file. Unauthorised use is prohibited and access is audited.
              </p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[8px] font-bold uppercase tracking-widest opacity-60">Scan to verify</div>
                <div className="text-[9px] font-black">{p.emp_code}</div>
              </div>
              <div className="rounded-lg bg-white/15 p-1">
                <QRBlock value={p.emp_code} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IdCard() {
  const { employee: me, company, toast } = useStore();
  const { params } = useHashRoute();
  const id = params.id || me?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setLoading(true);
    api
      .get(`/api/employees/${id}`)
      .then((d) => alive && setData(d))
      .catch((err) => alive && toast(err.message, 'error'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setPeople([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api
        .get(`/api/directory?search=${encodeURIComponent(query.trim())}`)
        .then((r) => setPeople(r.people || []))
        .catch(() => setPeople([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const p = data?.employee;

  return (
    <div className="page">
      <PageHeader icon="idCard" title="Digital ID card" subtitle="Tap the card to flip · print or share for access control" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_1fr]">
        <div className="mx-auto w-full max-w-[460px]">
          {loading ? (
            <Card className="grid h-64 place-items-center"><SkeletonRows rows={3} className="w-full" /></Card>
          ) : p ? (
            <CardFace p={p} company={company} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          ) : (
            <Card>
              <EmptyState icon="idCard" title="Card unavailable" message="This employee record could not be loaded." />
            </Card>
          )}

          {p && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button icon="printer" onClick={() => window.print()}>Print</Button>
              <Button
                icon="copy"
                onClick={() => {
                  navigator.clipboard?.writeText(`${p.full_name} · ${p.emp_code} · ${p.designation}`);
                  toast('Card details copied', 'success');
                }}
              >
                Copy details
              </Button>
              <Button icon="refresh" onClick={() => setFlipped(false)}>{flipped ? 'Show front' : 'Show back'}</Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Icon name="search" size={16} className="text-mute" />
              <span className="font-bold">Look up another employee</span>
            </div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, code or department…" />
            {people.length > 0 && (
              <div className="mt-2 divide-line">
                {people.slice(0, 8).map((row) => (
                  <a key={row.id} href={`#/id-card/${row.id}`} className="flex items-center gap-2.5 px-2 py-2 transition hover:bg-[var(--bg-soft)]">
                    <Avatar person={row} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{row.full_name}</div>
                      <div className="truncate text-[11px] text-mute">{row.emp_code} · {row.designation}</div>
                    </div>
                    <Icon name="chevronRight" size={15} className="text-mute" />
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-2 font-bold">Card details</div>
            {p ? (
              <div className="space-y-2 text-sm">
                {[
                  ['Name', p.full_name],
                  ['Employee code', p.emp_code],
                  ['Designation', p.designation],
                  ['Department', p.department],
                  ['Location', p.location ? `${p.location}${p.city ? `, ${p.city}` : ''}` : null],
                  ['Employment type', p.employment_type],
                  ['Joined', p.join_date ? fmtDate(p.join_date) : null],
                  ['Emergency contact', p.emergency_contact ? `${p.emergency_contact}${p.emergency_phone ? ` · ${p.emergency_phone}` : ''}` : null]
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b pb-2 last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <span className="shrink-0 text-mute">{k}</span>
                    <span className="truncate text-right font-semibold">{v || '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <SkeletonRows rows={5} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
