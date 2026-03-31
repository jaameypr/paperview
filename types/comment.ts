/** Shared comment types — used by API routes, components, and models. */

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

/** PDF-specific comment target */
export interface PdfTarget {
  type: "pdf";
  page: number;
  selectedText?: string;
  highlightRects?: HighlightRect[];
}

/** Code-specific comment target */
export interface CodeTarget {
  type: "code";
  language?: string;
  lineStart: number;
  lineEnd: number;
  selectedText?: string;
  /** Character offsets within the line (exclusive end), set for single-line selections. */
  charStart?: number;
  charEnd?: number;
}

/** Text/Markdown comment target */
export interface TextTarget {
  type: "text";
  lineStart: number;
  lineEnd: number;
  selectedText?: string;
  /** Character offsets within the line (exclusive end), set for single-line selections. */
  charStart?: number;
  charEnd?: number;
}

/** General comment (no specific location) */
export interface GeneralTarget {
  type: "general";
}

export type CommentTarget = PdfTarget | CodeTarget | TextTarget | GeneralTarget;

export interface Reply {
  _id: string;
  authorId: string | null;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Comment {
  _id: string;
  shareId: string;
  shareVersionId: string;
  authorId: string | null;
  authorName: string;
  text: string;
  target: CommentTarget;
  resolved: boolean;
  replies: Reply[];
  createdAt: string;
  updatedAt: string;
}

/** PDF selection data */
export interface SelectionData {
  page: number;
  quote: string;
  highlightRects: HighlightRect[];
}

export interface SelectionEvent {
  selectionData: SelectionData;
  popoverTop: number;
  popoverLeft: number;
}

/** Line-based selection data (code / text viewers) */
export interface LineSelectionData {
  lineStart: number;
  lineEnd: number;
  quote: string;
  /** Character offsets within the line, only set for single-line selections. */
  charStart?: number;
  charEnd?: number;
}

export interface LineSelectionEvent {
  selectionData: LineSelectionData;
  popoverTop: number;
  popoverLeft: number;
}

/** Union used by CommentPanel — accepts either PDF or line selection */
export type AnySelectionData = SelectionData | LineSelectionData;
