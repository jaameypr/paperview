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
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { Comment, SelectionEvent, HighlightRect } from "@/types/comment";
import type { OutlineItem } from "@/types/outline";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/** Minimal interface for the pdfjs document proxy methods we need. */
interface PdfProxy {
  numPages: number;
  getOutline(): Promise<RawOutlineItem[] | null>;
  getDestination(dest: string): Promise<unknown[] | null>;
  getPageIndex(ref: unknown): Promise<number>;
}

interface RawOutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items: RawOutlineItem[];
}

/** Recursively resolve outline destinations to 1-based page numbers. */
async function resolveOutline(
  pdf: PdfProxy,
  items: RawOutlineItem[]
): Promise<OutlineItem[]> {
  const result: OutlineItem[] = [];
  for (const item of items) {
    let pageNumber: number | null = null;
    try {
      let dest = item.dest;
      if (typeof dest === "string") {
        dest = await pdf.getDestination(dest);
      }
      if (Array.isArray(dest) && dest[0]) {
        const pageIndex = await pdf.getPageIndex(dest[0]);
        pageNumber = pageIndex + 1;
      }
    } catch {
      // destination could not be resolved — leave as null
    }

    const children = item.items?.length
      ? await resolveOutline(pdf, item.items)
      : [];

    result.push({ title: item.title, page: pageNumber, children });
  }
  return result;
}

export interface PdfViewerHandle {
  scrollToPage: (page: number) => void;
}

interface PdfViewerProps {
  onPageChange: (page: number) => void;
  onTotalPagesChange: (total: number) => void;
  onOutlineLoaded?: (items: OutlineItem[]) => void;
  comments: Comment[];
  activeCommentId: string | null;
  onSelection: (event: SelectionEvent) => void;
  onHighlightClick: (commentId: string) => void;
}

function highlightColor(isActive: boolean, resolved: boolean): string {
  if (isActive) return "rgba(251,191,36,0.65)";
  if (resolved) return "rgba(156,163,175,0.35)";
  return "rgba(251,191,36,0.30)";
}

