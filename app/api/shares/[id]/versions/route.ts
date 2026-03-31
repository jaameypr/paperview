import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";
import { getAccessLevel, hasAccess } from "@/lib/access";
import { saveFile, readFile } from "@/lib/storage";
import { emit, shareChannel } from "@/lib/sse";
import { getKindFromExtension } from "@/types/share";
import ShareVersion from "@/models/ShareVersion";
import Share from "@/models/Share";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);

    await connectToDatabase();
    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const access = await getAccessLevel(share, auth, cookieStore);
    if (!hasAccess(access, "viewer")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const versions = await ShareVersion.find({ shareId: id }).sort({ versionNumber: -1 }).lean();

    return NextResponse.json({
      versions: versions.map((v) => ({
        _id: String(v._id),
        versionNumber: v.versionNumber,
        createdAt: v.createdAt.toISOString(),
        changeNote: v.changeNote,
        contentType: v.contentType,
        originalFilename: v.originalFilename,
        fileSize: v.fileSize,
        restoredFromVersionId: v.restoredFromVersionId ? String(v.restoredFromVersionId) : null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/shares/:id/versions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const access = await getAccessLevel(share, auth);
    if (!hasAccess(access, "editor")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const lastVersion = await ShareVersion.findOne({ shareId: id }).sort({ versionNumber: -1 });
    const nextNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

    const formData = await request.formData();
    const restoreFromId = formData.get("restoreFromVersionId") as string | null;
    const changeNote = (formData.get("changeNote") as string) ?? "";

    let storageKey: string;
    let checksum: string;
    let fileSize: number;
    let contentType: string;
    let originalFilename: string;
    let restoredFromVersionId: string | null = null;

    if (restoreFromId) {
      // Restore: copy content from an old version
      const oldVersion = await ShareVersion.findById(restoreFromId);
      if (!oldVersion || String(oldVersion.shareId) !== id) {
        return NextResponse.json({ error: "Source version not found" }, { status: 404 });
      }
      const buffer = await readFile(oldVersion.storageKey);
      const saved = await saveFile(buffer, oldVersion.originalFilename);
      storageKey = saved.storageKey;
      checksum = saved.checksum;
      fileSize = saved.size;
      contentType = oldVersion.contentType;
      originalFilename = oldVersion.originalFilename;
      restoredFromVersionId = restoreFromId;
    } else {
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = await saveFile(buffer, file.name);
      storageKey = saved.storageKey;
      checksum = saved.checksum;
      fileSize = saved.size;
      contentType = file.type || "application/octet-stream";
      originalFilename = file.name;
    }

    const version = await ShareVersion.create({
      shareId: id,
      versionNumber: nextNumber,
      createdByUserId: auth.userId,
      changeNote: changeNote.trim(),
      contentType,
      originalFilename,
      storageKey,
      fileSize,
      checksum,
      metadata: {},
      restoredFromVersionId,
    });

    share.currentVersionId = version._id as typeof share.currentVersionId;
    if (!restoreFromId) {
      share.kind = getKindFromExtension(originalFilename);
    }
    await share.save();

    emit(shareChannel(id), "version:created", {
      versionId: String(version._id),
      versionNumber: nextNumber,
      kind: share.kind,
    });

    return NextResponse.json(
      { version: { _id: String(version._id), versionNumber: nextNumber } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/shares/:id/versions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
