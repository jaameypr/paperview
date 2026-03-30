"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import type { Comment as CommentType, SelectionData } from "@/types/comment";

const AVATAR_COLORS = [
  "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
  "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
  "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
  "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300",
  "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300",
];

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "xs" }) {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${color} ${size === "sm" ? "w-7 h-7 text-xs" : "w-5 h-5 text-[10px]"}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const GUEST_NAME_KEY = "paperview_guest_name";

interface Props {
  shareId: string;
  versionId: string;
  shareKind: string;
  isGuest?: boolean;
  comments: CommentType[];
  currentPage?: number;
  totalPages?: number;
  activeCommentId?: string | null;
  onCommentAdded: (comment: CommentType) => void;
  onCommentUpdated: (id: string, updates: Partial<CommentType>) => void;
  onCommentDeleted: (id: string) => void;
  onReplyAdded: (commentId: string, reply: CommentType["replies"][0]) => void;
  onCommentClick?: (commentId: string, page?: number) => void;
  pendingSelection?: SelectionData | null;
  onClearSelection?: () => void;
}

export default function CommentPanel({
  shareId, versionId, shareKind, isGuest = false, comments, currentPage = 1, totalPages = 0,
  activeCommentId, onCommentAdded, onCommentUpdated, onCommentDeleted, onReplyAdded,
  onCommentClick, pendingSelection, onClearSelection,
}: Props) {
  const [text, setText] = useState("");
  const [page, setPage] = useState(currentPage);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [pageFilter, setPageFilter] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [guestName, setGuestName] = useState(() =>
    typeof window !== "undefined" ? (localStorage.getItem(GUEST_NAME_KEY) ?? "") : ""
  );
  const [guestNameError, setGuestNameError] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const isPdf = shareKind === "pdf";

  useEffect(() => { setPage(currentPage); }, [currentPage]);

  // Focus text area when selection comes in
  useEffect(() => {
    if (pendingSelection) {
      setPage(pendingSelection.page);
      setTimeout(() => textRef.current?.focus(), 50);
    }
  }, [pendingSelection]);

  // Scroll to active comment
  useEffect(() => {
    if (!activeCommentId) return;
    const el = document.getElementById(`comment-${activeCommentId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeCommentId]);

  const apiBase = `/api/shares/${shareId}/versions/${versionId}/comments`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (isGuest && !guestName.trim()) { setGuestNameError(true); return; }
    setGuestNameError(false);
    setLoading(true);

    if (isGuest) localStorage.setItem(GUEST_NAME_KEY, guestName.trim());

    const target = isPdf
      ? {
          type: "pdf" as const,
          page,
          selectedText: pendingSelection?.quote,
          highlightRects: pendingSelection?.highlightRects,
        }
      : { type: "general" as const };

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          target,
          ...(isGuest ? { authorName: guestName.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        onCommentAdded(data.comment);
        setText("");
        onClearSelection?.();
      }
    } catch { /* */ }
    setLoading(false);
  }

  async function handleReply(commentId: string) {
    if (!replyText.trim()) return;
    if (isGuest && !guestName.trim()) { setGuestNameError(true); return; }
    if (isGuest) localStorage.setItem(GUEST_NAME_KEY, guestName.trim());
    try {
      const res = await fetch(`${apiBase}/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: replyText.trim(),
          ...(isGuest ? { authorName: guestName.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        onReplyAdded(commentId, data.reply);
        setReplyText("");
        setReplyingTo(null);
      }
    } catch { /* */ }
  }

  async function handleResolve(id: string, resolved: boolean) {
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (res.ok) onCommentUpdated(id, { resolved });
    } catch { /* */ }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (res.ok) { onCommentDeleted(id); setConfirmDelete(null); }
    } catch { /* */ }
  }

  let filtered = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });
  if (isPdf && pageFilter) {
    filtered = filtered.filter((c) =>
      c.target.type === "pdf" ? c.target.page === currentPage : true
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Comments ({comments.length})
          </h3>
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["all", "open", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded ${
                filter === f
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          {isPdf && (
            <button
              onClick={() => setPageFilter(!pageFilter)}
              className={`px-2 py-1 text-xs rounded ${
                pageFilter
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              Page {currentPage}
            </button>
          )}
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            {pageFilter ? `No comments on page ${currentPage}` : "No comments yet."}
          </p>
        ) : (
          filtered.map((comment) => {
            const isActive = comment._id === activeCommentId;
            const pdfTarget = comment.target.type === "pdf" ? comment.target : null;

            return (
              <div
                key={comment._id}
                id={`comment-${comment._id}`}
                className={`rounded-xl border transition-all duration-150 ${
                  isActive
                    ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                    : comment.resolved
                      ? "border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 opacity-70"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                }`}
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => onCommentClick?.(comment._id, pdfTarget?.page)}
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <Avatar name={comment.authorName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {comment.authorName}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {pdfTarget && (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5">
                            p. {pdfTarget.page}
                          </span>
                        )}
                        {comment.resolved && (
                          <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Resolved
                          </span>
                        )}
                        {pdfTarget?.highlightRects?.length ? (
                          <span className="text-[10px] bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded px-1.5 py-0.5">
                            ▐ Highlight
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {pdfTarget?.selectedText && (
                    <div className="mb-2 ml-9 border-l-2 border-yellow-300 dark:border-yellow-600 pl-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2">
                        {pdfTarget.selectedText}
                      </p>
                    </div>
                  )}

                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap ml-9">
                    {comment.text}
                  </p>
                </div>

                {/* Actions */}
                <div className="px-3 pb-2.5 flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  {confirmDelete === comment._id ? (
                    <>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Delete this comment?</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(comment._id)}
                        className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md transition-colors"
                      >
                        Reply{comment.replies.length > 0 ? ` (${comment.replies.length})` : ""}
                      </button>
                      <button
                        onClick={() => handleResolve(comment._id, !comment.resolved)}
                        className={`text-xs px-2 py-1 rounded-md transition-colors ${
                          comment.resolved
                            ? "text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            : "text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        }`}
                      >
                        {comment.resolved ? "Reopen" : "Resolve"}
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => setConfirmDelete(comment._id)}
                        className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Replies */}
                {(comment.replies.length > 0 || replyingTo === comment._id) && (
                  <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
                    {comment.replies.map((reply) => (
                      <div key={reply._id} className="flex gap-2 py-2">
                        <Avatar name={reply.authorName} size="xs" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{reply.authorName}</span>
                            <span className="text-[10px] text-gray-400">{formatDate(reply.createdAt)}</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-wrap">{reply.text}</p>
                        </div>
                      </div>
                    ))}
                    {replyingTo === comment._id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a reply…"
                          autoFocus
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          onKeyDown={(e) => { if (e.key === "Enter") handleReply(comment._id); }}
                        />
                        <button onClick={() => handleReply(comment._id)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Send</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {/* Guest name field */}
        {isGuest && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 shrink-0">Name</span>
            <input
              type="text"
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); if (e.target.value.trim()) setGuestNameError(false); }}
              placeholder="What should we call you?"
              maxLength={60}
              className={`flex-1 px-2 py-1 text-xs border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 transition ${
                guestNameError
                  ? "border-red-400 focus:ring-red-400"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              }`}
            />
          </div>
        )}
        {pendingSelection && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 flex items-start gap-2">
            <svg className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <p className="flex-1 text-xs text-yellow-700 dark:text-yellow-300 italic line-clamp-3">
              {pendingSelection.quote}
            </p>
            <button type="button" onClick={() => onClearSelection?.()} className="text-yellow-400 hover:text-yellow-600 shrink-0">✕</button>
          </div>
        )}

        {isPdf && (
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Page</label>
            <input
              type="number"
              value={page}
              onChange={(e) => setPage(parseInt(e.target.value, 10) || 1)}
              min={1}
              max={totalPages || 9999}
              className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={pendingSelection ? "Comment on selection…" : "Add a comment…"}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white py-1.5 rounded-lg text-sm transition-colors"
        >
          {loading ? "Posting…" : "Add Comment"}
        </button>
      </form>
    </div>
  );
}
