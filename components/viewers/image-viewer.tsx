"use client";

interface Props {
  contentUrl: string;
}

export default function ImageViewer({ contentUrl }: Props) {
  return (
    <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4 max-h-[calc(100vh-200px)] overflow-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={contentUrl}
        alt="Preview"
        className="max-w-full h-auto rounded shadow-lg"
      />
    </div>
  );
}
