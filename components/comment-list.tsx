"use client";

import { useState, useEffect } from "react";
import type { Comment, Reply } from "@/types/comment";

const AUTHOR_KEY = "pdf-comment-author";

interface CommentListProps {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  filterByPage: boolean;
  statusFilter: "open" | "resolved" | "all";
  currentPage: number;
  activeCommentId: string | null;
  onCommentClick: (commentId: string, page: number) => void;
  onResolve: (commentId: string, resolved: boolean) => void;
  onDelete: (commentId: string) => void;
  onReplyAdded: (commentId: string, updatedComment: Comment) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const AVATAR_COLORS = [
  "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
  "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
  "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300",
  "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300",
  "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
  "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
];

function AuthorAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "xs" }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${color} ${
        size === "sm" ? "w-7 h-7 text-xs" : "w-5 h-5 text-[10px]"
      }`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Reply Item ───────────────────────────────────────────────────────────────

function ReplyItem({ reply }: { reply: Reply }) {
  return (
    <div className="flex gap-2 py-2">
      <AuthorAvatar name={reply.author} size="xs" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
            {reply.author}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {formatDate(reply.createdAt)}
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed whitespace-pre-wrap">
          {reply.text}
        </p>
      </div>
    </div>
  );
}

// ─── Reply Form ───────────────────────────────────────────────────────────────

function ReplyForm({
  commentId,
  onReplyAdded,
  onCancel,
}: {
  commentId: string;
  onReplyAdded: (updatedComment: Comment) => void;
  onCancel: () => void;
}) {
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY);
    if (saved) setAuthor(saved);
  }, []);

  function handleAuthorChange(v: string) {
    setAuthor(v);
    if (typeof window !== "undefined") localStorage.setItem(AUTHOR_KEY, v);
  }

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/comments/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: author.trim() || "Anonym",
          text: text.trim(),
        }),
      });
      const data: { comment?: Comment; error?: string } = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); return; }
      if (data.comment) onReplyAdded(data.comment);
      setText("");
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={author}
          onChange={(e) => handleAuthorChange(e.target.value)}
          placeholder="Name (optional)"
          maxLength={80}
          className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Antwort eingeben…"
        rows={2}
        maxLength={1000}
        autoFocus
        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
      />
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white text-xs py-1.5 rounded-lg transition-colors"
        >
          {loading ? "…" : "Antworten"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ─── Comment Card ─────────────────────────────────────────────────────────────

function CommentCard({
  comment,
  isActive,
  showPage,
  onCommentClick,
  onResolve,
  onDelete,
  onReplyAdded,
}: {
  comment: Comment;
  isActive: boolean;
  showPage: boolean;
  onCommentClick: (id: string, page: number) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onReplyAdded: (id: string, updated: Comment) => void;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleResolve() {
    setResolving(true);
    try {
      const res = await fetch(`/api/comments/${comment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !comment.resolved }),
      });
      if (res.ok) onResolve(comment._id, !comment.resolved);
    } finally {
      setResolving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/comments/${comment._id}`, { method: "DELETE" });
      if (res.ok) onDelete(comment._id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  let cardClass: string;
  if (isActive) {
    cardClass = "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-sm";
  } else if (comment.resolved) {
    cardClass = "border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 opacity-70";
  } else {
    cardClass = "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800";
  }

  return (
    <div
      id={`comment-${comment._id}`}
      className={`rounded-xl border transition-all duration-150 ${cardClass}`}
    >
      <div
        className="p-3 cursor-pointer"
        onClick={() => onCommentClick(comment._id, comment.page)}
      >
        {/* Header */}
        <div className="flex items-start gap-2 mb-1.5">
          <AuthorAvatar name={comment.author} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {comment.author}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {showPage && (
                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5">
                  S. {comment.page}
                </span>
              )}
              {comment.resolved && (
                <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd" />
                  </svg>
                  Aufgelöst
                </span>
              )}
              {comment.highlightRects?.length ? (
                <span className="text-[10px] bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded px-1.5 py-0.5">
                  ▐ Markierung
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Quote */}
        {comment.quote && (
          <div className="mb-2 ml-9 border-l-2 border-yellow-300 dark:border-yellow-600 pl-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2">
              {comment.quote}
            </p>
          </div>
        )}

        {/* Text */}
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap ml-9">
          {comment.text}
        </p>
      </div>

      {/* Actions */}
      <div
        className="px-3 pb-2.5 flex items-center gap-1 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowReplyForm((v) => !v)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md transition-colors"
        >
          Antworten{comment.replies.length > 0 ? ` (${comment.replies.length})` : ""}
        </button>

        <button
          onClick={handleResolve}
          disabled={resolving}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            comment.resolved
              ? "text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              : "text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
          }`}
        >
          {resolving ? "…" : comment.resolved ? "Erneut öffnen" : "Auflösen"}
        </button>

        <div className="flex-1" />

        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-600 dark:text-red-400">
              Wirklich löschen?
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              {deleting ? "…" : "Ja"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            >
              Nein
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-md transition-colors"
          >
            Löschen
          </button>
        )}
      </div>

      {/* Replies */}
      {(comment.replies.length > 0 || showReplyForm) && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
          {comment.replies.map((reply) => (
            <ReplyItem key={reply._id} reply={reply} />
          ))}
          {showReplyForm && (
            <ReplyForm
              commentId={comment._id}
              onReplyAdded={(updated) => {
                onReplyAdded(comment._id, updated);
                setShowReplyForm(false);
              }}
              onCancel={() => setShowReplyForm(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Comment List ─────────────────────────────────────────────────────────────

export default function CommentList({
  comments,
  loading,
  error,
  filterByPage,
  statusFilter,
  currentPage,
  activeCommentId,
  onCommentClick,
  onResolve,
  onDelete,
  onReplyAdded,
}: CommentListProps) {
  let visible = filterByPage
    ? comments.filter((c) => c.page === currentPage)
    : comments;

  if (statusFilter === "open") visible = visible.filter((c) => !c.resolved);
  else if (statusFilter === "resolved") visible = visible.filter((c) => c.resolved);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10">
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="text-sm text-gray-400 dark:text-gray-500">Wird geladen…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 px-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        {error}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">
        {filterByPage
          ? `Noch keine Kommentare für Seite ${currentPage}`
          : "Noch keine Kommentare"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((comment) => (
        <CommentCard
          key={comment._id}
          comment={comment}
          isActive={comment._id === activeCommentId}
          showPage={!filterByPage}
          onCommentClick={onCommentClick}
          onResolve={onResolve}
          onDelete={onDelete}
          onReplyAdded={onReplyAdded}
        />
      ))}
    </div>
  );
}
