"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import type { Comment, SelectionData, SelectionEvent, HighlightRect } from "@/types/comment";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PdfViewerHandle {
  scrollToPage: (page: number) => void;
}

interface PdfViewerProps {
  contentUrl: string;
  comments?: Comment[];
  activeCommentId?: string | null;
  pendingSelection?: SelectionData | null;
  onPageChange?: (page: number) => void;
  onTotalPagesChange?: (total: number) => void;
  onSelection?: (event: SelectionEvent) => void;
  onHighlightClick?: (commentId: string) => void;
}

function highlightColor(isActive: boolean, resolved: boolean): string {
  if (isActive) return "rgba(251,191,36,0.65)";
  if (resolved) return "rgba(156,163,175,0.35)";
  return "rgba(251,191,36,0.30)";
}

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer(
    { contentUrl, comments = [], activeCommentId = null, pendingSelection = null, onPageChange, onTotalPagesChange, onSelection, onHighlightClick },
    ref
  ) {
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [baseWidth, setBaseWidth] = useState(680);
    const pageWidth = Math.round(baseWidth * scale);

    const scrollRef = useRef<HTMLDivElement>(null);
    const pageVisibilitiesRef = useRef<Map<number, number>>(new Map());
    const onPageChangeRef = useRef(onPageChange);
    onPageChangeRef.current = onPageChange;

    useImperativeHandle(ref, () => ({
      scrollToPage(page: number) {
        const el = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    }));

    // Responsive page width
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;
      const update = () => setBaseWidth(Math.min(container.clientWidth - 32, 820));
      update();
      const ro = new ResizeObserver(update);
      ro.observe(container);
      return () => ro.disconnect();
    }, []);

    // IntersectionObserver for current page detection
    useEffect(() => {
      if (numPages === 0 || !scrollRef.current) return;
      const root = scrollRef.current;
      const thresholds = Array.from({ length: 11 }, (_, i) => i * 0.1);

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const pn = parseInt((entry.target as HTMLElement).dataset.page ?? "1", 10);
            pageVisibilitiesRef.current.set(pn, entry.intersectionRatio);
          }
          let best = 1;
          let bestRatio = -1;
          pageVisibilitiesRef.current.forEach((ratio, page) => {
            if (ratio > bestRatio) { bestRatio = ratio; best = page; }
          });
          if (bestRatio > 0) {
            setCurrentPage(best);
            onPageChangeRef.current?.(best);
          }
        },
        { root, threshold: thresholds }
      );

      const els = root.querySelectorAll("[data-page]");
      els.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
    }, [numPages, scale]);

    // Text selection handler — DOM tree walking for cross-page selection
    useEffect(() => {
      const container = scrollRef.current;
      if (!container || !onSelection) return;

      function onMouseUp() {
        setTimeout(() => {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed || !selection.rangeCount) return;

          const quote = selection.toString().trim();
          if (quote.length < 2) return;

          const range = selection.getRangeAt(0);
          const root = scrollRef.current;
          if (!root) return;

          const highlightRects: HighlightRect[] = [];
          let primaryPage: number | null = null;
          const pageRectCache = new Map<HTMLElement, DOMRect>();

          const ancestor = range.commonAncestorContainer;
          const walkRoot = ancestor.nodeType === Node.ELEMENT_NODE
            ? (ancestor as HTMLElement)
            : ancestor.parentElement;
          if (!walkRoot || !root.contains(walkRoot)) return;

          const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT);
          let node: Node | null;

          while ((node = walker.nextNode())) {
            const textNode = node as Text;
            if (!range.intersectsNode(textNode)) continue;
            if (!textNode.textContent || textNode.textContent.trim().length === 0) continue;

            const pageEl = textNode.parentElement?.closest<HTMLElement>("[data-page]");
            if (!pageEl || !root.contains(pageEl)) continue;

            const pageNum = parseInt(pageEl.dataset.page!, 10);
            if (isNaN(pageNum)) continue;

            const subRange = document.createRange();
            subRange.setStart(textNode, range.startContainer === textNode ? range.startOffset : 0);
            subRange.setEnd(textNode, range.endContainer === textNode ? range.endOffset : textNode.length);

            let pageRect = pageRectCache.get(pageEl);
            if (!pageRect) { pageRect = pageEl.getBoundingClientRect(); pageRectCache.set(pageEl, pageRect); }

            const rects = subRange.getClientRects();
            for (const cr of rects) {
              if (cr.width <= 1 || cr.height <= 1) continue;
              const hr: HighlightRect = {
                page: pageNum,
                x: ((cr.left - pageRect.left) / pageRect.width) * 100,
                y: ((cr.top - pageRect.top) / pageRect.height) * 100,
                width: (cr.width / pageRect.width) * 100,
                height: (cr.height / pageRect.height) * 100,
              };
              const x2 = Math.min(hr.x + hr.width, 100);
              const y2 = Math.min(hr.y + hr.height, 100);
              hr.x = Math.max(hr.x, 0);
              hr.y = Math.max(hr.y, 0);
              hr.width = x2 - hr.x;
              hr.height = y2 - hr.y;
              if (hr.width <= 0 || hr.height <= 0) continue;
              if (hr.width > 95 && hr.height > 40) continue;
              highlightRects.push(hr);
              if (primaryPage === null) primaryPage = pageNum;
            }
          }

          if (highlightRects.length === 0 || primaryPage === null) return;

          const rangeBRect = range.getBoundingClientRect();
          onSelection!({
            selectionData: { page: primaryPage, quote, highlightRects },
            popoverTop: rangeBRect.bottom + 8,
            popoverLeft: rangeBRect.left + rangeBRect.width / 2,
          });
        }, 20);
      }

      container.addEventListener("mouseup", onMouseUp);
      return () => container.removeEventListener("mouseup", onMouseUp);
    }, [onSelection, scale]);

    function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
      setNumPages(n);
      onTotalPagesChange?.(n);
    }

    function scrollToPage(page: number) {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Click handler for highlights
    function handlePageClick(e: React.MouseEvent<HTMLDivElement>, pageNum: number) {
      if (!onHighlightClick) return;
      const pageEl = e.currentTarget;
      const pageRect = pageEl.getBoundingClientRect();
      const x = ((e.clientX - pageRect.left) / pageRect.width) * 100;
      const y = ((e.clientY - pageRect.top) / pageRect.height) * 100;

      for (const comment of comments) {
        const target = comment.target;
        if (target.type !== "pdf" || !target.highlightRects?.length) continue;
        for (const rect of target.highlightRects) {
          if ((rect.page ?? target.page) !== pageNum) continue;
          if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
            onHighlightClick(comment._id);
            return;
          }
        }
      }
    }

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
                if (p >= 1 && p <= numPages) { setCurrentPage(p); scrollToPage(p); }
              }}
              className="w-14 px-2 py-1 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))} className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Zoom out">−</button>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))} className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="Zoom in">+</button>
            <button onClick={() => setScale(1.2)} className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors ml-1" title="Reset zoom">Reset</button>
          </div>
        </div>

        {/* Pages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-200 dark:bg-gray-950">
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
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                // Collect highlights for this page
                const pageHighlights: { commentId: string; rects: HighlightRect[]; resolved: boolean }[] = [];
                for (const c of comments) {
                  if (c.target.type !== "pdf" || !c.target.highlightRects?.length) continue;
                  const rects = c.target.highlightRects.filter((r) => {
                    const rp = r.page ?? c.target.type === "pdf" ? (c.target as { page: number }).page : 0;
                    if (rp !== pageNum) return false;
                    if (r.width <= 0 || r.height <= 0) return false;
                    if (r.width > 95 && r.height > 40) return false;
                    return true;
                  });
                  if (rects.length > 0) pageHighlights.push({ commentId: c._id, rects, resolved: c.resolved });
                }

                const pendingRects = pendingSelection?.highlightRects?.filter(
                  (r) => r.page === pageNum && r.width > 0 && r.height > 0
                ) ?? [];

                return (
                  <div
                    key={`${pageNum}-${scale}`}
                    data-page={pageNum}
                    className="relative mx-auto bg-white shadow-lg cursor-default"
                    style={{ width: pageWidth }}
                    onClick={(e) => handlePageClick(e, pageNum)}
                  >
                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div className="bg-white dark:bg-gray-800 flex items-center justify-center" style={{ height: Math.round(pageWidth * 1.414) }}>
                          <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
                        </div>
                      }
                    />

                    {/* Highlight overlays */}
                    {pageHighlights.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {pageHighlights.map(({ commentId, rects, resolved }) =>
                          rects.map((rect, ri) => (
                            <div
                              key={`${commentId}-${ri}`}
                              className="absolute transition-colors duration-150"
                              style={{
                                left: `${rect.x}%`,
                                top: `${rect.y}%`,
                                width: `${rect.width}%`,
                                height: `${rect.height}%`,
                                backgroundColor: highlightColor(commentId === activeCommentId, resolved),
                                mixBlendMode: "multiply",
                              }}
                            />
                          ))
                        )}
                      </div>
                    )}

                    {/* Pending selection overlay */}
                    {pendingRects.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {pendingRects.map((rect, ri) => (
                          <div
                            key={`pending-${ri}`}
                            className="absolute"
                            style={{
                              left: `${rect.x}%`,
                              top: `${rect.y}%`,
                              width: `${rect.width}%`,
                              height: `${rect.height}%`,
                              backgroundColor: "rgba(59,130,246,0.35)",
                              mixBlendMode: "multiply",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Document>
        </div>
      </div>
    );
  }
);

export default PdfViewer;
