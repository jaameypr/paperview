import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME, hashSharePassword } from "@/lib/auth";
import { getAccessLevel, hasAccess, isExpired } from "@/lib/access";
import Share from "@/models/Share";
import ShareVersion from "@/models/ShareVersion";
import ShareCollaborator from "@/models/ShareCollaborator";
import Comment from "@/models/Comment";
import User from "@/models/User";
import { deleteFile } from "@/lib/storage";

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

    // For password-protected shares where password hasn't been provided
    if (access === "none" && share.visibility === "public_password") {
      return NextResponse.json({
        passwordRequired: true,
        share: { _id: String(share._id), title: share.title, visibility: share.visibility },
      });
    }

    if (!hasAccess(access, "viewer")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (isExpired(share) && access !== "owner" && access !== "admin") {
      return NextResponse.json({ error: "Share has expired" }, { status: 410 });
    }

    const owner = await User.findById(share.ownerId).select("username").lean();
    const versions = await ShareVersion.find({ shareId: share._id })
      .sort({ versionNumber: -1 })
      .lean();
    const commentCounts = await Comment.aggregate([
      { $match: { shareId: share._id } },
      { $group: { _id: "$shareVersionId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));

    const versionCreatorIds = [...new Set(versions.map((v) => String(v.createdByUserId)))];
    const creators = await User.find({ _id: { $in: versionCreatorIds } }).select("username").lean();
    const creatorMap = new Map(creators.map((c) => [String(c._id), c.username]));

    return NextResponse.json({
      share: {
        _id: String(share._id),
        ownerId: String(share.ownerId),
        ownerName: owner?.username ?? "Unknown",
        title: share.title,
        description: share.description,
        kind: share.kind,
        visibility: share.visibility,
        hasPassword: !!share.passwordHash,
        expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
        currentVersionId: share.currentVersionId ? String(share.currentVersionId) : null,
        commentsEnabled: share.commentsEnabled,
        previewMode: share.previewMode,
        downloadEnabled: share.downloadEnabled,
        createdAt: share.createdAt.toISOString(),
        updatedAt: share.updatedAt.toISOString(),
      },
      versions: versions.map((v) => ({
        _id: String(v._id),
        shareId: String(v.shareId),
        versionNumber: v.versionNumber,
        createdByUserId: String(v.createdByUserId),
        createdByName: creatorMap.get(String(v.createdByUserId)) ?? "Unknown",
        createdAt: v.createdAt.toISOString(),
        changeNote: v.changeNote,
        contentType: v.contentType,
        originalFilename: v.originalFilename,
        fileSize: v.fileSize,
        metadata: v.metadata,
        restoredFromVersionId: v.restoredFromVersionId ? String(v.restoredFromVersionId) : null,
        commentCount: countMap.get(String(v._id)) ?? 0,
      })),
      access,
    });
  } catch (err) {
    console.error("[GET /api/shares/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const updates = body as Record<string, unknown>;
    if (typeof updates.title === "string") share.title = updates.title.trim();
    if (typeof updates.description === "string") share.description = updates.description.trim();
    if (typeof updates.commentsEnabled === "boolean") share.commentsEnabled = updates.commentsEnabled;
    if (typeof updates.downloadEnabled === "boolean") share.downloadEnabled = updates.downloadEnabled;
    if (typeof updates.visibility === "string" && ["private", "public", "public_password"].includes(updates.visibility)) {
      share.visibility = updates.visibility as "private" | "public" | "public_password";
    }
    if (typeof updates.previewMode === "string" && ["viewer", "viewer_comments", "download_only"].includes(updates.previewMode)) {
      share.previewMode = updates.previewMode as "viewer" | "viewer_comments" | "download_only";
    }
    if (updates.expiresAt === null) {
      share.expiresAt = null;
    } else if (typeof updates.expiresAt === "string") {
      share.expiresAt = new Date(updates.expiresAt);
    }
    if (typeof updates.password === "string" && updates.password.trim()) {
      share.passwordHash = await hashSharePassword(updates.password as string);
    } else if (updates.password === null) {
      share.passwordHash = null;
    }

    await share.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/shares/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
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
    if (!hasAccess(access, "owner")) {
      return NextResponse.json({ error: "Only owners and admins can delete shares" }, { status: 403 });
    }

    // Delete all version files
    const versions = await ShareVersion.find({ shareId: share._id }).lean();
    for (const v of versions) {
      await deleteFile(v.storageKey);
    }

    await ShareVersion.deleteMany({ shareId: share._id });
    await ShareCollaborator.deleteMany({ shareId: share._id });
    await Comment.deleteMany({ shareId: share._id });
    await share.deleteOne();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/shares/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
