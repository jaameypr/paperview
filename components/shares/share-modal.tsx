"use client";

import { useState } from "react";
import type { ShareDTO } from "@/types/share";
import { KIND_FEATURES } from "@/types/share";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: ShareDTO;
  onUpdated: (updates: Partial<ShareDTO>) => void;
}

export default function ShareModal({ open, onOpenChange, share, onUpdated }: Props) {
  const isPublic = share.visibility !== "private";
  const supportsComments = KIND_FEATURES[share.kind]?.comments ?? false;

  const [mode, setMode] = useState<"view" | "comment">(
    isPublic && share.commentsEnabled ? "comment" : "view"
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/shares/${share._id}` : "";

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
      if (res.ok) { onUpdated(updates); copyLink(); }
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
      if (res.ok) { onUpdated(updates); onOpenChange(false); }
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
      if (res.ok) { onUpdated({ visibility: "private" }); onOpenChange(false); }
    } catch { /* */ }
    setSaving(false);
  }

  const modes = [
    {
      value: "view" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      label: "View & Download",
      sub: "Recipients can view and download the file",
    },
    ...(supportsComments ? [{
      value: "comment" as const,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
      label: "View, Download & Comment",
      sub: "Recipients can also leave comments",
    }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{isPublic ? "Sharing settings" : "Share this document"}</DialogTitle>
          <DialogDescription className="truncate">{share.title}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Share link when public */}
          {isPublic && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
              <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="flex-1 text-xs font-mono text-muted-foreground truncate">{shareUrl}</span>
              <button
                onClick={copyLink}
                className="text-xs font-semibold text-primary hover:underline shrink-0 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {/* Access level */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Access level
            </p>
            {modes.map(({ value, icon, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "w-full text-left flex items-start gap-3.5 rounded-xl border-2 p-3.5 transition-all",
                  mode === value
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-border hover:border-border/70 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "mt-0.5 shrink-0 rounded-lg p-1.5 transition-colors",
                  mode === value
                    ? "bg-primary/10 text-primary dark:bg-primary/20"
                    : "bg-muted text-muted-foreground"
                )}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{label}</p>
                    {mode === value && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          {isPublic ? (
            <>
              <Button variant="destructive" size="sm" onClick={handleUnshare} disabled={saving} className="mr-auto">
                Stop sharing
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleShare} disabled={saving} className="gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {saving ? "Sharing…" : "Share & copy link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
