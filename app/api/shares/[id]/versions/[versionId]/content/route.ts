import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readFile as readFileFromDisk } from "fs/promises";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";
import { getAccessLevel, hasAccess, isExpired } from "@/lib/access";
import { getFilePath, readFileAsText } from "@/lib/storage";
import Share from "@/models/Share";
import ShareVersion from "@/models/ShareVersion";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);

    await connectToDatabase();

    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const access = await getAccessLevel(share, auth, cookieStore);
    if (!hasAccess(access, "viewer")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (isExpired(share) && access !== "owner" && access !== "admin") {
      return NextResponse.json({ error: "Share has expired" }, { status: 410 });
    }

    const version = await ShareVersion.findById(versionId);
    if (!version || String(version.shareId) !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // For text-based content, return as JSON text
    const textTypes = ["text", "code", "markdown", "data"];
    if (textTypes.includes(share.kind)) {
      const text = await readFileAsText(version.storageKey);
      return NextResponse.json({ content: text, filename: version.originalFilename });
    }

    // For binary content (PDF, image, video, audio), stream the file
    const filePath = getFilePath(version.storageKey);
    const buffer = await readFileFromDisk(filePath);

    const rangeHeader = request.headers.get("range");
    if (rangeHeader && (share.kind === "video" || share.kind === "audio")) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
        const chunk = buffer.subarray(start, end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            "Content-Type": version.contentType,
            "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.length),
          },
        });
      }
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": version.contentType,
        "Content-Disposition": "inline",
        "Content-Length": String(buffer.length),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    console.error("[GET /api/shares/:id/versions/:versionId/content]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
