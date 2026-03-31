"use client";

import { useState, useEffect } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import csharp from "highlight.js/lib/languages/csharp";
import cpp from "highlight.js/lib/languages/cpp";
import c from "highlight.js/lib/languages/c";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import scala from "highlight.js/lib/languages/scala";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import scss from "highlight.js/lib/languages/scss";
import "highlight.js/styles/github-dark.min.css";
import { cn } from "@/lib/utils";
import type { Comment, CodeTarget, TextTarget, LineSelectionData, LineSelectionEvent } from "@/types/comment";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", c);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("php", php);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("scala", scala);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("scss", scss);

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", ts: "typescript",
  jsx: "javascript", tsx: "typescript",
  py: "python", java: "java",
  cs: "csharp", cpp: "cpp",
  c: "c", go: "go",
  rs: "rust", php: "php",
  rb: "ruby", swift: "swift",
  kt: "kotlin", scala: "scala",
  sh: "bash", sql: "sql",
  html: "xml", css: "css", scss: "scss",
};

/**
 * Splits highlighted HTML into per-line strings, correctly closing and
 * reopening <span> tags at line boundaries so multi-line tokens retain colour.
 */
function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  let current = "";
  const openStack: string[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      const end = html.indexOf(">", i);
      if (end === -1) { current += html.slice(i); break; }
      const tag = html.slice(i, end + 1);
      if (tag.startsWith("</")) {
        openStack.pop();
      } else if (!tag.endsWith("/>")) {
        openStack.push(tag);
      }
      current += tag;
      i = end + 1;
    } else if (html[i] === "\n") {
      for (let j = openStack.length - 1; j >= 0; j--) current += "</span>";
      lines.push(current);
      current = openStack.join("");
      i++;
    } else {
      current += html[i];
      i++;
    }
  }

  for (let j = openStack.length - 1; j >= 0; j--) current += "</span>";
  lines.push(current);
  return lines;
}

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

export default function CodeViewer({
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

  const code = content ?? "";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const language = EXT_TO_LANG[ext];

  const highlightedHtml = language
    ? hljs.highlight(code, { language }).value
    : code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = splitHighlightedLines(highlightedHtml);

  return (
    <div
      className={cn("bg-gray-950 rounded-lg overflow-auto max-h-[calc(100vh-200px)]", onSelection && "select-text")}
      onMouseUp={handleMouseUp}
    >
      {filename && (
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
          {filename}
        </div>
      )}
      <pre className="p-4 text-sm font-mono leading-relaxed">
        <table className="w-full">
          <tbody>
            {lines.map((lineHtml, i) => {
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
                <tr
                  key={i}
                  data-line={lineNumber}
                  onClick={() => topComment && onHighlightClick?.(topComment._id)}
                  className={cn(
                    isActive
                      ? "bg-yellow-400/50"
                      : topComment
                        ? (topComment.resolved ? "bg-gray-500/15" : "bg-yellow-400/20")
                        : isPending
                          ? "bg-yellow-400/20"
                          : "hover:bg-gray-900/50",
                    topComment && "cursor-pointer",
                  )}
                >
                  <td className="pr-4 text-right text-gray-600 select-none w-12 align-top">
                    {lineNumber}
                  </td>
                  <td
                    className="whitespace-pre-wrap break-all text-gray-200"
                    dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </pre>
    </div>
  );
}
