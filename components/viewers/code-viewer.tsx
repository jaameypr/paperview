"use client";

import { useState, useEffect } from "react";

interface Props {
  contentUrl: string;
}

export default function CodeViewer({ contentUrl }: Props) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const lines = (content ?? "").split("\n");

  return (
    <div className="bg-gray-950 rounded-lg overflow-auto max-h-[calc(100vh-200px)]">
      {filename && (
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
          {filename}
        </div>
      )}
      <pre className="p-4 text-sm font-mono text-gray-200 leading-relaxed">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-gray-900/50">
                <td className="pr-4 text-right text-gray-600 select-none w-12 align-top">
                  {i + 1}
                </td>
                <td className="whitespace-pre-wrap break-all">
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </pre>
    </div>
  );
}
