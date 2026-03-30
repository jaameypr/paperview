"use client";

import { useState } from "react";
import type { ShareDTO } from "@/types/share";
import { KIND_FEATURES } from "@/types/share";

interface Props {
  share: ShareDTO;
  onClose: () => void;
  onUpdated: (updates: Partial<ShareDTO>) => void;
}

export default function ShareModal({ share, onClose, onUpdated }: Props) {
  const isPublic = share.visibility !== "private";
  const supportsComments = KIND_FEATURES[share.kind]?.comments ?? false;

  const initialMode =
    isPublic && share.previewMode === "viewer_comments" && share.commentsEnabled
      ? "comment"
      : "view";

  const [mode, setMode] = useState<"view" | "comment">(initialMode);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shares/${share._id}`
    : "";

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    setSaving(true);
    const updates: Partial<ShareDTO> = {
      visibility: "public",
      previewMode: mode === "comment" ? "viewer_comments" : "viewer",
      commentsEnabled: mode === "comment",
      downloadEnabled: true,
    };
    try {
      const res = await fetch(`/api/shares/${share._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        onUpdated(updates);
        copyLink();
      }
    } catch { /* */ }
    setSaving(false);
  }

  async function handleSave() {
    setSaving(true);
    const updates: Partial<ShareDTO> = {
      previewMode: mode === "comment" ? "viewer_comments" : "viewer",
      commentsEnabled: mode === "comment",
    };
    try {
      const res = await fetch(`/api/shares/${share._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        onUpdated(updates);
        onClose();
      }
    } catch { /* */ }
    setSaving(false);
  }

  async function handleUnshare() {
    setSaving(true);
    try {
      const res = await fetch(`/api/shares/${share._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "private" }),
      });
      if (res.ok) {
        onUpdated({ visibility: "private" });
        onClose();
      }
    } catch { /* */ }
    setSaving(false);
  }

  const modeOptions: { value: "view" | "comment"; label: string; sub: string }[] = [
    { value: "view", label: "View / Download only", sub: "Recipients can view and download" },
    ...(supportsComments
      ? [{ value: "comment" as const, label: "View / Download + Comment", sub: "Recipients can also leave comments" }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {isPublic ? "Sharing settings" : "Share this document"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[240px]">
                {share.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Share link (if public) */}
        {isPublic && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate font-mono">
                {shareUrl}
              </span>
              <button
                onClick={copyLink}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Mode options */}
        <div className="px-6 py-5 space-y-2.5">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
            Access level
          </p>
          {modeOptions.map(({ value, label, sub }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                  active
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      active ? "border-blue-500" : "border-gray-300 dark:border-gray-500"
                    }`}
                  >
                    {active && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center gap-2">
          {isPublic ? (
            <>
              <button
                onClick={handleUnshare}
                disabled={saving}
                className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
              >
                Stop sharing
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {saving ? "Sharing…" : "Share & copy link"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
