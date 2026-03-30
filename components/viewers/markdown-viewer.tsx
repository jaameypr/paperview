"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  contentUrl: string;
}

export default function MarkdownViewer({ contentUrl }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(contentUrl)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? ""))
      .catch(() => setContent("Failed to load content"))
      .finally(() => setLoading(false));
  }, [contentUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 overflow-auto max-h-[calc(100vh-200px)] prose dark:prose-invert prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content ?? ""}
      </ReactMarkdown>
    </div>
  );
}
