"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/app-shell";
import CommentPanel from "@/components/shares/comment-panel";
import DownloadViewer from "@/components/viewers/download-viewer";
import { useSSE } from "@/hooks/useSSE";
import { KIND_FEATURES } from "@/types/share";
import type { ShareDTO, ShareVersionDTO } from "@/types/share";
import type { Comment } from "@/types/comment";

// Dynamic imports for viewers to avoid SSR issues
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

  const [share, setShare] = useState<ShareDTO | null>(null);
  const [versions, setVersions] = useState<(ShareVersionDTO & { commentCount?: number })[]>([]);
  const [access, setAccess] = useState<string>("none");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);
  const [showComments, setShowComments] = useState(true);

  // Fetch share data
  useEffect(() => {
    fetch(`/api/shares/${shareId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { router.push("/dashboard"); return; }
        setShare(data.share);
        setVersions(data.versions ?? []);
        setAccess(data.access ?? "none");
        setActiveVersionId(data.share.currentVersionId);
      })
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false));
  }, [shareId, router]);

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
      setComments((prev) => [...prev, d as unknown as Comment]);
    } else if (event === "comment:updated") {
      setComments((prev) => prev.map((c) => c._id === d._id ? { ...c, ...d } as Comment : c));
    } else if (event === "comment:deleted") {
      setComments((prev) => prev.filter((c) => c._id !== d._id));
    } else if (event === "reply:created") {
      const { commentId, reply } = d as { commentId: string; reply: Comment["replies"][0] };
      setComments((prev) => prev.map((c) =>
        c._id === commentId ? { ...c, replies: [...c.replies, reply] } : c
      ));
    }
  }, []);

  const sseUrl = activeVersionId ? `/api/shares/${shareId}/versions/${activeVersionId}/events` : null;
  useSSE(sseUrl, handleSSE);

  if (loading || !share) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
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
                <span className="text-xs text-gray-400">
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
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Viewer */}
          <div className={`flex-1 overflow-auto p-4 ${hasComments && showComments ? "" : ""}`}>
            {hasPreview ? (
              <ViewerSwitch
                kind={share.kind}
                contentUrl={contentUrl}
                downloadUrl={downloadUrl}
                contentType={activeVersion?.contentType ?? ""}
                filename={activeVersion?.originalFilename ?? ""}
                fileSize={activeVersion?.fileSize ?? 0}
              />
            ) : (
              <DownloadViewer
                filename={activeVersion?.originalFilename ?? "file"}
                fileSize={activeVersion?.fileSize ?? 0}
                downloadUrl={downloadUrl}
                kind={share.kind}
              />
            )}
          </div>

          {/* Comments sidebar */}
          {hasComments && showComments && (
            <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <CommentPanel
                shareId={shareId}
                versionId={activeVersionId ?? ""}
                comments={comments}
                onCommentAdded={(c) => setComments((prev) => [...prev, c])}
                onCommentUpdated={(id, u) => setComments((prev) => prev.map((c) => c._id === id ? { ...c, ...u } as Comment : c))}
                onCommentDeleted={(id) => setComments((prev) => prev.filter((c) => c._id !== id))}
                onReplyAdded={(cid, r) => setComments((prev) => prev.map((c) => c._id === cid ? { ...c, replies: [...c.replies, r] } : c))}
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ViewerSwitch({
  kind, contentUrl, downloadUrl, contentType, filename, fileSize,
}: {
  kind: string; contentUrl: string; downloadUrl: string; contentType: string; filename: string; fileSize: number;
}) {
  switch (kind) {
    case "pdf":
      return <PdfViewer contentUrl={contentUrl} />;
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
      return <DownloadViewer filename={filename} fileSize={fileSize} downloadUrl={downloadUrl} kind={kind} />;
  }
}
