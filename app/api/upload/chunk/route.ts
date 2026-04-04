import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/apiAuth";
import { getChunkDir } from "@/lib/storage";
import fs from "fs/promises";
import path from "path";

/**
 * Chunked upload endpoint — each chunk is saved as an individual file
 * so parallel uploads are race-condition-free.
 *
 * Headers: X-Upload-Id (UUID), X-Chunk-Index (0-based)
 * Body: raw binary chunk (application/octet-stream)
 *
 * Chunk files: {chunkDir}/{uploadId}/{chunkIndex}.chunk
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uploadId = request.headers.get("X-Upload-Id");
    const chunkIndexStr = request.headers.get("X-Chunk-Index");

    if (!uploadId || !/^[a-f0-9-]+$/i.test(uploadId)) {
      return NextResponse.json({ error: "Invalid Upload-Id" }, { status: 400 });
    }

    const chunkIndex = Number(chunkIndexStr ?? -1);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ error: "Invalid Chunk-Index" }, { status: 400 });
    }

    const body = request.body;
    if (!body) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }

    // Each upload gets its own subdirectory — no shared file, no races
    const uploadDir = path.join(getChunkDir(), uploadId);
    await fs.mkdir(uploadDir, { recursive: true });

    const chunkPath = path.join(uploadDir, `${chunkIndex}.chunk`);

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const buf = Buffer.concat(chunks);

    await fs.writeFile(chunkPath, buf);

    return NextResponse.json({ ok: true, chunkIndex });
  } catch (err) {
    console.error("[POST /api/upload/chunk]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
