import React, { useEffect, useState } from 'react';
import { api, compressImage } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useResource, useLive } from '../lib/hooks.js';
import KudoModal from '../components/KudoModal.jsx';
import {
  Avatar, Badge, Button, Card, EmptyState, Icon, Input, PageHeader, SkeletonRows, Stat, Textarea
} from '../ui/index.jsx';
import { relative } from '../lib/format.js';

const TAG_META = {
  general: { label: 'All', icon: '🗨️' },
  win: { label: 'Wins', icon: '🏆' },
  kudos: { label: 'Kudos', icon: '🌟' },
  help: { label: 'Help', icon: '🙋' },
  fun: { label: 'Fun', icon: '🎉' },
  update: { label: 'Updates', icon: '📣' }
};

function PostComposer({ onPost, defaultTag = 'general' }) {
  const { employee: me, toast } = useStore();
  const [body, setBody] = useState('');
  const [tag, setTag] = useState(defaultTag);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [kudoOpen, setKudoOpen] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const image_url = image ? await compressImage(image) : null;
      await api.post('/api/posts', { body, tag, image_url });
      setBody('');
      setImage(null);
      toast('Posted to the wall', 'success');
      onPost?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-4">
      <div className="flex items-start gap-3">
        <Avatar person={me} size={40} />
        <div className="min-w-0 flex-1">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`What's happening, ${me?.first_name || ''}? Share an update with the team…`}
          />
          {image && (
            <div className="mt-2 flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold" style={{ background: 'var(--bg-soft)' }}>
              <Icon name="clip" size={14} /> {image.name}
              <button type="button" className="ml-auto text-mute hover:text-soft" onClick={() => setImage(null)}>
                <Icon name="x" size={13} />
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <label className="btn-soft btn-xs cursor-pointer">
              <Icon name="clip" size={14} /> Photo
              <input type="file" className="hidden" accept="image/*" onChange={(e) => setImage(e.target.files?.[0])} />
            </label>
            <select className="input-sm w-auto" value={tag} onChange={(e) => setTag(e.target.value)}>
              {Object.entries(TAG_META).filter(([k]) => k !== 'general').map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            <button type="button" className="btn-soft btn-xs" onClick={() => setKudoOpen(true)}>
              <Icon name="sparkles" size={14} /> Give kudos
            </button>
            <Button size="sm" variant="primary" className="ml-auto" disabled={!body.trim()} loading={busy} onClick={submit}>
              Post
            </Button>
          </div>
        </div>
      </div>
      <KudoModal open={kudoOpen} onClose={() => setKudoOpen(false)} onDone={onPost} />
    </Card>
  );
}

function CommentBox({ post, onChange }) {
  const { toast } = useStore();
  const [body, setBody] = useState('');
  const send = async () => {
    if (!body.trim()) return;
    try {
      await api.post(`/api/posts/${post.id}/comments`, { body });
      setBody('');
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        className="input-sm flex-1"
        value={body}
        placeholder="Write a comment…"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') send();
        }}
      />
      <Button size="sm" variant="soft" disabled={!body.trim()} onClick={send}>
        Send
      </Button>
    </div>
  );
}

function PostCard({ post, onChange }) {
  const { employee: me, toast } = useStore();
  const [showComments, setShowComments] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const [liked, setLiked] = useState(!!post.liked);
  const [busy, setBusy] = useState(false);

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    // optimistic
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const res = await api.post(`/api/posts/${post.id}/like`, {});
      setLiked(res.liked);
      setLikes(res.likes);
    } catch (err) {
      setLiked(!next);
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)));
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/api/posts/${post.id}`, {});
      toast('Post deleted', 'warn');
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const tagMeta = TAG_META[post.tag] || { label: post.tag, icon: '🗨️' };

  return (
    <Card className="mb-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <Avatar person={post} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={`#/employees/${post.employee_id}`} className="font-bold hover:underline">{post.author}</a>
            <span className="text-[11px] text-mute">{post.designation}</span>
            {post.tag && post.tag !== 'general' && (
              <Badge tone="slate" size="sm">{tagMeta.icon} {tagMeta.label}</Badge>
            )}
            <span className="ml-auto text-[11px] text-mute">{relative(post.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-soft">{post.body}</p>
          {post.image_url && (
            <img src={post.image_url} alt="post attachment" className="mt-2 max-h-80 w-full rounded-xl object-cover" />
          )}
        </div>
        {post.employee_id === me?.id && (
          <button type="button" className="text-mute transition hover:text-rose-500" onClick={remove} aria-label="Delete post">
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={toggleLike} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition hover:bg-[var(--bg-soft)] ${liked ? 'text-rose-500' : 'text-mute'}`}>
          <Icon name="heart" size={15} className={liked ? 'fill-current' : ''} /> {likes}
        </button>
        <button type="button" onClick={() => setShowComments((s) => !s)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-mute transition hover:bg-[var(--bg-soft)]">
          <Icon name="chat" size={15} /> {post.comments_count}
        </button>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-mute">{post.department || ''}</span>
      </div>

      {showComments && (
        <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
          {(post.comments || []).map((c) => (
            <div key={c.id} className="mb-2 flex items-start gap-2">
              <Avatar person={c} size={28} />
              <div className="min-w-0 flex-1 rounded-xl px-3 py-2" style={{ background: 'var(--bg-soft)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{c.author}</span>
                  <span className="text-[10px] text-mute">{relative(c.created_at)}</span>
                </div>
                <p className="text-xs text-soft">{c.body}</p>
              </div>
            </div>
          ))}
          <CommentBox post={post} onChange={onChange} />
        </div>
      )}
    </Card>
  );
}

export default function Social() {
  const { employee: me } = useStore();
  const [tag, setTag] = useState('');
  const { data, loading, reload } = useResource(() => api.get(`/api/posts?limit=30${tag ? `&tag=${tag}` : ''}`), [tag]);
  const bump = useLive();

  useEffect(() => {
    reload({ silent: true });
  }, [bump]);

  const rows = data?.rows || [];
  const tags = data?.tags || [];

  return (
    <div className="page">
      <PageHeader icon="users" title="Social wall" subtitle="Company updates, wins and peer recognition" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="chat" label="Posts" value={data?.total ?? rows.length} tone="indigo" />
        <Stat icon="heart" label="Reactions" value={rows.reduce((a, p) => a + (p.likes || 0), 0)} tone="rose" />
        <Stat icon="sparkles" label="Comments" value={rows.reduce((a, p) => a + (p.comments_count || 0), 0)} tone="amber" />
        <Stat icon="users" label="Tags in use" value={tags.length} tone="emerald" />
      </div>

      <PostComposer onPost={() => reload({ silent: true })} />

      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        <button type="button" onClick={() => setTag('')} className={`chip ${tag === '' ? 'chip-active' : ''}`}>
          {TAG_META.general.icon} All
        </button>
        {tags.map((t) => (
          <button key={t.tag} type="button" onClick={() => setTag(t.tag)} className={`chip ${tag === t.tag ? 'chip-active' : ''}`}>
            {TAG_META[t.tag]?.icon || '🏷️'} {TAG_META[t.tag]?.label || t.tag} · {t.count}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Card><SkeletonRows rows={4} /></Card>
          <Card><SkeletonRows rows={3} /></Card>
        </div>
      ) : rows.length ? (
        rows.map((p) => <PostCard key={p.id} post={p} onChange={() => reload({ silent: true })} />)
      ) : (
        <Card>
          <EmptyState icon="megaphone" title="The wall is quiet" message="Be the first to share an update with your team." />
        </Card>
      )}
    </div>
  );
}
