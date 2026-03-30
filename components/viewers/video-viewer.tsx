"use client";

interface Props {
  contentUrl: string;
  contentType: string;
}

export default function VideoViewer({ contentUrl, contentType }: Props) {
  return (
    <div className="flex justify-center bg-black rounded-lg overflow-hidden">
      <video
        controls
        className="max-w-full max-h-[calc(100vh-200px)]"
        preload="metadata"
      >
        <source src={contentUrl} type={contentType} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
