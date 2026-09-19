import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { Avatar, Button, Input, Modal, Textarea } from '../ui/index.jsx';

const VALUES = ['Teamwork', 'Ownership', 'Customer First', 'Innovation', 'Integrity', 'Speed', 'Mentorship', 'Excellence'];
const POINTS = [5, 10, 15, 20];

/**
 * Give-kudos dialog. Pass `person` to preselect the recipient (employee profile);
 * leave it out and the modal offers a debounced people search instead.
 */
export default function KudoModal({ open, onClose, onDone, person = null }) {
  const { employee: me, toast } = useStore();
  const [target, setTarget] = useState(person);
  const [value, setValue] = useState(VALUES[0]);
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState(10);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (open) {
      setTarget(person);
      setMessage('');
      setValue(VALUES[0]);
      setPoints(10);
      setQuery('');
      setResults([]);
    }
  }, [open, person]);

  useEffect(() => {
    if (target || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api
        .get(`/api/directory?search=${encodeURIComponent(query.trim())}`)
        .then((r) => setResults((r.people || []).filter((p) => p.id !== me?.id)))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, target, me?.id]);

  const send = async () => {
    if (!target) {
      toast('Choose who to recognise', 'warn');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/kudos', { to_employee_id: target.id, value, message, points });
      toast(`Kudos sent to ${target.first_name} 🌟`, 'success');
      onDone?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? `Recognise ${target.first_name}` : 'Give kudos'}
      subtitle="Kudos feed the social wall and the star-workers leaderboard"
      icon="star"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="sparkles" loading={busy} disabled={!target} onClick={send}>
            Send kudos
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {target ? (
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: 'var(--bg-soft)' }}>
            <Avatar person={target} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{target.full_name || `${target.first_name} ${target.last_name || ''}`}</div>
              <div className="truncate text-[11px] text-mute">{target.designation || target.department || ''}</div>
            </div>
            {!person && (
              <button type="button" className="text-xs font-bold text-mute hover:text-soft" onClick={() => setTarget(null)}>
                Change
              </button>
            )}
          </div>
        ) : (
          <div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a teammate to recognise…" />
            {results.length > 0 && (
              <div className="mt-2 divide-line">
                {results.slice(0, 6).map((p) => (
                  <button key={p.id} type="button" onClick={() => setTarget(p)} className="flex w-full items-center gap-2.5 px-2 py-2 text-left transition hover:bg-[var(--bg-soft)]">
                    <Avatar person={p} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{p.full_name}</div>
                      <div className="truncate text-[11px] text-mute">{p.designation} · {p.department || '—'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <span className="label">Value to recognise</span>
          <div className="flex flex-wrap gap-1.5">
            {VALUES.map((v) => (
              <button key={v} type="button" onClick={() => setValue(v)} className={`chip ${value === v ? 'chip-active' : ''}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="label">Message</span>
          <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What did they do that deserves recognition?" />
        </label>

        <div>
          <span className="label">Points</span>
          <div className="flex gap-1.5">
            {POINTS.map((p) => (
              <button key={p} type="button" onClick={() => setPoints(p)} className={`chip ${points === p ? 'chip-active' : ''}`}>
                {p} pts
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
