"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/app-shell";

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

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  const canSubmit = title.trim() && (
    (inputMode === "file" && file) ||
    ((inputMode === "code" || inputMode === "text") && pasteContent.trim())
  );

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create New Share</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Input mode tabs */}
          <div>
            <label className={labelClass}>Content Source</label>
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
              {([
                { mode: "file" as const, label: "Upload File", icon: "📎" },
                { mode: "code" as const, label: "Paste Code", icon: "💻" },
                { mode: "text" as const, label: "Paste Text", icon: "📝" },
              ]).map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInputMode(mode)}
                  className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
                    inputMode === mode
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          {inputMode === "file" && (
            <div>
              <label className={labelClass}>File *</label>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
                }}
                className={inputClass}
              />
              {file && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          )}

          {/* Code paste */}
          {inputMode === "code" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Language *</label>
                  <select
                    value={pasteExtension}
                    onChange={(e) => setPasteExtension(e.target.value)}
                    className={inputClass}
                  >
                    {CODE_EXTENSIONS.map((l) => (
                      <option key={l.ext} value={l.ext}>{l.label} (.{l.ext})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Filename (optional)</label>
                  <input
                    type="text"
                    value={pasteFilename}
                    onChange={(e) => {
                      setPasteFilename(e.target.value);
                      if (e.target.value.trim() && !title.trim()) {
                        setTitle(e.target.value.trim().replace(/\.[^.]+$/, ""));
                      }
                    }}
                    placeholder={`e.g. main.${pasteExtension}`}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Code *</label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={12}
                  placeholder="Paste your code here…"
                  spellCheck={false}
                  className={inputClass + " font-mono text-xs resize-y"}
                />
              </div>
            </>
          )}

          {/* Text/markdown paste */}
          {inputMode === "text" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Format *</label>
                  <select
                    value={pasteExtension}
                    onChange={(e) => setPasteExtension(e.target.value)}
                    className={inputClass}
                  >
                    {TEXT_EXTENSIONS.map((t) => (
                      <option key={t.ext} value={t.ext}>{t.label} (.{t.ext})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Filename (optional)</label>
                  <input
                    type="text"
                    value={pasteFilename}
                    onChange={(e) => {
                      setPasteFilename(e.target.value);
                      if (e.target.value.trim() && !title.trim()) {
                        setTitle(e.target.value.trim().replace(/\.[^.]+$/, ""));
                      }
                    }}
                    placeholder={`e.g. notes.${pasteExtension}`}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Content *</label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  rows={12}
                  placeholder="Paste your text content here…"
                  className={inputClass + " resize-y" + (["json", "yaml", "xml", "toml", "csv", "env", "conf"].includes(pasteExtension) ? " font-mono text-xs" : "")}
                />
              </div>
            </>
          )}

          {/* Title */}
          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="Share title"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Optional description"
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Change note */}
          <div>
            <label className={labelClass}>
              Version note{" "}
              <span className="text-gray-400 dark:text-gray-500 font-normal">— optional</span>
            </label>
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. Initial upload"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            {loading ? "Creating…" : "Create Share"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
