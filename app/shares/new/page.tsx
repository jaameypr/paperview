"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/app-shell";

export default function NewSharePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [downloadEnabled, setDownloadEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState("viewer_comments");
  const [changeNote, setChangeNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please select a file."); return; }
    if (!title.trim()) { setError("Title is required."); return; }

    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("visibility", visibility);
    if (visibility === "public_password" && password) formData.append("password", password);
    if (expiresAt) formData.append("expiresAt", new Date(expiresAt).toISOString());
    formData.append("commentsEnabled", String(commentsEnabled));
    formData.append("downloadEnabled", String(downloadEnabled));
    formData.append("previewMode", previewMode);
    formData.append("changeNote", changeNote.trim());

    try {
      const res = await fetch("/api/shares", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        router.push(`/shares/${data.share._id}`);
      } else {
        setError(data.error ?? "Failed to create share");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create New Share</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* File */}
          <div>
            <label className={labelClass}>File *</label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
              className={inputClass}
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="Share title"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Optional description"
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className={labelClass}>Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className={inputClass}
            >
              <option value="private">Private — Only collaborators</option>
              <option value="public">Public — Anyone with the link</option>
              <option value="public_password">Password Protected — Link + password</option>
            </select>
          </div>

          {visibility === "public_password" && (
            <div>
              <label className={labelClass}>Share Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password for share access"
                className={inputClass}
              />
            </div>
          )}

          {/* Expiration */}
          <div>
            <label className={labelClass}>Expiration (optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Preview Mode</label>
              <select
                value={previewMode}
                onChange={(e) => setPreviewMode(e.target.value)}
                className={inputClass}
              >
                <option value="viewer_comments">Viewer + Comments</option>
                <option value="viewer">Viewer Only</option>
                <option value="download_only">Download Only</option>
              </select>
            </div>
            <div className="flex flex-col gap-3 pt-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={commentsEnabled}
                  onChange={(e) => setCommentsEnabled(e.target.checked)}
                  className="rounded"
                />
                Comments enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={downloadEnabled}
                  onChange={(e) => setDownloadEnabled(e.target.checked)}
                  className="rounded"
                />
                Downloads enabled
              </label>
            </div>
          </div>

          {/* Change note */}
          <div>
            <label className={labelClass}>Version Note (optional)</label>
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Initial upload"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !file || !title.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            {loading ? "Uploading…" : "Create Share"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
