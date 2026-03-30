"use client";

interface Props {
  contentUrl: string;
  contentType: string;
}

export default function AudioViewer({ contentUrl, contentType }: Props) {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-8">
      <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      <audio controls className="w-full max-w-md" preload="metadata">
        <source src={contentUrl} type={contentType} />
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
}
