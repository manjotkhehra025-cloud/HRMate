"use client";

import { useState, useEffect, useRef } from "react";
import { Send, ThumbsUp, MessageSquare, Trash2, Loader2 } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner, EmptyState } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

interface Post {
  id: string;
  content: string;
  created_at: number;
  author_name: string;
  author_color: string;
  author_designation: string;
  author_avatar?: string;
  like_count: number;
  comment_count: number;
  liked_by_me: number;
  user_id: string;
}
interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: number;
  author_name: string;
  author_color: string;
  author_avatar?: string;
}

export default function WallClient({
  canPost,
  canModerate,
  userId,
}: {
  canPost: boolean;
  canModerate: boolean;
  userId: string;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/wall");
    const data = await res.json();
    setPosts(data.posts);
    setComments(data.comments);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    await fetch("/api/wall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setContent("");
    setPosting(false);
    load();
  }

  async function toggleLike(postId: string) {
    const res = await fetch(`/api/wall/${postId}/like`, { method: "POST" });
    const data = await res.json();
    setPosts((ps) =>
      ps.map((p) =>
        p.id === postId
          ? { ...p, like_count: data.count, liked_by_me: data.liked ? 1 : 0 }
          : p
      )
    );
  }

  async function submitComment(postId: string) {
    if (!commentText.trim()) return;
    setCommenting(postId);
    await fetch(`/api/wall/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText }),
    });
    setCommentText("");
    setCommenting(null);
    load();
  }

  async function deletePost(postId: string) {
    await fetch(`/api/wall/${postId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Composer */}
      {canPost && (
        <form onSubmit={submitPost} className="card p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share an update, announcement or shout-out…"
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            rows={2}
          />
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={posting || !content.trim()} className="btn-primary px-4 py-2 text-xs">
              {posting ? <Spinner className="h-4 w-4" /> : <><Send className="h-3.5 w-3.5" /> Post</>}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-7 w-7 text-brand-500" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="No posts yet"
          subtitle="Be the first to share something with your team."
        />
      ) : (
        posts.map((p) => {
          const postComments = comments.filter((c) => c.post_id === p.id);
          const isOpen = openComments === p.id;
          return (
            <div key={p.id} className="card p-5 animate-fade-in">
              <div className="flex items-start gap-3">
                <Avatar name={p.author_name} color={p.author_color} size={42} src={avatarSrc(p.user_id, p.author_avatar)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{p.author_name}</p>
                      <p className="text-xs text-slate-400">
                        {p.author_designation || "Team member"} · {timeAgo(p.created_at)}
                      </p>
                    </div>
                    {(p.user_id === userId || canModerate) && (
                      <button
                        onClick={() => deletePost(p.id)}
                        className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {p.content}
                  </p>

                  <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => toggleLike(p.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition ${
                        p.liked_by_me
                          ? "text-brand-600"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <ThumbsUp className={`h-4 w-4 ${p.liked_by_me ? "fill-brand-600" : ""}`} />
                      {p.like_count > 0 && p.like_count}
                    </button>
                    <button
                      onClick={() => setOpenComments(isOpen ? null : p.id)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {p.comment_count > 0 && p.comment_count}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                      {postComments.map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar name={c.author_name} color={c.author_color} size={28} src={avatarSrc(c.user_id, c.author_avatar)} />
                          <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold text-slate-700">{c.author_name}</p>
                            <p className="text-sm text-slate-600">{c.content}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitComment(p.id);
                          }}
                          placeholder="Write a comment…"
                          className="input flex-1 py-2 text-sm"
                        />
                        <button
                          onClick={() => submitComment(p.id)}
                          disabled={commenting === p.id}
                          className="btn-primary p-2.5"
                        >
                          {commenting === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
