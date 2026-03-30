"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import CommentList from "./comment-list";
import CommentForm, { type CommentFormHandle } from "./comment-form";
import PdfOutline from "./pdf-outline";
import type { Comment, SelectionEvent } from "@/types/comment";
import type { OutlineItem } from "@/types/outline";
import type { PdfViewerHandle } from "./pdf-viewer";
import { useTheme } from "@/hooks/useTheme";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center gap-3 py-24 bg-gray-200 dark:bg-gray-800 rounded-xl h-96">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      <p className="text-sm text-gray-500 dark:text-gray-400">PDF-Viewer wird geladen…</p>
    </div>
  ),
});

const POLL_INTERVAL_MS = 5000;

type PageFilter = "current" | "all";
type StatusFilter = "open" | "resolved" | "all";

// ── Icons ───────────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function OutlineIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5h11M9 12h11M9 19h11M5 5v.01M5 12v.01M5 19v.01" />
    </svg>
  );
}

export default function DocClient() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState<PageFilter>("current");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<SelectionEvent | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Outline / sidebar state
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasAutoOpened = useRef(false);

  const { isDark, toggle: toggleTheme, mounted: themeMounted } = useTheme();
  const router = useRouter();
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewerRef = useRef<PdfViewerHandle>(null);
  const commentFormRef = useRef<CommentFormHandle>(null);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // ── Outline ─────────────────────────────────────────────────────────────────

  const handleOutlineLoaded = useCallback((items: OutlineItem[]) => {
    setOutline(items);
  }, []);

  // Auto-open sidebar on wide screens when outline is available
  useEffect(() => {
    if (outline && outline.length > 0 && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      if (typeof window !== "undefined" && window.innerWidth >= 1280) {
        setSidebarOpen(true);
      }
    }
  }, [outline]);

  const handleOutlineNavigate = useCallback((page: number) => {
    viewerRef.current?.scrollToPage(page);
    // On mobile, close sidebar after navigation
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchComments = useCallback(async (showLoader = false) => {
    if (showLoader) setCommentsLoading(true);
    try {
      const res = await fetch("/api/comments");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { comments: Comment[] } = await res.json();
      setComments(data.comments);
      setCommentsError(null);
    } catch {
      setCommentsError("Kommentare konnten nicht geladen werden.");
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments(true);
    pollTimer.current = setInterval(() => fetchComments(false), POLL_INTERVAL_MS);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchComments]);

  // ── Local State Updaters ────────────────────────────────────────────────────

  const handleCommentAdded = useCallback((comment: Comment) => {
    setComments((prev) => [...prev, comment]);
  }, []);

  const handleResolve = useCallback((commentId: string, resolved: boolean) => {
    setComments((prev) =>
      prev.map((c) => (c._id === commentId ? { ...c, resolved } : c))
    );
  }, []);

  const handleDelete = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c._id !== commentId));
    setActiveCommentId((prev) => (prev === commentId ? null : prev));
  }, []);

  const handleReplyAdded = useCallback((commentId: string, updatedComment: Comment) => {
    setComments((prev) =>
      prev.map((c) => (c._id === commentId ? updatedComment : c))
    );
  }, []);

  // ── PDF Viewer Events ──────────────────────────────────────────────────────

  const handleCommentClick = useCallback((commentId: string, page: number) => {
    setActiveCommentId((prev) => (prev === commentId ? null : commentId));
    viewerRef.current?.scrollToPage(page);
  }, []);

  const handleHighlightClick = useCallback((commentId: string) => {
    setActiveCommentId((prev) => (prev === commentId ? null : commentId));
    const el = document.getElementById(`comment-${commentId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleSelection = useCallback((event: SelectionEvent) => {
    setPendingSelection(event);
  }, []);

  function handleSelectionConfirm() {
    if (!pendingSelection) return;
    commentFormRef.current?.populate(pendingSelection.selectionData);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleSelectionDismiss() {
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  useEffect(() => {
    if (!pendingSelection) return;
    const onScroll = () => setPendingSelection(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pendingSelection]);

  // ── Auth ───────────────────────────────────────────────────────────────────

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentPageCommentCount = comments.filter(
    (c) => c.page === currentPage && !c.resolved
  ).length;
  const openCount = comments.filter((c) => !c.resolved).length;

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-20 shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle — visible once outline has loaded */}
            {outline !== null && (
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? "Inhaltsverzeichnis schließen" : "Inhaltsverzeichnis öffnen"}
                className={`p-2 rounded-lg transition-colors ${
                  sidebarOpen
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <OutlineIcon />
              </button>
            )}

            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                Dokument
              </h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight hidden sm:block">
                Seite {currentPage}{totalPages > 0 ? ` von ${totalPages}` : ""} · {openCount} offen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            {themeMounted && (
              <button
                onClick={toggleTheme}
                aria-label={isDark ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">
                {loggingOut ? "Abmelden…" : "Abmelden"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Sidebar Overlay ─────────────────────────────────────────── */}
      {sidebarOpen && outline !== null && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30 dark:bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-72 shadow-xl overflow-hidden"
          >
            <PdfOutline
              items={outline}
              currentPage={currentPage}
              onNavigate={handleOutlineNavigate}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-screen-2xl mx-auto w-full lg:h-full px-4 sm:px-6 py-4 flex flex-col lg:flex-row gap-5 lg:items-stretch">

          {/* ── Outline Sidebar (desktop) ──────────────────────────────────── */}
          {sidebarOpen && outline !== null && (
            <div className="hidden lg:block w-64 shrink-0 min-h-0">
              <PdfOutline
                items={outline}
                currentPage={currentPage}
                onNavigate={handleOutlineNavigate}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          )}

          {/* ── PDF Viewer ─────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 w-full min-h-0">
            <PdfViewer
              ref={viewerRef}
              onPageChange={setCurrentPage}
              onTotalPagesChange={setTotalPages}
              onOutlineLoaded={handleOutlineLoaded}
              comments={comments}
              activeCommentId={activeCommentId}
              onSelection={handleSelection}
              onHighlightClick={handleHighlightClick}
            />
          </div>

          {/* ── Comment Panel ──────────────────────────────────────────────── */}
          <aside className="w-full lg:w-[22rem] xl:w-[24rem] shrink-0 flex flex-col gap-4 min-h-0">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

              {/* Panel header */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Kommentare
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {comments.length} gesamt
                  </span>
                </div>

                {/* Page filter */}
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium mb-2">
                  <button
                    onClick={() => setPageFilter("current")}
                    className={`flex-1 py-1.5 px-2 text-center transition-colors ${
                      pageFilter === "current"
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    Seite {currentPage}
                    {currentPageCommentCount > 0 && (
                      <span className={`ml-1 inline-block min-w-[1.2rem] text-center rounded-full px-1 text-[10px] ${
                        pageFilter === "current"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}>
                        {currentPageCommentCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setPageFilter("all")}
                    className={`flex-1 py-1.5 px-2 text-center transition-colors ${
                      pageFilter === "all"
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    Alle
                  </button>
                </div>

                {/* Status filter */}
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-[11px] font-medium">
                  {(["open", "all", "resolved"] as StatusFilter[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`flex-1 py-1 text-center transition-colors ${
                        statusFilter === s
                          ? "bg-gray-700 dark:bg-gray-600 text-white"
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {s === "open" ? "Offen" : s === "resolved" ? "Aufgelöst" : "Alle"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment list */}
              <div
                className="px-3 py-3 overflow-y-auto min-h-0 flex-1"
              >
                <CommentList
                  comments={comments}
                  loading={commentsLoading}
                  error={commentsError}
                  filterByPage={pageFilter === "current"}
                  statusFilter={statusFilter}
                  currentPage={currentPage}
                  activeCommentId={activeCommentId}
                  onCommentClick={handleCommentClick}
                  onResolve={handleResolve}
                  onDelete={handleDelete}
                  onReplyAdded={handleReplyAdded}
                />
              </div>

              {/* Add comment form */}
              <div
                ref={formSectionRef}
                className="px-4 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 shrink-0"
              >
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                  Kommentar hinzufügen
                </p>
                <CommentForm
                  ref={commentFormRef}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onCommentAdded={handleCommentAdded}
                />
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-600 text-center shrink-0">
              Sync alle {POLL_INTERVAL_MS / 1000}s · Text im PDF markieren zum Kommentieren
            </p>
          </aside>
        </div>
      </main>

      {/* ── Selection Popover ──────────────────────────────────────────────── */}
      {pendingSelection && (
        <div
          style={{
            position: "fixed",
            top: Math.min(pendingSelection.popoverTop, window.innerHeight - 80),
            left: Math.max(
              80,
              Math.min(pendingSelection.popoverLeft, window.innerWidth - 80)
            ),
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
          className="bg-gray-900 dark:bg-gray-700 text-white rounded-xl shadow-xl px-3 py-2 flex items-center gap-2 text-xs border border-gray-700 dark:border-gray-600"
        >
          <svg
            className="w-3.5 h-3.5 text-yellow-400 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd"
              d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
              clipRule="evenodd" />
          </svg>
          <span className="max-w-[12rem] truncate text-gray-300 italic">
            „{pendingSelection.selectionData.quote.slice(0, 60)}
            {pendingSelection.selectionData.quote.length > 60 ? "…" : ""}"
          </span>
          <button
            onClick={handleSelectionConfirm}
            className="ml-1 bg-blue-500 hover:bg-blue-400 text-white px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            Kommentieren
          </button>
          <button
            onClick={handleSelectionDismiss}
            className="text-gray-400 hover:text-white transition-colors ml-0.5"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
