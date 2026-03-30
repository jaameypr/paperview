import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readFile, stat } from "fs/promises";
import path from "path";
import { isAuthenticated, COOKIE_NAME } from "@/lib/auth";

const PDF_PATH = path.join(process.cwd(), "protected-assets", "document.pdf");

export async function GET(request: NextRequest) {
  // Defense-in-depth: verify auth in the route handler as well (proxy.ts already checked)
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!isAuthenticated(token)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const fileStats = await stat(PDF_PATH);
    const fileSize = fileStats.size;

    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      // Support HTTP Range requests so PDF.js can stream efficiently
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const clampedEnd = Math.min(end, fileSize - 1);
        const chunkSize = clampedEnd - start + 1;

        const buffer = await readFile(PDF_PATH);
        const chunk = buffer.slice(start, clampedEnd + 1);

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Range": `bytes ${start}-${clampedEnd}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Cache-Control": "private, no-store",
          },
        });
      }
    }

    // Full file response
    const buffer = await readFile(PDF_PATH);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        // Prevent the PDF from being saved or shared
        "Content-Disposition": "inline; filename=\"document.pdf\"",
      },
    });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        {
          error:
            "Dokument nicht gefunden. Bitte lege die PDF-Datei unter protected-assets/document.pdf ab.",
        },
        { status: 404 }
      );
    }
    console.error("[GET /api/document]", err);
    return NextResponse.json(
      { error: "Fehler beim Laden des Dokuments" },
      { status: 500 }
    );
  }
}
