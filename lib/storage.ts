import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const STORAGE_DIR = path.join(process.cwd(), "storage");

/** Ensure the storage directory exists */
async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

/** Validate that the resolved path stays within STORAGE_DIR */
function assertSafePath(filePath: string): void {
  if (!filePath.startsWith(STORAGE_DIR + path.sep) && filePath !== STORAGE_DIR) {
    throw new Error("Invalid storage key");
  }
}

/** Save a file buffer to storage. Returns the storage key. */
export async function saveFile(
  buffer: Buffer,
  originalFilename: string
): Promise<{ storageKey: string; checksum: string; size: number }> {
  await ensureStorageDir();
  const ext = path.extname(originalFilename);
  const storageKey = `${uuidv4()}${ext}`;
  const filePath = path.join(STORAGE_DIR, storageKey);
  assertSafePath(filePath);
  await fs.writeFile(filePath, buffer);

  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

  return { storageKey, checksum, size: buffer.length };
}

/** Read a file from storage by its storage key */
export async function readFile(storageKey: string): Promise<Buffer> {
  const filePath = path.join(STORAGE_DIR, storageKey);
  assertSafePath(filePath);
  return fs.readFile(filePath);
}

/** Read file as text (for code/text shares) */
export async function readFileAsText(storageKey: string): Promise<string> {
  const filePath = path.join(STORAGE_DIR, storageKey);
  assertSafePath(filePath);
  return fs.readFile(filePath, "utf-8");
}

/** Delete a file from storage */
export async function deleteFile(storageKey: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, storageKey);
  assertSafePath(filePath);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be deleted
  }
}

/** Get file stats */
export async function getFileStats(storageKey: string): Promise<{ size: number } | null> {
  const filePath = path.join(STORAGE_DIR, storageKey);
  assertSafePath(filePath);
  try {
    const stats = await fs.stat(filePath);
    return { size: stats.size };
  } catch {
    return null;
  }
}

/** Get absolute path to a stored file */
export function getFilePath(storageKey: string): string {
  const filePath = path.join(STORAGE_DIR, storageKey);
  assertSafePath(filePath);
  return filePath;
}

/** Get the temp directory for chunked uploads */
export function getChunkDir(): string {
  return path.join(STORAGE_DIR, "_chunks");
}

/**
 * Adopt a temp file (e.g. from chunked upload) into permanent storage.
 * Computes SHA-256 checksum via streaming — safe for multi-GB files.
 */
export async function saveFileFromPath(
  tempPath: string,
  originalFilename: string,
): Promise<{ storageKey: string; checksum: string; size: number }> {
  await ensureStorageDir();

  const ext = path.extname(originalFilename);
  const storageKey = `${uuidv4()}${ext}`;
  const destPath = path.join(STORAGE_DIR, storageKey);
  assertSafePath(destPath);

  // Stream checksum (no full-file buffering)
  const { createReadStream } = await import("fs");
  const checksum = await new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(tempPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });

  const stats = await fs.stat(tempPath);
  await fs.rename(tempPath, destPath);

  return { storageKey, checksum, size: stats.size };
}
