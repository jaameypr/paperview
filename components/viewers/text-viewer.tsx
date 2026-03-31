"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Comment, TextTarget, CodeTarget, LineSelectionData, LineSelectionEvent } from "@/types/comment";

/** Walk up from a DOM node until we find an element with data-line. */
function getLineNumber(node: Node): number | null {
  let el: Node | null = node;
  while (el) {
    if (el instanceof HTMLElement && el.dataset.line) return +el.dataset.line;
    el = el.parentNode;
  }
  return null;
}

interface Props {
  contentUrl: string;
  comments?: Comment[];
  activeCommentId?: string | null;
  pendingSelection?: LineSelectionData | null;
  onSelection?: (event: LineSelectionEvent) => void;
  onHighlightClick?: (commentId: string) => void;
}

export default function TextViewer({
  contentUrl,
  comments = [],
  activeCommentId,
  pendingSelection,
  onSelection,
  onHighlightClick,
}: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(contentUrl)
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content ?? "");
        setFilename(data.filename ?? "");
      })
      .catch(() => setContent("Failed to load content"))
      .finally(() => setLoading(false));
  }, [contentUrl]);

  function handleMouseUp() {
    if (!onSelection) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    if (!sel.toString().trim()) return;

    const range = sel.getRangeAt(0);
    const a = getLineNumber(range.startContainer);
    const b = getLineNumber(range.endContainer);
    if (!a || !b) return;

    const lineStart = Math.min(a, b);
    const lineEnd = Math.max(a, b);
    const linesArr = (content ?? "").split("\n");
    const quote = linesArr.slice(lineStart - 1, lineEnd).join("\n");

    const rect = range.getBoundingClientRect();
    onSelection({
      selectionData: { lineStart, lineEnd, quote },
      popoverTop: rect.bottom + 4,
      popoverLeft: rect.left + rect.width / 2,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const lines = (content ?? "").split("\n");

  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-auto max-h-[calc(100vh-200px)]"
      onMouseUp={handleMouseUp}
    >
      {filename && (
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500">
          {filename}
        </div>
      )}
      <pre className="p-4 text-sm font-mono leading-relaxed">
        {lines.map((line, i) => {
          const lineNumber = i + 1;
          const lineComments = comments.filter((c) => {
            const t = c.target as CodeTarget | TextTarget;
            return (t.type === "code" || t.type === "text")
              && t.lineStart <= lineNumber && t.lineEnd >= lineNumber;
          });
          const isActive = lineComments.some((c) => c._id === activeCommentId);
          const topComment = lineComments.find((c) => !c.resolved) ?? lineComments[0];
          const isPending = !!pendingSelection
            && lineNumber >= pendingSelection.lineStart
            && lineNumber <= pendingSelection.lineEnd;

          return (
            <div
              key={i}
              data-line={lineNumber}
              onClick={() => topComment && onHighlightClick?.(topComment._id)}
              className={cn(
                "whitespace-pre-wrap break-words min-h-[1.5em] px-1 -mx-1 rounded",
                "text-gray-800 dark:text-gray-200",
                isActive
                  ? "bg-yellow-200 dark:bg-yellow-400/40"
                  : topComment
                    ? (topComment.resolved
                        ? "bg-gray-100 dark:bg-gray-500/15"
                        : "bg-yellow-100/80 dark:bg-yellow-400/15")
                    : isPending
                      ? "bg-yellow-100/80 dark:bg-yellow-400/15"
                      : "",
                topComment && "cursor-pointer",
              )}
            >
              {line || "\u00A0"}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
