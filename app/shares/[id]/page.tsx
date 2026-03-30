"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/app-shell";
import CommentPanel from "@/components/shares/comment-panel";
import ShareModal from "@/components/shares/share-modal";
import UploadVersionModal from "@/components/shares/upload-version-modal";
import DownloadViewer from "@/components/viewers/download-viewer";
import { useSSE } from "@/hooks/useSSE";
import { useAuth } from "@/hooks/useAuth";
import { KIND_FEATURES } from "@/types/share";
import type { ShareDTO, ShareVersionDTO } from "@/types/share";
import type { Comment, SelectionData, SelectionEvent } from "@/types/comment";
import type { PdfViewerHandle } from "@/components/viewers/pdf-viewer";

const PdfViewer = dynamic(() => import("@/components/viewers/pdf-viewer"), { ssr: false });
const CodeViewer = dynamic(() => import("@/components/viewers/code-viewer"), { ssr: false });
const ImageViewer = dynamic(() => import("@/components/viewers/image-viewer"), { ssr: false });
const VideoViewer = dynamic(() => import("@/components/viewers/video-viewer"), { ssr: false });
const AudioViewer = dynamic(() => import("@/components/viewers/audio-viewer"), { ssr: false });
const TextViewer = dynamic(() => import("@/components/viewers/text-viewer"), { ssr: false });
const MarkdownViewer = dynamic(() => import("@/components/viewers/markdown-viewer"), { ssr: false });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ShareDetailPage() {
  const params = useParams<{ id: string }>();
  const shareId = params.id;
  const router = useRouter();
  const { user } = useAuth();

  const [share, setShare] = useState<ShareDTO | null>(null);
  const [versions, setVersions] = useState<(ShareVersionDTO & { commentCount?: number })[]>([]);
  const [access, setAccess] = useState<string>("none");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF-specific state
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<SelectionData | null>(null);
  const [selectionPopover, setSelectionPopover] = useState<{ top: number; left: number } | null>(null);
  const pdfViewerRef = useRef<PdfViewerHandle>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Password prompt state
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordTitle, setPasswordTitle] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Fetch share data
  const fetchShare = useCallback(() => {
    setLoading(true);
    fetch(`/api/shares/${shareId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.passwordRequired) {
          setPasswordRequired(true);
          setPasswordTitle(data.share?.title ?? "Protected Share");
          setLoading(false);
          return;
        }
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setPasswordRequired(false);
        setShare(data.share);
        setVersions(data.versions ?? []);
        setAccess(data.access ?? "none");
        setActiveVersionId(data.share.currentVersionId);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load share"); setLoading(false); });
  }, [shareId]);

  useEffect(() => { fetchShare(); }, [fetchShare]);

  // Handle password submit
  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setPasswordLoading(true);
    setPasswordError("");
    try {
      const res = await fetch(`/api/shares/${shareId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordRequired(false);
        setPasswordInput("");
        fetchShare();
      } else {
        setPasswordError(data.error ?? "Invalid password");
      }
    } catch {
      setPasswordError("Network error");
    } finally {
      setPasswordLoading(false);
    }
  }

  // Fetch comments for active version
  useEffect(() => {
    if (!activeVersionId) return;
    fetch(`/api/shares/${shareId}/versions/${activeVersionId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }, [shareId, activeVersionId]);

  // SSE for real-time updates
  const handleSSE = useCallback((event: string, data: unknown) => {
    const d = data as Record<string, unknown>;
    if (event === "comment:created") {
      setComments((prev) => {
        const incoming = d as unknown as Comment;
        if (prev.some((c) => c._id === incoming._id)) return prev;
        return [...prev, incoming];
      });
    } else if (event === "comment:updated") {
      setComments((prev) => prev.map((c) => c._id === d._id ? { ...c, ...d } as Comment : c));
    } else if (event === "comment:deleted") {
      setComments((prev) => prev.filter((c) => c._id !== d._id));
    } else if (event === "reply:created") {
      const { commentId, reply } = d as { commentId: string; reply: Comment["replies"][0] };
      setComments((prev) => prev.map((c) =>
        c._id === commentId && !c.replies.some((r) => r._id === reply._id)
          ? { ...c, replies: [...c.replies, reply] }
          : c
      ));
    }
  }, []);

  const sseUrl = activeVersionId ? `/api/shares/${shareId}/versions/${activeVersionId}/events` : null;
  useSSE(sseUrl, handleSSE);

  // PDF text selection handler
  const handlePdfSelection = useCallback((event: SelectionEvent) => {
    setPendingSelection(event.selectionData);
    // Convert viewport coords to container-relative
    const containerRect = contentAreaRef.current?.getBoundingClientRect();
    if (containerRect) {
      setSelectionPopover({
        top: event.popoverTop - containerRect.top,
        left: event.popoverLeft - containerRect.left,
      });
    } else {
      setSelectionPopover({ top: event.popoverTop, left: event.popoverLeft });
    }
    setShowComments(true);
  }, []);

  // When clicking a highlight in PDF, scroll comment panel to that comment
  const handleHighlightClick = useCallback((commentId: string) => {
    setActiveCommentId(commentId);
    setShowComments(true);
  }, []);

  // When clicking a comment in the panel, scroll PDF to that page
  const handleCommentClick = useCallback((commentId: string, page?: number) => {
    setActiveCommentId(commentId);
    if (page && pdfViewerRef.current) {
      pdfViewerRef.current.scrollToPage(page);
    }
  }, []);

  // Dismiss popover on click elsewhere
  function dismissPopover() {
    setSelectionPopover(null);
  }

  // Accept selection: close popover, keep selection data for the comment form
  function acceptSelection() {
    setSelectionPopover(null);
    // pendingSelection is already set — the comment panel will use it
  }

  // Password prompt screen
  if (passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1">
              {passwordTitle}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              This share is password protected.
            </p>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              {passwordError && (
                <p className="text-xs text-red-500 mb-2">{passwordError}</p>
              )}
              <button
                type="submit"
                disabled={passwordLoading || !passwordInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {passwordLoading ? "Checking…" : "Unlock"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </AppShell>
    );
  }

  if (error || !share) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p className="text-gray-500 dark:text-gray-400">{error ?? "Share not found"}</p>
          {user && (
            <button onClick={() => router.push("/dashboard")} className="text-sm text-blue-600 hover:underline">
              Go to Dashboard
            </button>
          )}
        </div>
      </AppShell>
    );
  }

  const activeVersion = versions.find((v) => v._id === activeVersionId);
  const currentVersion = versions.find((v) => v._id === share.currentVersionId);
  const isOldVersion = activeVersionId !== share.currentVersionId;
  const features = KIND_FEATURES[share.kind];
  const hasPreview = features?.preview && share.previewMode !== "download_only";
  const hasComments = features?.comments && share.commentsEnabled && share.previewMode === "viewer_comments";
  const isOwner = access === "owner" || access === "admin" || (!!user && user._id === share.ownerId);

  const contentUrl = activeVersionId
    ? `/api/shares/${shareId}/versions/${activeVersionId}/content`
    : "";
  const downloadUrl = activeVersionId
    ? `/api/shares/${shareId}/versions/${activeVersionId}/file`
    : "";

  return (
    <AppShell>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header bar */}
        <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {share.title}
              </h1>
              {share.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{share.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeVersion && (
                <span className="text-xs text-gray-400 hidden sm:inline">
                  v{activeVersion.versionNumber} · {activeVersion.originalFilename}
                </span>
              )}
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Versions ({versions.length})
              </button>
              {hasComments && (
                <button
                  onClick={() => setShowComments(!showComments)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    showComments
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  Comments ({comments.length})
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    share.visibility !== "private"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                      : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {share.visibility !== "private" ? "Shared" : "Share"}
                </button>
              )}
              {share.downloadEnabled && (
                <a
                  href={downloadUrl}
                  download
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download
                </a>
              )}
            </div>
          </div>

          {/* Old version banner */}
          {isOldVersion && (
            <div className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-amber-700 dark:text-amber-400">
                You are viewing an older version (v{activeVersion?.versionNumber}).
              </span>
              <button
                onClick={() => setActiveVersionId(share.currentVersionId)}
                className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium"
              >
                Go to current (v{currentVersion?.versionNumber}) →
              </button>
            </div>
          )}
        </div>

        {/* Version history dropdown */}
        {showVersions && (
          <div className="shrink-0 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 px-4 py-3 max-h-48 overflow-y-auto">
            {isOwner && (
              <button
                onClick={() => { setShowVersions(false); setShowUploadModal(true); }}
                className="w-full mb-2 px-3 py-2 rounded-lg text-sm text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload new version
              </button>
            )}
            <div className="space-y-1">
              {versions.map((v) => (
                <button
                  key={v._id}
                  onClick={() => { setActiveVersionId(v._id); setShowVersions(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                    v._id === activeVersionId
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <span>
                    v{v.versionNumber}
                    {v._id === share.currentVersionId && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">(current)</span>
                    )}
                    {v.changeNote && (
                      <span className="ml-2 text-xs text-gray-400"> — {v.changeNote}</span>
                    )}
                    {v.restoredFromVersionId && (
                      <span className="ml-2 text-xs text-amber-500">(restored)</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(v.createdAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content area */}
        <div ref={contentAreaRef} className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Viewer */}
          <div className="flex-1 overflow-auto" onClick={dismissPopover}>
            {hasPreview ? (
              <ViewerSwitch
                kind={share.kind}
                contentUrl={contentUrl}
                downloadUrl={downloadUrl}
                contentType={activeVersion?.contentType ?? ""}
                filename={activeVersion?.originalFilename ?? ""}
                fileSize={activeVersion?.fileSize ?? 0}
                comments={comments}
                activeCommentId={activeCommentId}
                pendingSelection={pendingSelection}
                pdfViewerRef={pdfViewerRef}
                onPdfPageChange={setPdfCurrentPage}
                onPdfTotalPages={setPdfTotalPages}
                onPdfSelection={handlePdfSelection}
                onHighlightClick={handleHighlightClick}
              />
            ) : (
              <div className="p-4">
                <DownloadViewer
                  filename={activeVersion?.originalFilename ?? "file"}
                  fileSize={activeVersion?.fileSize ?? 0}
                  downloadUrl={downloadUrl}
                  kind={share.kind}
                />
              </div>
            )}
          </div>

          {/* Selection popover */}
          {selectionPopover && (
            <button
              onClick={acceptSelection}
              className="absolute z-50 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-colors"
              style={{ top: selectionPopover.top, left: selectionPopover.left }}
            >
              💬 Comment
            </button>
          )}

          {/* Comments sidebar */}
          {hasComments && showComments && (
            <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <CommentPanel
                shareId={shareId}
                versionId={activeVersionId ?? ""}
                shareKind={share.kind}
                comments={comments}
                currentPage={pdfCurrentPage}
                totalPages={pdfTotalPages}
                activeCommentId={activeCommentId}
                onCommentAdded={(c) => { setComments((prev) => prev.some((x) => x._id === c._id) ? prev : [...prev, c]); setPendingSelection(null); }}
                onCommentUpdated={(id, u) => setComments((prev) => prev.map((c) => c._id === id ? { ...c, ...u } as Comment : c))}
                onCommentDeleted={(id) => setComments((prev) => prev.filter((c) => c._id !== id))}
                onReplyAdded={(cid, r) => setComments((prev) => prev.map((c) => c._id === cid && !c.replies.some((x) => x._id === r._id) ? { ...c, replies: [...c.replies, r] } : c))}
                onCommentClick={handleCommentClick}
                pendingSelection={pendingSelection}
                onClearSelection={() => setPendingSelection(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Share modal */}
      {showShareModal && (
        <ShareModal
          share={share}
          onClose={() => setShowShareModal(false)}
          onUpdated={(updates) => setShare((prev) => prev ? { ...prev, ...updates } as ShareDTO : prev)}
        />
      )}

      {/* Upload version modal */}
      {showUploadModal && (
        <UploadVersionModal
          shareId={shareId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => { fetchShare(); setShowUploadModal(false); }}
        />
      )}
    </AppShell>
  );
}

function ViewerSwitch({
  kind, contentUrl, downloadUrl, contentType, filename, fileSize,
  comments, activeCommentId, pendingSelection, pdfViewerRef, onPdfPageChange, onPdfTotalPages, onPdfSelection, onHighlightClick,
}: {
  kind: string; contentUrl: string; downloadUrl: string; contentType: string; filename: string; fileSize: number;
  comments?: Comment[];
  activeCommentId?: string | null;
  pendingSelection?: SelectionData | null;
  pdfViewerRef?: React.RefObject<PdfViewerHandle | null>;
  onPdfPageChange?: (page: number) => void;
  onPdfTotalPages?: (total: number) => void;
  onPdfSelection?: (event: SelectionEvent) => void;
  onHighlightClick?: (commentId: string) => void;
}) {
  switch (kind) {
    case "pdf":
      return (
        <PdfViewer
          ref={pdfViewerRef}
          contentUrl={contentUrl}
          comments={comments ?? []}
          activeCommentId={activeCommentId}
          pendingSelection={pendingSelection}
          onPageChange={onPdfPageChange}
          onTotalPagesChange={onPdfTotalPages}
          onSelection={onPdfSelection}
          onHighlightClick={onHighlightClick}
        />
      );
    case "code":
      return <CodeViewer contentUrl={contentUrl} />;
    case "image":
      return <ImageViewer contentUrl={contentUrl} />;
    case "video":
      return <VideoViewer contentUrl={contentUrl} contentType={contentType} />;
    case "audio":
      return <AudioViewer contentUrl={contentUrl} contentType={contentType} />;
    case "text":
    case "data":
      return <TextViewer contentUrl={contentUrl} />;
    case "markdown":
      return <MarkdownViewer contentUrl={contentUrl} />;
    default:
      return (
        <div className="p-4">
          <DownloadViewer filename={filename} fileSize={fileSize} downloadUrl={downloadUrl} kind={kind} />
        </div>
      );
  }
}
