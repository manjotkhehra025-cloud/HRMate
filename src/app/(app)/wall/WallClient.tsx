"use client";

import { useState, useEffect } from "react";
import { Send, ThumbsUp, MessageSquare, Trash2, Loader2 } from "lucide-react";
import Avatar, { avatarSrc } from "@/components/Avatar";
import { Spinner } from "@/components/ui";
import { classNames, timeAgo } from "@/lib/utils";
import { usePrefs } from "@/components/PrefsProvider";

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
  const { t } = usePrefs();
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
    setPosts(data.posts || []);
    setComments(data.comments || []);
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
    if (!confirm("Are you sure you want to delete this post?")) return;
    await fetch(`/api/wall/${postId}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-[18px] bg-white p-4 sm:p-6 border border-[#E3EAF1] shadow-card">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-[#1E6FE0]" />
          <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight text-[#172334]">
            {t("socialFeedTitle")}
          </h1>
        </div>
        <p className="mt-1 text-[13px] sm:text-[14px] text-[#617083]">
          {t("socialFeedSub")}
        </p>
      </div>

      {/* Post Creator */}
      {canPost && (
        <form onSubmit={submitPost} className="card p-5 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)]">
          <div className="flex items-start gap-3.5">
            <Avatar name={me.name} color={me.color} size={44} src={avatarSrc(userId, me.avatar)} />
            <div className="min-w-0 flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("shareSomething")}
                className="w-full resize-none rounded-[14px] border border-[#E3EAF1] bg-[#F8FAFD] p-3.5 text-[14px] text-[#172334] outline-none transition focus:border-[#1E6FE0] focus:bg-white focus:ring-2 focus:ring-[#1E6FE0]/15"
                rows={3}
              />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-[#8A97A8]">
                  {t("visibleToAll")}
                </span>
                <button
                  type="submit"
                  disabled={posting || !content.trim()}
                  className="btn-primary px-5 py-2 text-[13.5px]"
                >
                  {posting ? <Spinner /> : <Send className="h-4 w-4" />} {t("postAnnouncement")}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Posts Feed Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-[#1E6FE0]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-[#C5D0DC] mb-2" />
          <p className="text-[16px] font-bold text-[#172334]">{t("noAnnouncements")}</p>
          <p className="text-[13px] text-[#8A97A8] mt-1">{t("shareSomething")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {posts.map((p) => {
            const postComments = comments.filter((c) => c.post_id === p.id);
            const isOpen = openComments === p.id;
            return (
              <article
                key={p.id}
                className="card p-5 border border-[#E3EAF1] shadow-[0_2px_12px_rgba(18,58,99,0.04)] flex flex-col justify-between hover:shadow-pop transition duration-150"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={p.author_name}
                        color={p.author_color}
                        size={42}
                        src={avatarSrc(p.user_id, p.author_avatar)}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-bold text-[#172334]">{p.author_name}</p>
                        <p className="text-[12px] text-[#8A97A8]">
                          {p.author_designation || "Team member"} · {timeAgo(p.created_at)}
                        </p>
                      </div>
                    </div>

                    {(p.user_id === userId || canModerate) && (
                      <button
                        type="button"
                        onClick={() => deletePost(p.id)}
                        className="rounded-lg p-1.5 text-[#8A97A8] transition hover:bg-rose-50 hover:text-[#C52B35]"
                        aria-label="Delete post"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <p className="mt-3.5 break-words whitespace-pre-wrap text-[14px] leading-relaxed text-[#172334]">
                    {p.content}
                  </p>
                </div>

                {/* Interaction Footer */}
                <div className="mt-4 border-t border-[#F0F4F8] pt-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleLike(p.id)}
                      className={classNames(
                        "flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold transition",
                        p.liked_by_me
                          ? "bg-[#E7F1FF] text-[#1E6FE0]"
                          : "text-[#617083] hover:bg-[#F4F7FB] hover:text-[#172334]"
                      )}
                    >
                      <ThumbsUp className={classNames("h-4 w-4", p.liked_by_me ? "fill-[#1E6FE0]" : "")} />
                      {p.like_count > 0 ? `${p.like_count} ${t("like")}` : t("like")}
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenComments(isOpen ? null : p.id)}
                      className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold text-[#617083] transition hover:bg-[#F4F7FB] hover:text-[#172334]"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {postComments.length > 0
                        ? `${postComments.length} ${t("comments")}`
                        : t("comment")}
                    </button>
                  </div>

                  {/* Comment Thread */}
                  {isOpen && (
                    <div className="mt-3.5 space-y-3 border-t border-[#F0F4F8] pt-3 animate-fade-in">
                      {postComments.map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar
                            name={c.author_name}
                            color={c.author_color}
                            size={30}
                            src={avatarSrc(c.user_id, c.author_avatar)}
                          />
                          <div className="min-w-0 flex-1 rounded-[14px] bg-[#F4F7FB] p-2.5">
                            <p className="text-[12px] font-bold text-[#172334]">{c.author_name}</p>
                            <p className="text-[13px] text-[#617083] mt-0.5">{c.content}</p>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitComment(p.id);
                          }}
                          placeholder={t("writeComment")}
                          className="input flex-1 py-2 text-[13px] rounded-[10px] min-h-[38px]"
                        />
                        <button
                          type="button"
                          onClick={() => submitComment(p.id)}
                          disabled={commenting === p.id || !commentText.trim()}
                          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#1E6FE0] text-white disabled:opacity-50"
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
