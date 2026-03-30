"use client";

interface Props {
  contentUrl: string;
}

export default function PdfViewer({ contentUrl }: Props) {
  return (
    <div className="bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
      <iframe
        src={contentUrl}
        className="w-full h-full border-0"
        title="PDF Preview"
      />
    </div>
  );
}
