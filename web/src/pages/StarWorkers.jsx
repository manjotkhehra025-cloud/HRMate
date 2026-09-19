import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { Avatar, Badge, Button, Card, EmptyState, Icon, PageHeader, Progress, Ring, SkeletonRows, Stat } from '../ui/index.jsx';
import KudoModal from '../components/KudoModal.jsx';

const PERIODS = [
  { value: '30', label: 'Last 30 days', icon: '🗓️' },
  { value: '90', label: 'Last quarter', icon: '📆' },
  { value: '365', label: 'This year', icon: '🏆' }
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function StarWorkers() {
  const { employee: me, can, toast } = useStore();
  const [period, setPeriod] = useState('90');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kudoOpen, setKudoOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get(`/api/star-workers?period=${period}`)
      .then(setData)
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [period]);

  const board = data?.leaderboard || [];
  const badges = data?.badges || [];
  const departments = data?.departments || [];
  const myRank = data?.myRank;
  const topPoints = board[0]?.points || 1;
  const label = PERIODS.find((p) => p.value === period)?.label || '';

  return (
    <div className="page">
      <PageHeader
        icon="sparkles"
        title="Star workers"
        subtitle={`Peer recognition leaderboard · ${label}`}
        actions={
          <>
            {can('kudos.give') && (
              <Button variant="primary" icon="sparkles" onClick={() => setKudoOpen(true)}>
                Give kudos
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button key={p.value} type="button" onClick={() => setPeriod(p.value)} className={`chip ${period === p.value ? 'chip-active' : ''}`}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="sparkles" label="Recognised people" value={board.filter((b) => b.kudos_count > 0).length} tone="amber" />
        <Stat icon="star" label="Points awarded" value={board.reduce((a, b) => a + b.points, 0)} tone="violet" />
        <Stat icon="award" label="Badges earned" value={badges.reduce((a, b) => a + b.count, 0)} tone="emerald" />
        <Stat icon="trophy" label="Your rank" value={myRank ? `#${myRank.rank}` : '—'} hint={myRank ? `${myRank.points} pts · ${myRank.kudos} kudos` : 'No kudos yet'} tone="rose" />
      </div>

      {loading ? (
        <Card><SkeletonRows rows={8} /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            {board.slice(0, 3).length === 3 && (
              <div className="grid grid-cols-3 items-end gap-3">
                {[1, 0, 2].map((idx) => {
                  const p = board[idx];
                  if (!p) return <div key={idx} />;
                  const heights = [96, 128, 80];
                  return (
                    <a key={p.id} href={`#/employees/${p.id}`} className="flex flex-col items-center">
                      <Avatar person={p} size={idx === 0 ? 64 : 52} ring={idx === 0} />
                      <div className="mt-1.5 truncate text-xs font-bold">{p.first_name}</div>
                      <div className="text-[10px] text-mute">{p.points} pts</div>
                      <div
                        className="mt-1.5 w-full rounded-t-2xl text-center text-xl"
                        style={{
                          height: heights[idx],
                          background: idx === 0 ? 'linear-gradient(180deg,#fbbf24,#f59e0b)' : idx === 1 ? 'linear-gradient(180deg,#cbd5e1,#94a3b8)' : 'linear-gradient(180deg,#f0b27a,#cd7f32)'
                        }}
                      >
                        <span className="pt-2 block">{MEDALS[idx]}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}

            <Card padded={false}>
              <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="font-bold">🌟 Recognition leaderboard</div>
                <p className="text-[11px] text-mute">Ranked by kudos points received</p>
              </div>
              {board.length ? (
                <div className="divide-line">
                  {board.map((p) => (
                    <a
                      key={p.id}
                      href={`#/employees/${p.id}`}
                      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--bg-soft)] ${p.id === me?.id ? '' : ''}`}
                      style={p.id === me?.id ? { background: 'var(--brand-soft)' } : undefined}
                    >
                      <span className="w-7 shrink-0 text-center text-sm font-black text-mute">
                        {p.rank <= 3 ? MEDALS[p.rank - 1] : p.rank}
                      </span>
                      <Avatar person={p} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold">{p.full_name}</span>
                          {p.id === me?.id && <Badge tone="brand" size="sm">You</Badge>}
                        </div>
                        <div className="truncate text-[11px] text-mute">{p.designation}</div>
                        <Progress className="mt-1.5 max-w-[240px]" height={5} value={Math.round((p.points / topPoints) * 100)} tone="amber" />
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-base font-black text-amber-600">{p.points}</div>
                        <div className="text-[10px] font-bold text-mute">{p.kudos_count} kudos</div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <EmptyState icon="sparkles" title="No kudos yet" message="Recognition builds up as teammates celebrate each other." action={can('kudos.give') ? <Button variant="primary" icon="sparkles" onClick={() => setKudoOpen(true)}>Give the first kudos</Button> : null} />
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card padded={false}>
              <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="font-bold">🏅 Badge collection</div>
                <p className="text-[11px] text-mute">Special recognition badges earned</p>
              </div>
              {badges.length ? (
                <div className="divide-line">
                  {badges.map((b, i) => (
                    <div key={`${b.id}-${b.badge}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-lg">{b.badge.includes(' ') ? b.badge.split(' ')[0] : '🏅'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{b.full_name}</div>
                        <div className="truncate text-[11px] text-mute">{b.badge}</div>
                      </div>
                      <Badge tone="violet" size="sm">×{b.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4"><EmptyState icon="award" title="No badges yet" message="Badges are attached to kudos by the sender." compact /></div>
              )}
            </Card>

            <Card padded={false}>
              <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
                <div className="font-bold">🏢 Most recognised teams</div>
                <p className="text-[11px] text-mute">Kudos points by department</p>
              </div>
              {departments.length ? (
                <div className="space-y-2.5 p-4">
                  {departments.map((d) => (
                    <div key={d.name}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-bold">{d.name}</span>
                        <span className="text-mute">{d.points} pts · {d.count} kudos</span>
                      </div>
                      <Progress height={7} value={Math.round((d.points / (departments[0]?.points || 1)) * 100)} tone="emerald" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4"><EmptyState icon="building" title="No team data" message="Department stats appear once kudos are given." compact /></div>
              )}
            </Card>

            <Card className="flex items-center gap-3" >
              <Ring value={myRank ? Math.max(4, Math.round(100 - myRank.rank * 6)) : 0} size={78} tone="rose">
                <div className="text-center">
                  <div className="text-base font-black">#{myRank?.rank ?? '—'}</div>
                </div>
              </Ring>
              <div className="min-w-0">
                <div className="text-sm font-bold">Your standing</div>
                <p className="text-[11px] text-mute">
                  {myRank
                    ? `${myRank.kudos} kudos received · ${myRank.points} recognition points in ${label.toLowerCase()}.`
                    : 'You have not received kudos in this period yet.'}
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      <KudoModal open={kudoOpen} onClose={() => setKudoOpen(false)} onDone={load} />
    </div>
  );
}
