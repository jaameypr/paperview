export type ShareKind =
  | "pdf"
  | "code"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "markdown"
  | "data"       // json, yaml, xml, toml, csv
  | "office"
  | "archive"
  | "binary";

export type ShareVisibility = "private" | "public" | "public_password";

export type CollaboratorRole = "viewer" | "commenter" | "editor";

export type SharePreviewMode = "viewer" | "viewer_comments" | "download_only";

export interface ShareDTO {
  _id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  kind: ShareKind;
  visibility: ShareVisibility;
  hasPassword: boolean;
  expiresAt: string | null;
  currentVersionId: string | null;
  commentsEnabled: boolean;
  previewMode: SharePreviewMode;
  downloadEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShareVersionDTO {
  _id: string;
  shareId: string;
  versionNumber: number;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  changeNote: string;
  contentType: string;
  originalFilename: string;
  fileSize: number;
  metadata: Record<string, unknown>;
  restoredFromVersionId: string | null;
}

export interface CollaboratorDTO {
  _id: string;
  shareId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: CollaboratorRole;
  createdAt: string;
}

/** Maps file extensions to ShareKind */
export const EXTENSION_TO_KIND: Record<string, ShareKind> = {
  // PDF
  pdf: "pdf",
  // Code
  js: "code", ts: "code", jsx: "code", tsx: "code", py: "code", cs: "code",
  java: "code", cpp: "code", c: "code", go: "code", rs: "code", php: "code",
  rb: "code", swift: "code", kt: "code", scala: "code", sh: "code",
  bash: "code", ps1: "code", sql: "code", html: "code", css: "code",
  scss: "code",
  // Image
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image",
  // Video
  mp4: "video", webm: "video", ogg: "video",
  // Audio
  mp3: "audio", wav: "audio", m4a: "audio",
  // Text
  txt: "text", log: "text", env: "text", conf: "text",
  // Markdown
  md: "markdown", markdown: "markdown",
  // Data
  json: "data", yaml: "data", yml: "data", xml: "data", toml: "data", csv: "data",
  // Office
  docx: "office", xlsx: "office", pptx: "office", odt: "office", ods: "office", odp: "office",
  // Archive
  zip: "archive", "7z": "archive", rar: "archive", tar: "archive", gz: "archive",
};

/** Feature matrix per ShareKind */
export const KIND_FEATURES: Record<ShareKind, {
  preview: boolean;
  comments: boolean;
  download: boolean;
  versioning: boolean;
  description: string;
}> = {
  pdf:       { preview: true,  comments: true,  download: true,  versioning: true,  description: "PDF viewer with highlights, outline, and page-level comments" },
  code:      { preview: true,  comments: true,  download: true,  versioning: true,  description: "Syntax-highlighted code viewer with line-level comments" },
  image:     { preview: true,  comments: false, download: true,  versioning: true,  description: "Image viewer with zoom" },
  video:     { preview: true,  comments: false, download: true,  versioning: true,  description: "Video player" },
  audio:     { preview: true,  comments: false, download: true,  versioning: true,  description: "Audio player" },
  text:      { preview: true,  comments: true,  download: true,  versioning: true,  description: "Plain text viewer with line-level comments" },
  markdown:  { preview: true,  comments: true,  download: true,  versioning: true,  description: "Rendered Markdown viewer with comments" },
  data:      { preview: true,  comments: false, download: true,  versioning: true,  description: "Structured data viewer (JSON/YAML/XML/CSV)" },
  office:    { preview: false, comments: false, download: true,  versioning: true,  description: "Download only — Office documents" },
  archive:   { preview: false, comments: false, download: true,  versioning: true,  description: "Download only — Archives" },
  binary:    { preview: false, comments: false, download: true,  versioning: true,  description: "Download only — Unknown binary" },
};

export function getKindFromExtension(filename: string): ShareKind {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_KIND[ext] ?? "binary";
}

/** Get language identifier for code syntax highlighting */
export function getCodeLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", ts: "typescript", jsx: "javascript", tsx: "typescript",
    py: "python", cs: "csharp", java: "java", cpp: "cpp", c: "c",
    go: "go", rs: "rust", php: "php", rb: "ruby", swift: "swift",
    kt: "kotlin", scala: "scala", sh: "bash", bash: "bash", ps1: "powershell",
    sql: "sql", html: "html", css: "css", scss: "scss",
    json: "json", yaml: "yaml", yml: "yaml", xml: "xml", toml: "toml",
    md: "markdown", markdown: "markdown",
  };
  return map[ext] ?? "plaintext";
}
