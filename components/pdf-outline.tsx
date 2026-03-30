"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { OutlineItem } from "@/types/outline";

interface PdfOutlineProps {
  items: OutlineItem[];
  currentPage: number;
  onNavigate: (page: number) => void;
  onClose: () => void;
}

/** Flatten the outline tree into a DFS-ordered list (for active-item lookup). */
function flattenItems(items: OutlineItem[]): OutlineItem[] {
  const result: OutlineItem[] = [];
  function walk(list: OutlineItem[]) {
    for (const item of list) {
      result.push(item);
      walk(item.children);
    }
  }
  walk(items);
  return result;
}

// ── Single outline node (recursive) ──────────────────────────────────────────

function OutlineNode({
  item,
  depth,
  activeItem,
  onNavigate,
}: {
  item: OutlineItem;
  depth: number;
  activeItem: OutlineItem | null;
  onNavigate: (page: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const itemRef = useRef<HTMLDivElement>(null);
  const isActive = item === activeItem;
  const hasChildren = item.children.length > 0;

  // Scroll the active item into view inside the sidebar
  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  return (
    <div ref={itemRef}>
      <div
        className={`flex items-center w-full text-left rounded-lg transition-colors cursor-pointer group ${
          isActive
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {/* Expand / collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="w-5 h-5 flex items-center justify-center shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            aria-label={expanded ? "Einklappen" : "Ausklappen"}
          >
            <svg
              className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Title */}
        <button
          onClick={() => item.page && onNavigate(item.page)}
          disabled={!item.page}
          className="flex-1 min-w-0 text-left py-1.5 pr-1 text-[13px] leading-snug truncate disabled:opacity-50 disabled:cursor-default"
          title={item.title}
        >
          {item.title}
        </button>

        {/* Page number */}
        {item.page && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 pr-2 shrink-0 tabular-nums">
            {item.page}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {item.children.map((child, i) => (
            <OutlineNode
              key={i}
              item={child}
              depth={depth + 1}
              activeItem={activeItem}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main sidebar component ───────────────────────────────────────────────────

export default function PdfOutline({
  items,
  currentPage,
  onNavigate,
  onClose,
}: PdfOutlineProps) {
  // Last outline item (DFS) whose page ≤ currentPage
  const activeItem = useMemo(() => {
    const flat = flattenItems(items);
    let best: OutlineItem | null = null;
    for (const item of flat) {
      if (item.page !== null && item.page <= currentPage) {
        best = item;
      }
    }
    return best;
  }, [items, currentPage]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5h11M9 12h11M9 19h11M5 5v.01M5 12v.01M5 19v.01"
            />
          </svg>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Inhalt
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Sidebar schließen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <svg
              className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Keine Dokumentstruktur vorhanden
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
              Das PDF enthält keine Lesezeichen.
            </p>
          </div>
        ) : (
          <nav aria-label="Dokumentstruktur">
            {items.map((item, i) => (
              <OutlineNode
                key={i}
                item={item}
                depth={0}
                activeItem={activeItem}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