const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(
  function PdfViewer(
    { onPageChange, onTotalPagesChange, onOutlineLoaded, comments, activeCommentId, onSelection, onHighlightClick },
    ref
  ) {
    const [numPages, setNumPages] = useState(0);
    const [pageWidth, setPageWidth] = useState(680);
    const [docError, setDocError] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const pageVisibilitiesRef = useRef<Map<number, number>>(new Map());
    const onPageChangeRef = useRef(onPageChange);
    onPageChangeRef.current = onPageChange;

    // Expose scrollToPage to parent via ref
    useImperativeHandle(ref, () => ({
      scrollToPage(page: number) {
        const el = scrollRef.current?.querySelector<HTMLElement>(
          `[data-page="${page}"]`
        );
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    }));

    // Responsive width: fill the scroll container
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;
      const update = () => {
        setPageWidth(Math.min(container.clientWidth - 32, 820));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(container);
      return () => ro.disconnect();
    }, []);

    // IntersectionObserver: detect the most-visible page while scrolling
    useEffect(() => {
      if (numPages === 0 || !scrollRef.current) return;
      const root = scrollRef.current;
      const thresholds = Array.from({ length: 11 }, (_, i) => i * 0.1);

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const pn = parseInt(
              (entry.target as HTMLElement).dataset.page ?? "1",
              10
            );
            pageVisibilitiesRef.current.set(pn, entry.intersectionRatio);
          }

          let best = 1;
          let bestRatio = -1;
          pageVisibilitiesRef.current.forEach((ratio, page) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = page;
            }
          });

          if (bestRatio > 0) onPageChangeRef.current(best);
        },
        { root, threshold: thresholds }
      );

      const els = root.querySelectorAll("[data-page]");
      els.forEach((el) => observer.observe(el));

      return () => observer.disconnect();
    }, [numPages]);

    // Text-selection handler — uses DOM tree walking so each text fragment
    // is mapped to its real page container via ancestry, not viewport coords.
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;

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

          // Walk every text node inside the selection's common ancestor.
          const ancestor = range.commonAncestorContainer;
          const walkRoot =
            ancestor.nodeType === Node.ELEMENT_NODE
              ? (ancestor as HTMLElement)
              : ancestor.parentElement;
          if (!walkRoot || !root.contains(walkRoot)) return;

          const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT);
          let node: Node | null;

          while ((node = walker.nextNode())) {
            const textNode = node as Text;

            // Only consider text nodes that overlap the selection
            if (!range.intersectsNode(textNode)) continue;
            if (!textNode.textContent || textNode.textContent.trim().length === 0) continue;

            // Resolve the owning page from the DOM tree itself
            const pageEl = textNode.parentElement?.closest<HTMLElement>("[data-page]");
            if (!pageEl || !root.contains(pageEl)) continue;

            const pageNum = parseInt(pageEl.dataset.page!, 10);
            if (isNaN(pageNum)) continue;

            // Build a sub-range covering only the selected portion of this node
            const subRange = document.createRange();
            if (range.startContainer === textNode) {
              subRange.setStart(textNode, range.startOffset);
            } else {
              subRange.setStart(textNode, 0);
            }
            if (range.endContainer === textNode) {
              subRange.setEnd(textNode, range.endOffset);
            } else {
              subRange.setEnd(textNode, textNode.length);
            }

            // Page bounding rect (cached)
            let pageRect = pageRectCache.get(pageEl);
            if (!pageRect) {
              pageRect = pageEl.getBoundingClientRect();
              pageRectCache.set(pageEl, pageRect);
            }

            // Convert each visual rect to page-relative percentages
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

              // Clamp to page bounds
              const x2 = Math.min(hr.x + hr.width, 100);
              const y2 = Math.min(hr.y + hr.height, 100);
              hr.x = Math.max(hr.x, 0);
              hr.y = Math.max(hr.y, 0);
              hr.width = x2 - hr.x;
              hr.height = y2 - hr.y;

              // Discard degenerate or implausibly large rects
              if (hr.width <= 0 || hr.height <= 0) continue;
              if (hr.width > 95 && hr.height > 40) continue;

              highlightRects.push(hr);
              if (primaryPage === null) primaryPage = pageNum;
            }
          }

          if (highlightRects.length === 0 || primaryPage === null) return;

          const rangeBRect = range.getBoundingClientRect();
          onSelection({
            selectionData: { page: primaryPage, quote, highlightRects },
            popoverTop: rangeBRect.bottom + 8,
            popoverLeft: rangeBRect.left + rangeBRect.width / 2,
          });
        }, 20);
      }

      container.addEventListener("mouseup", onMouseUp);
      return () => container.removeEventListener("mouseup", onMouseUp);
    }, [onSelection]);

    const onLoadSuccess = useCallback(
      (pdf: PdfProxy) => {
        setNumPages(pdf.numPages);
        onTotalPagesChange(pdf.numPages);
        setDocError(null);

        // Extract PDF outline / bookmarks asynchronously
        if (onOutlineLoaded) {
          pdf
            .getOutline()
            .then(async (raw) => {
              if (raw && raw.length > 0) {
                const resolved = await resolveOutline(pdf, raw);
                onOutlineLoaded(resolved);
              } else {
                onOutlineLoaded([]);
              }
            })
            .catch(() => onOutlineLoaded([]));
        }
      },
      [onTotalPagesChange, onOutlineLoaded]
    );

    const onLoadError = useCallback((err: Error) => {
      console.error("PDF load error:", err);
      setDocError("Die PDF-Datei konnte nicht geladen werden.");
    }, []);

    // Click handler: detect clicks on highlight rects
    function handlePageClick(
      e: React.MouseEvent<HTMLDivElement>,
      pageNum: number
    ) {
      const pageEl = e.currentTarget;
      const pageRect = pageEl.getBoundingClientRect();
      const x = ((e.clientX - pageRect.left) / pageRect.width) * 100;
      const y = ((e.clientY - pageRect.top) / pageRect.height) * 100;

      for (const comment of comments) {
        if (!comment.highlightRects?.length) continue;
        for (const rect of comment.highlightRects) {
          // Use per-rect page if available, otherwise fall back to comment.page
          if ((rect.page ?? comment.page) !== pageNum) continue;
          if (
            x >= rect.x &&
            x <= rect.x + rect.width &&
            y >= rect.y &&
            y <= rect.y + rect.height
          ) {
            onHighlightClick(comment._id);
            return;
          }
        }
      }
    }

    if (docError) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-10 text-center">
          <svg
            className="w-10 h-10 text-red-400 dark:text-red-500 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{docError}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Lege die Datei unter <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">protected-assets/document.pdf</code> ab.
          </p>
        </div>
      );
    }

    return (
      <div
        ref={scrollRef}
        className="overflow-y-auto bg-gray-200 dark:bg-gray-900 rounded-xl max-h-full"
        style={{ height: "calc(100vh - 68px)" }}
      >
        <Document
          file="/api/document"
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading={
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
              <p className="text-sm text-gray-500 dark:text-gray-400">PDF wird geladen…</p>
            </div>
          }
        >
          {numPages > 0 &&
            Array.from({ length: numPages }, (_, i) => {
              const pageNum = i + 1;

              // Collect highlight rects that belong to this specific page.
              // Each rect carries its own .page (new data) or falls back to
              // comment.page (old data without per-rect page field).
              const pageHighlights: { comment: Comment; rects: HighlightRect[] }[] = [];
              for (const c of comments) {
                if (!c.highlightRects?.length) continue;
                const rects = c.highlightRects.filter((r) => {
                  const rp = r.page ?? c.page;
                  if (rp !== pageNum) return false;
                  // Defensive: discard degenerate or full-page rects
                  if (r.width <= 0 || r.height <= 0) return false;
                  if (r.width > 95 && r.height > 40) return false;
                  return true;
                });
                if (rects.length > 0) pageHighlights.push({ comment: c, rects });
              }

              return (
                <div
                  key={pageNum}
                  data-page={pageNum}
                  className="relative mx-auto my-3 bg-white shadow-sm cursor-default"
                  style={{ width: pageWidth }}
                  onClick={(e) => handlePageClick(e, pageNum)}
                >
                  <Page
                    pageNumber={pageNum}
                    width={pageWidth}
                    renderTextLayer
                    renderAnnotationLayer
                    loading={
                      <div
                        className="bg-white dark:bg-gray-800 flex items-center justify-center"
                        style={{ height: Math.round(pageWidth * 1.414) }}
                      >
                        <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
                      </div>
                    }
                  />

                  {/* Highlight overlays — pointer-events:none so PDF links and text selection work */}
                  {pageHighlights.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {pageHighlights.map(({ comment, rects }) =>
                        rects.map((rect, ri) => (
                          <div
                            key={`${comment._id}-${ri}`}
                            className="absolute transition-colors duration-150"
                            style={{
                              left: `${rect.x}%`,
                              top: `${rect.y}%`,
                              width: `${rect.width}%`,
                              height: `${rect.height}%`,
                              backgroundColor: highlightColor(
                                comment._id === activeCommentId,
                                comment.resolved
                              ),
                              mixBlendMode: "multiply",
                            }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </Document>
      </div>
    );
  }
);

export default PdfViewer;
