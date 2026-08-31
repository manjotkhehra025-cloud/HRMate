"use client";

import { useState, useEffect } from "react";
import { Send, ThumbsUp, MessageSquare, Trash2, Loader2 } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner, EmptyState } from "@/components/ui";
import { classNames, timeAgo } from "@/lib/utils";

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
  me,
}: {
  canPost: boolean;
  canModerate: boolean;
  userId: string;
  me: { name: string; color: string; avatar?: string };
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
        p.id === postId ? { ...p, like_count: data.count, liked_by_me: data.liked ? 1 : 0 } : p
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
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#172334] lg:text-[30px]">Social Wall</h1>
        <p className="mt-1 text-[14px] text-[#8A97A8]">Announcements, shout-outs and team updates.</p>
      </div>

      {canPost && (
        <form onSubmit={submitPost} className="card p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Avatar name={me.name} color={me.color} size={40} src={avatarSrc(userId, me.avatar)} />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share an update…"
              className="min-h-[88px] w-full resize-none rounded-[14px] border border-[#E3EAF1] bg-[#F8FAFD] px-4 py-3 text-[14px] text-[#172334] outline-none focus:border-[#1E6FE0]"
              rows={3}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#1E6FE0] px-4 text-[14px] font-semibold text-white disabled:opacity-50 sm:w-auto sm:min-w-[120px]"
            >
              {posting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />} Post
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
            <article key={p.id} className="card p-5">
              <div className="flex items-start gap-3">
                <Avatar
                  name={p.author_name}
                  color={p.author_color}
                  size={42}
                  src={avatarSrc(p.user_id, p.author_avatar)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#172334]">{p.author_name}</p>
                      <p className="text-[12px] text-[#8A97A8]">
                        {p.author_designation || "Team member"} · {timeAgo(p.created_at)}
                      </p>
                    </div>
                    {(p.user_id === userId || canModerate) && (
                      <button
                        type="button"
                        onClick={() => deletePost(p.id)}
                        className="rounded-lg p-1.5 text-[#8A97A8] transition hover:bg-rose-50 hover:text-rose-500"
                        aria-label="Delete post"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 break-words whitespace-pre-wrap text-[14px] leading-relaxed text-[#172334]">
                    {p.content}
                  </p>

                  <div className="mt-3 flex items-center gap-2 border-t border-[#F0F4F8] pt-3">
                    <button
                      type="button"
                      onClick={() => toggleLike(p.id)}
                      className={classNames(
                        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold",
                        p.liked_by_me ? "text-[#1E6FE0]" : "text-[#8A97A8] hover:bg-[#F4F7FB]"
                      )}
                    >
                      <ThumbsUp className={classNames("h-4 w-4", p.liked_by_me && "fill-[#1E6FE0]")} />
                      {p.like_count > 0 ? p.like_count : "Like"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenComments(isOpen ? null : p.id)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#8A97A8] hover:bg-[#F4F7FB]"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {p.comment_count > 0 ? p.comment_count : "Comment"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 space-y-3 border-t border-[#F0F4F8] pt-3">
                      {postComments.map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar
                            name={c.author_name}
                            color={c.author_color}
                            size={28}
                            src={avatarSrc(c.user_id, c.author_avatar)}
                          />
                          <div className="flex-1 rounded-[14px] bg-[#F4F7FB] px-3 py-2">
                            <p className="text-[12px] font-semibold text-[#172334]">{c.author_name}</p>
                            <p className="text-[13px] text-[#617083]">{c.content}</p>
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
                          type="button"
                          onClick={() => submitComment(p.id)}
                          disabled={commenting === p.id}
                          className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#1E6FE0] text-white"
                          aria-label="Send comment"
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
            </article>
          );
        })
      )}
    </div>
  );
}
