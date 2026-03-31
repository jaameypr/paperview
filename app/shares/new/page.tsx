"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CODE_EXTENSIONS = [
  { ext: "js", label: "JavaScript" }, { ext: "ts", label: "TypeScript" },
  { ext: "jsx", label: "JSX" }, { ext: "tsx", label: "TSX" },
  { ext: "py", label: "Python" }, { ext: "java", label: "Java" },
  { ext: "cs", label: "C#" }, { ext: "cpp", label: "C++" },
  { ext: "c", label: "C" }, { ext: "go", label: "Go" },
  { ext: "rs", label: "Rust" }, { ext: "php", label: "PHP" },
  { ext: "rb", label: "Ruby" }, { ext: "swift", label: "Swift" },
  { ext: "kt", label: "Kotlin" }, { ext: "scala", label: "Scala" },
  { ext: "sh", label: "Shell" }, { ext: "sql", label: "SQL" },
  { ext: "html", label: "HTML" }, { ext: "css", label: "CSS" },
  { ext: "scss", label: "SCSS" },
];

const TEXT_EXTENSIONS = [
  { ext: "txt", label: "Plain Text" },
  { ext: "md", label: "Markdown" },
  { ext: "json", label: "JSON" },
  { ext: "yaml", label: "YAML" },
  { ext: "xml", label: "XML" },
  { ext: "toml", label: "TOML" },
  { ext: "csv", label: "CSV" },
  { ext: "log", label: "Log" },
  { ext: "env", label: "Env" },
  { ext: "conf", label: "Config" },
];

type InputMode = "file" | "code" | "text";

export default function NewSharePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>("file");

  // File mode
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Paste mode (code/text)
  const [pasteContent, setPasteContent] = useState("");
  const [pasteExtension, setPasteExtension] = useState("txt");
  const [pasteFilename, setPasteFilename] = useState("");

  const router = useRouter();

  function getFilenameForPaste(): string {
    if (pasteFilename.trim()) {
      // Ensure it has the right extension
      const base = pasteFilename.trim().replace(/\.[^.]+$/, "");
      return `${base}.${pasteExtension}`;
    }
    return `untitled.${pasteExtension}`;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }

    if (inputMode === "file" && !file) {
      setError("Please select a file.");
      return;
    }
    if ((inputMode === "code" || inputMode === "text") && !pasteContent.trim()) {
      setError("Please enter some content.");
      return;
    }

    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("changeNote", changeNote.trim());

    if (inputMode === "file") {
      formData.append("file", file!);
    } else {
      formData.append("content", pasteContent);
      formData.append("filename", getFilenameForPaste());
    }

    try {
      const res = await fetch("/api/shares", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        router.push(`/shares/${data.share._id}`);
      } else {
        setError(data.error ?? "Failed to create share");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = title.trim() && (
    (inputMode === "file" && file) ||
    ((inputMode === "code" || inputMode === "text") && pasteContent.trim())
  );

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create New Share</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Input mode tabs */}
          <div className="space-y-1.5">
            <Label>Content Source</Label>
            <div className="flex bg-muted rounded-lg p-1 gap-1">
              {([
                { mode: "file" as const, label: "Upload File", icon: "📎" },
                { mode: "code" as const, label: "Paste Code", icon: "💻" },
                { mode: "text" as const, label: "Paste Text", icon: "📝" },
              ]).map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInputMode(mode)}
                  className={cn(
                    "flex-1 py-1.5 px-3 text-sm rounded-md transition-colors",
                    inputMode === mode
                      ? "bg-background text-foreground shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          {inputMode === "file" && (
            <div className="space-y-1.5">
              <Label htmlFor="file-input">File <span className="text-destructive">*</span></Label>
              <Input
                id="file-input"
                ref={fileRef}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
                }}
                className="cursor-pointer"
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          )}

          {/* Code paste */}
          {inputMode === "code" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Language <span className="text-destructive">*</span></Label>
                  <Select value={pasteExtension} onValueChange={(v) => v && setPasteExtension(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODE_EXTENSIONS.map((l) => (
                        <SelectItem key={l.ext} value={l.ext}>{l.label} (.{l.ext})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paste-filename-code">Filename <span className="text-muted-foreground font-normal">— optional</span></Label>
                  <Input
                    id="paste-filename-code"
                    value={pasteFilename}
                    onChange={(e) => {
                      setPasteFilename(e.target.value);
                      if (e.target.value.trim() && !title.trim()) setTitle(e.target.value.trim().replace(/\.[^.]+$/, ""));
                    }}
                    placeholder={`e.g. main.${pasteExtension}`}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code-content">Code <span className="text-destructive">*</span></Label>
                <Textarea
                  id="code-content"
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={12}
                  placeholder="Paste your code here…"
                  spellCheck={false}
                  className="font-mono text-xs resize-y"
                />
              </div>
            </>
          )}

          {/* Text/markdown paste */}
          {inputMode === "text" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Format <span className="text-destructive">*</span></Label>
                  <Select value={pasteExtension} onValueChange={(v) => v && setPasteExtension(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEXT_EXTENSIONS.map((t) => (
                        <SelectItem key={t.ext} value={t.ext}>{t.label} (.{t.ext})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paste-filename-text">Filename <span className="text-muted-foreground font-normal">— optional</span></Label>
                  <Input
                    id="paste-filename-text"
                    value={pasteFilename}
                    onChange={(e) => {
                      setPasteFilename(e.target.value);
                      if (e.target.value.trim() && !title.trim()) setTitle(e.target.value.trim().replace(/\.[^.]+$/, ""));
                    }}
                    placeholder={`e.g. notes.${pasteExtension}`}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="text-content">Content <span className="text-destructive">*</span></Label>
                <Textarea
                  id="text-content"
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={12}
                  placeholder="Paste your text content here…"
                  className={cn(
                    "resize-y",
                    ["json","yaml","xml","toml","csv","env","conf"].includes(pasteExtension) && "font-mono text-xs"
                  )}
                />
              </div>
            </>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="Share title"
              className="h-9"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">— optional</span></Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Optional description"
              className="resize-none"
            />
          </div>

          {/* Version note */}
          <div className="space-y-1.5">
            <Label htmlFor="change-note">Version note <span className="text-muted-foreground font-normal">— optional</span></Label>
            <Input
              id="change-note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Initial upload"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading || !canSubmit} className="w-full h-9">
            {loading ? "Creating…" : "Create Share"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
