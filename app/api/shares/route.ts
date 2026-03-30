import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME, hashSharePassword } from "@/lib/auth";
import { saveFile } from "@/lib/storage";
import Share from "@/models/Share";
import ShareVersion from "@/models/ShareVersion";
import ShareCollaborator from "@/models/ShareCollaborator";
import User from "@/models/User";
import { getKindFromExtension } from "@/types/share";
import { bootstrapAdmin } from "@/lib/bootstrap";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    await bootstrapAdmin();

    let shares;
    if (auth.role === "admin") {
      shares = await Share.find().sort({ updatedAt: -1 }).lean();
    } else {
      const collabs = await ShareCollaborator.find({ userId: auth.userId }).lean();
      const collabShareIds = collabs.map((c) => c.shareId);
      shares = await Share.find({
        $or: [{ ownerId: auth.userId }, { _id: { $in: collabShareIds } }],
      })
        .sort({ updatedAt: -1 })
        .lean();
    }

    const ownerIds = [...new Set(shares.map((s) => String(s.ownerId)))];
    const owners = await User.find({ _id: { $in: ownerIds } }).select("username").lean();
    const ownerMap = new Map(owners.map((o) => [String(o._id), o.username]));

    return NextResponse.json({
      shares: shares.map((s) => ({
        _id: String(s._id),
        ownerId: String(s.ownerId),
        ownerName: ownerMap.get(String(s.ownerId)) ?? "Unknown",
        title: s.title,
        description: s.description,
        kind: s.kind,
        visibility: s.visibility,
        hasPassword: !!s.passwordHash,
        expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
        currentVersionId: s.currentVersionId ? String(s.currentVersionId) : null,
        commentsEnabled: s.commentsEnabled,
        previewMode: s.previewMode,
        downloadEnabled: s.downloadEnabled,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET /api/shares]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const description = (formData.get("description") as string) ?? "";
    const visibility = (formData.get("visibility") as string) ?? "private";
    const password = formData.get("password") as string | null;
    const expiresAt = formData.get("expiresAt") as string | null;
    const commentsEnabled = formData.get("commentsEnabled") !== "false";
    const previewMode = (formData.get("previewMode") as string) ?? "viewer_comments";
    const downloadEnabled = formData.get("downloadEnabled") !== "false";
    const changeNote = (formData.get("changeNote") as string) ?? "";

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const kind = getKindFromExtension(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey, checksum, size } = await saveFile(buffer, file.name);

    const passwordHash = password && password.trim()
      ? await hashSharePassword(password.trim())
      : null;

    const share = await Share.create({
      ownerId: auth.userId,
      title: title.trim(),
      description: description.trim(),
      kind,
      visibility: ["private", "public", "public_password"].includes(visibility) ? visibility : "private",
      passwordHash,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      commentsEnabled,
      previewMode: ["viewer", "viewer_comments", "download_only"].includes(previewMode) ? previewMode : "viewer_comments",
      downloadEnabled,
    });

    const version = await ShareVersion.create({
      shareId: share._id,
      versionNumber: 1,
      createdByUserId: auth.userId,
      changeNote: changeNote.trim(),
      contentType: file.type || "application/octet-stream",
      originalFilename: file.name,
      storageKey,
      fileSize: size,
      checksum,
      metadata: {},
    });

    share.currentVersionId = version._id as typeof share.currentVersionId;
    await share.save();

    return NextResponse.json(
      {
        share: {
          _id: String(share._id),
          title: share.title,
          kind: share.kind,
          currentVersionId: String(version._id),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/shares]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
