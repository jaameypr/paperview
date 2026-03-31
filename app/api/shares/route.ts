import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { hashSharePassword } from "@/lib/auth";
import { getRequestAuth } from "@/lib/apiAuth";
import { saveFile } from "@/lib/storage";
import Share from "@/models/Share";
import ShareVersion from "@/models/ShareVersion";
import ShareCollaborator from "@/models/ShareCollaborator";
import User from "@/models/User";
import { getKindFromExtension } from "@/types/share";
import { bootstrapAdmin } from "@/lib/bootstrap";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
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
    const auth = await getRequestAuth(request);
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

    // Support either file upload or pasted text content
    const textContent = formData.get("content") as string | null;
    const textFilename = formData.get("filename") as string | null;

    let kind: ReturnType<typeof getKindFromExtension>;
    let storageKey: string;
    let checksum: string;
    let size: number;
    let contentType: string;
    let originalFilename: string;

    if (file) {
      if (file.size > 200 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (max 200 MB)" }, { status: 413 });
      }
      kind = getKindFromExtension(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      ({ storageKey, checksum, size } = await saveFile(buffer, file.name));
      contentType = file.type || "application/octet-stream";
      originalFilename = file.name;
    } else if (textContent !== null && textFilename) {
      if (Buffer.byteLength(textContent, "utf-8") > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Content too large (max 10 MB)" }, { status: 413 });
      }
      kind = getKindFromExtension(textFilename);
      const buffer = Buffer.from(textContent, "utf-8");
      ({ storageKey, checksum, size } = await saveFile(buffer, textFilename));
      contentType = "text/plain; charset=utf-8";
      originalFilename = textFilename;
    } else {
      return NextResponse.json({ error: "Either a file or text content with filename is required" }, { status: 400 });
    }

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
      contentType,
      originalFilename,
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
