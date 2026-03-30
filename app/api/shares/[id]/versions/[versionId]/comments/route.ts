import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";
import { getAccessLevel, hasAccess } from "@/lib/access";
import { emit, shareVersionChannel } from "@/lib/sse";
import Share from "@/models/Share";
import Comment from "@/models/Comment";

export async function GET(
  _request: NextRequest,
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

    const comments = await Comment.find({ shareId: id, shareVersionId: versionId })
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      comments: comments.map((c) => ({
        _id: String(c._id),
        shareId: String(c.shareId),
        shareVersionId: String(c.shareVersionId),
        authorId: c.authorId ? String(c.authorId) : null,
        authorName: c.authorName,
        text: c.text,
        target: c.target,
        resolved: c.resolved,
        replies: c.replies.map((r) => ({
          _id: String(r._id),
          authorId: r.authorId ? String(r.authorId) : null,
          authorName: r.authorName,
          text: r.text,
          createdAt: r.createdAt.toISOString(),
        })),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET comments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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

    if (!share.commentsEnabled) {
      return NextResponse.json({ error: "Comments are disabled" }, { status: 403 });
    }

    const access = await getAccessLevel(share, auth, cookieStore);
    if (!hasAccess(access, "commenter")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { text, target, authorName } = body as {
      text?: string;
      target?: unknown;
      authorName?: string;
    };

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
    }

    if (!target || typeof target !== "object" || !("type" in (target as Record<string, unknown>))) {
      return NextResponse.json({ error: "Comment target is required" }, { status: 400 });
    }

    const comment = await Comment.create({
      shareId: id,
      shareVersionId: versionId,
      authorId: auth?.userId ?? null,
      authorName: auth?.username ?? (typeof authorName === "string" ? authorName.trim() : "Anonymous"),
      text: text.trim(),
      target,
    });

    const dto = {
      _id: String(comment._id),
      shareId: String(comment.shareId),
      shareVersionId: String(comment.shareVersionId),
      authorId: comment.authorId ? String(comment.authorId) : null,
      authorName: comment.authorName,
      text: comment.text,
      target: comment.target,
      resolved: comment.resolved,
      replies: [],
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };

    emit(shareVersionChannel(id, versionId), "comment:created", dto);

    return NextResponse.json({ comment: dto }, { status: 201 });
  } catch (err) {
    console.error("[POST comments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
