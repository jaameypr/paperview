import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getRequestAuth } from "@/lib/apiAuth";
import { getAccessLevel, hasAccess } from "@/lib/access";
import { emit, shareVersionChannel } from "@/lib/sse";
import Share from "@/models/Share";
import Comment from "@/models/Comment";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string; commentId: string }> }
) {
  try {
    const { id, versionId, commentId } = await params;
    const auth = await getRequestAuth(request);
    const cookieStore = await cookies();

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

    const { text, authorName } = body as { text?: string; authorName?: string };
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
    }

    const comment = await Comment.findById(commentId);
    if (!comment || String(comment.shareId) !== id || String(comment.shareVersionId) !== versionId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const reply = {
      authorId: auth?.userId ?? null,
      authorName: auth?.username ?? (typeof authorName === "string" ? authorName.trim() : "Anonymous"),
      text: text.trim(),
      createdAt: new Date(),
    };

    comment.replies.push(reply as never);
    await comment.save();

    const savedReply = comment.replies[comment.replies.length - 1];
    const replyDto = {
      _id: String(savedReply._id),
      authorId: savedReply.authorId ? String(savedReply.authorId) : null,
      authorName: savedReply.authorName,
      text: savedReply.text,
      createdAt: savedReply.createdAt.toISOString(),
    };

    emit(shareVersionChannel(id, versionId), "reply:created", {
      commentId,
      reply: replyDto,
    });

    return NextResponse.json({ reply: replyDto }, { status: 201 });
  } catch (err) {
    console.error("[POST reply]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
