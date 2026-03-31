import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readFile as readFileFromDisk } from "fs/promises";
import { connectToDatabase } from "@/lib/mongodb";
import { getRequestAuth } from "@/lib/apiAuth";
import { getAccessLevel, hasAccess, isExpired } from "@/lib/access";
import { getFilePath } from "@/lib/storage";
import Share from "@/models/Share";
import ShareVersion from "@/models/ShareVersion";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;
    const auth = await getRequestAuth(request);
    const cookieStore = await cookies();

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

    if (!share.downloadEnabled && access !== "owner" && access !== "admin") {
      return NextResponse.json({ error: "Downloads not enabled" }, { status: 403 });
    }

    const version = await ShareVersion.findById(versionId);
    if (!version || String(version.shareId) !== id) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const filePath = getFilePath(version.storageKey);
    const buffer = await readFileFromDisk(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": version.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(version.originalFilename)}"`,
        "Content-Length": String(version.fileSize),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[GET /api/shares/:id/versions/:versionId/file]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
