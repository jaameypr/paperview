"use client";

import { useState, FormEvent } from "react";
import type { Comment as CommentType } from "@/types/comment";

interface Props {
  shareId: string;
  versionId: string;
  comments: CommentType[];
  onCommentAdded: (comment: CommentType) => void;
  onCommentUpdated: (id: string, updates: Partial<CommentType>) => void;
  onCommentDeleted: (id: string) => void;
  onReplyAdded: (commentId: string, reply: CommentType["replies"][0]) => void;
}

export default function CommentPanel({
  shareId, versionId, comments, onCommentAdded, onCommentUpdated, onCommentDeleted, onReplyAdded,
}: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const apiBase = `/api/shares/${shareId}/versions/${versionId}/comments`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), target: { type: "general" } }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        onCommentAdded(data.comment);
        setText("");
      }
    } catch { /* */ }
    setLoading(false);
  }

  async function handleReply(commentId: string) {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`${apiBase}/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
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
    if (!confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: "DELETE" });
      if (res.ok) onCommentDeleted(id);
    } catch { /* */ }
  }

  const filtered = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Comments ({comments.length})
          </h3>
        </div>
        <div className="flex gap-1">
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
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            No comments yet.
          </p>
        ) : (
          filtered.map((comment) => (
            <div
              key={comment._id}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-3 ${
                comment.resolved
                  ? "border-gray-200 dark:border-gray-700 opacity-60"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {comment.authorName}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 mb-2 whitespace-pre-wrap">
                {comment.text}
              </p>

              {/* Actions */}
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => handleResolve(comment._id, !comment.resolved)}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                >
                  {comment.resolved ? "Reopen" : "Resolve"}
                </button>
                <button
                  onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => handleDelete(comment._id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
                  {comment.replies.map((reply) => (
                    <div key={reply._id}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{reply.authorName}</span>
                        <span className="text-xs text-gray-400">{new Date(reply.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              {replyingTo === comment._id && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply…"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    onKeyDown={(e) => { if (e.key === "Enter") handleReply(comment._id); }}
                  />
                  <button
                    onClick={() => handleReply(comment._id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200 dark:border-gray-700">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
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
