"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  contentUrl: string;
}

export default function PdfViewer({ contentUrl }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Track container width for responsive rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Detect current page via IntersectionObserver
  useEffect(() => {
    if (numPages === 0) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let maxPage = currentPage;
        for (const entry of entries) {
          const page = parseInt(entry.target.getAttribute("data-page") ?? "1", 10);
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            maxPage = page;
          }
        }
        if (maxRatio > 0) setCurrentPage(maxPage);
      },
      { root: el, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    pageRefs.current.forEach((ref) => observer.observe(ref));
    return () => observer.disconnect();
  }, [numPages, currentPage]);

  const scrollToPage = useCallback((page: number) => {
    const ref = pageRefs.current.get(page);
    if (ref) ref.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  const pageWidth = containerWidth > 0 ? Math.min(containerWidth - 48, 900) : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {numPages || "—"}
          </span>
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={currentPage}
            onChange={(e) => {
              const p = parseInt(e.target.value, 10);
              if (p >= 1 && p <= numPages) {
                setCurrentPage(p);
                scrollToPage(p);
              }
            }}
            className="w-14 px-2 py-1 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setScale(1.2)}
            className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors ml-1"
            title="Reset zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Pages container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-gray-200 dark:bg-gray-950"
      >
        <Document
          file={contentUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          }
          error={
            <div className="flex items-center justify-center h-64 text-red-500 text-sm">
              Failed to load PDF.
            </div>
          }
        >
          <div className="flex flex-col items-center py-4 gap-4">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                  else pageRefs.current.delete(pageNum);
                }}
                className="shadow-lg bg-white"
              >
                <Page
                  pageNumber={pageNum}
                  scale={scale}
                  width={pageWidth && scale === 1.2 ? pageWidth : undefined}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}
