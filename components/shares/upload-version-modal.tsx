"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareId: string;
  onUploaded: () => void;
}

export default function UploadVersionModal({ open, onOpenChange, shareId, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) { setError("Please select a file."); return; }
    setError("");
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("changeNote", changeNote.trim());
    try {
      const res = await fetch(`/api/shares/${shareId}/versions`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setFile(null);
        setChangeNote("");
        onUploaded();
        onOpenChange(false);
      } else {
        setError(data.error ?? "Upload failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Upload new version</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all select-none",
              dragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : file
                ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            {file ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB &middot; click to change
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    <span className="text-primary">Click to upload</span> or drag &amp; drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Any file type</p>
                </div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Version note */}
          <div className="space-y-1.5">
            <Label htmlFor="version-note">
              Version note{" "}
              <span className="text-muted-foreground font-normal">— optional</span>
            </Label>
            <Input
              id="version-note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              maxLength={500}
              placeholder="What changed in this version?"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleUpload} disabled={loading || !file}>
            {loading ? "Uploading…" : "Upload version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
