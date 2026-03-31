"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/app-shell";
import type { ShareDTO } from "@/types/share";
import { KIND_FEATURES } from "@/types/share";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ICONS: Record<string, string> = {
  pdf: "📄", code: "💻", image: "🖼️", video: "🎬", audio: "🎵",
  text: "📝", markdown: "📑", data: "📊", office: "📎", archive: "📦", binary: "💾",
};

const VIS_BADGES: Record<string, { label: string; color: string }> = {
  private: { label: "Private", color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" },
  public: { label: "Public", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  public_password: { label: "Password", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
};

export default function DashboardPage() {
  const [shares, setShares] = useState<ShareDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shares")
      .then((r) => r.json())
      .then((data) => setShares(data.shares ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const active = shares.filter((s) => !s.expiresAt || new Date(s.expiresAt) > now);
  const expired = shares.filter((s) => s.expiresAt && new Date(s.expiresAt) <= now);

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <Link
            href="/shares/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New Share
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : shares.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No shares yet.</p>
            <Link
              href="/shares/new"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Create your first share →
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <ShareGrid shares={active} title="Active Shares" />
            )}
            {expired.length > 0 && (
              <ShareGrid shares={expired} title="Expired Shares" dimmed />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ShareGrid({ shares, title, dimmed }: { shares: ShareDTO[]; title: string; dimmed?: boolean }) {
  return (
    <div className={`mb-8 ${dimmed ? "opacity-60" : ""}`}>
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {title} ({shares.length})
      </h2>
      <div className="grid gap-3">
        {shares.map((share) => {
          const vis = VIS_BADGES[share.visibility] ?? VIS_BADGES.private;
          const features = KIND_FEATURES[share.kind];
          return (
            <Link
              key={share._id}
              href={`/shares/${share._id}`}
              className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{KIND_ICONS[share.kind] ?? "📄"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {share.title}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${vis.color}`}>
                      {vis.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {share.kind}
                    </span>
                  </div>
                  {share.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-1">
                      {share.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>by {share.ownerName}</span>
                    <span>{formatDate(share.createdAt)}</span>
                    {features?.preview && <span>Preview</span>}
                    {features?.comments && share.commentsEnabled && <span>Comments</span>}
                    {share.expiresAt && (
                      <span className={new Date(share.expiresAt) <= new Date() ? "text-red-500" : ""}>
                        Expires {formatDate(share.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
