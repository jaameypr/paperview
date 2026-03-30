/** Shared comment types – used by API routes, components, and models. */

export interface HighlightRect {
  /** Percentage of page width */
  x: number;
  /** Percentage of page height */
  y: number;
  width: number;
  height: number;
  /** 1-based page number this rect belongs to (added for cross-page selections).
   *  Falls back to Comment.page for old data where this field is absent. */
  page?: number;
}

export interface Reply {
  _id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Comment {
  _id: string;
  author: string;
  page: number;
  text: string;
  /** The text that was selected in the PDF (optional) */
  quote?: string;
  /** Position data for re-rendering the highlight (optional) */
  highlightRects?: HighlightRect[];
  resolved: boolean;
  replies: Reply[];
  createdAt: string;
  updatedAt: string;
}

/** Data captured when the user selects text in the PDF */
export interface SelectionData {
  page: number;
  quote: string;
  highlightRects: HighlightRect[];
}

/** Event passed from PdfViewer to DocClient when text is selected */
export interface SelectionEvent {
  selectionData: SelectionData;
  /** Viewport-relative Y coordinate just below the selection */
  popoverTop: number;
  /** Viewport-relative X coordinate at center of selection */
  popoverLeft: number;
}
