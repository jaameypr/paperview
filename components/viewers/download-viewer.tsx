"use client";

interface Props {
  filename: string;
  fileSize: number;
  downloadUrl: string;
  kind: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ICONS: Record<string, string> = {
  office: "📎", archive: "📦", binary: "💾",
};

export default function DownloadViewer({ filename, fileSize, downloadUrl, kind }: Props) {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-12">
      <span className="text-6xl mb-4">{KIND_ICONS[kind] ?? "📄"}</span>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
        {filename}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {formatBytes(fileSize)} · No preview available
      </p>
      <a
        href={downloadUrl}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        download
      >
        Download File
      </a>
    </div>
  );
}
