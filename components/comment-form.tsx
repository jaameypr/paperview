"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  FormEvent,
} from "react";
import type { Comment, SelectionData } from "@/types/comment";

const AUTHOR_KEY = "pdf-comment-author";

export interface CommentFormHandle {
  populate: (data: SelectionData) => void;
  focusText: () => void;
}

interface CommentFormProps {
  currentPage: number;
  totalPages: number;
  onCommentAdded: (comment: Comment) => void;
}

const CommentForm = forwardRef<CommentFormHandle, CommentFormProps>(
  function CommentForm({ currentPage, totalPages, onCommentAdded }, ref) {
    const [author, setAuthor] = useState("");
    const [text, setText] = useState("");
    const [page, setPage] = useState(currentPage);
    const [pendingSelection, setPendingSelection] = useState<SelectionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const textRef = useRef<HTMLTextAreaElement>(null);

    // Load saved author name
    useEffect(() => {
      if (typeof window === "undefined") return;
      const saved = localStorage.getItem(AUTHOR_KEY);
      if (saved) setAuthor(saved);
    }, []);

    // Sync page with current PDF page
    useEffect(() => {
      setPage(currentPage);
    }, [currentPage]);

    useImperativeHandle(ref, () => ({
      populate(data: SelectionData) {
        setPendingSelection(data);
        setPage(data.page);
        setTimeout(() => textRef.current?.focus(), 50);
      },
      focusText() {
        textRef.current?.focus();
      },
    }));

    function handleAuthorChange(value: string) {
      setAuthor(value);
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTHOR_KEY, value);
      }
    }

    async function handleSubmit(e: FormEvent) {
      e.preventDefault();
      setError(null);
      setSuccess(false);

      const trimmedText = text.trim();
      if (!trimmedText) {
        setError("Bitte gib einen Kommentartext ein.");
        return;
      }

      const safePage = Number.isInteger(page) && page >= 1 ? page : currentPage;

      setLoading(true);
      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            author: author.trim() || "Anonym",
            page: safePage,
            text: trimmedText,
            quote: pendingSelection?.quote,
            highlightRects: pendingSelection?.highlightRects,
          }),
        });

        const data: { comment?: Comment; error?: string } = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Fehler beim Speichern");
          return;
        }

        if (data.comment) onCommentAdded(data.comment);
        setText("");
        setPendingSelection(null);
        setPage(currentPage);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch {
        setError("Netzwerkfehler. Bitte versuche es erneut.");
      } finally {
        setLoading(false);
      }
    }

    const maxPage = totalPages > 0 ? totalPages : 9999;

    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Quote preview */}
        {pendingSelection && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 flex items-start gap-2">
            <svg
              className="w-4 h-4 text-yellow-500 dark:text-yellow-400 mt-0.5 shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed line-clamp-3 italic">
                {pendingSelection.quote}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPendingSelection(null)}
              className="text-yellow-400 dark:text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-300 shrink-0 ml-1"
              aria-label="Markierung entfernen"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Author */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Name
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => handleAuthorChange(e.target.value)}
              placeholder="Anonym"
              maxLength={80}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
            />
          </div>

          {/* Page */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Seite
            </label>
            <input
              type="number"
              value={page}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) setPage(val);
              }}
              min={1}
              max={maxPage}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Comment text */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Kommentar <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              pendingSelection
                ? "Kommentar zur Markierung eingeben…"
                : "Kommentar eingeben…"
            }
            rows={3}
            maxLength={2000}
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none transition"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-0.5">
            {text.length}/2000
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
            Kommentar wurde gespeichert.
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {loading ? "Wird gespeichert…" : "Kommentar hinzufügen"}
        </button>
      </form>
    );
  }
);

export default CommentForm;
