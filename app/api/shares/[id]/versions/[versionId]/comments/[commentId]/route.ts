import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";
import { getAccessLevel, hasAccess } from "@/lib/access";
import { emit, shareVersionChannel } from "@/lib/sse";
import Share from "@/models/Share";
import Comment from "@/models/Comment";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string; commentId: string }> }
) {
  try {
    const { id, versionId, commentId } = await params;
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const access = await getAccessLevel(share, auth);
    if (!hasAccess(access, "commenter")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const comment = await Comment.findById(commentId);
    if (!comment || String(comment.shareId) !== id || String(comment.shareVersionId) !== versionId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const body: unknown = await request.json();
    if (body && typeof body === "object" && "resolved" in body) {
      comment.resolved = !!(body as { resolved: boolean }).resolved;
    }

    await comment.save();

    emit(shareVersionChannel(id, versionId), "comment:updated", {
      _id: String(comment._id),
      resolved: comment.resolved,
    });

    return NextResponse.json({ success: true, resolved: comment.resolved });
  } catch (err) {
    console.error("[PATCH comment]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string; commentId: string }> }
) {
  try {
    const { id, versionId, commentId } = await params;
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const access = await getAccessLevel(share, auth);
    if (!hasAccess(access, "commenter")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const comment = await Comment.findById(commentId);
    if (!comment || String(comment.shareId) !== id || String(comment.shareVersionId) !== versionId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    await comment.deleteOne();

    emit(shareVersionChannel(id, versionId), "comment:deleted", { _id: commentId });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE comment]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
