import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getRequestAuth } from "@/lib/apiAuth";
import { getAccessLevel, hasAccess } from "@/lib/access";
import Share from "@/models/Share";
import ShareCollaborator from "@/models/ShareCollaborator";
import User from "@/models/User";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getRequestAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const access = await getAccessLevel(share, auth);
    if (!hasAccess(access, "editor")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const collabs = await ShareCollaborator.find({ shareId: id }).lean();
    const userIds = collabs.map((c) => c.userId);
    const users = await User.find({ _id: { $in: userIds } }).select("username email").lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    return NextResponse.json({
      collaborators: collabs.map((c) => ({
        _id: String(c._id),
        shareId: String(c.shareId),
        userId: String(c.userId),
        userName: userMap.get(String(c.userId))?.username ?? "Unknown",
        userEmail: userMap.get(String(c.userId))?.email ?? "",
        role: c.role,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET collaborators]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getRequestAuth(request);
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

    const { username, role } = body as { username?: string; role?: string };
    if (!username) return NextResponse.json({ error: "Username is required" }, { status: 400 });

    const user = await User.findOne({ username: username.trim() });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (String(user._id) === String(share.ownerId)) {
      return NextResponse.json({ error: "Owner is already a collaborator" }, { status: 400 });
    }

    const existing = await ShareCollaborator.findOne({ shareId: id, userId: user._id });
    if (existing) {
      existing.role = (role === "editor" || role === "commenter" || role === "viewer") ? role : "viewer";
      await existing.save();
      return NextResponse.json({ success: true });
    }

    await ShareCollaborator.create({
      shareId: id,
      userId: user._id,
      role: (role === "editor" || role === "commenter" || role === "viewer") ? role : "viewer",
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[POST collaborators]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getRequestAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const access = await getAccessLevel(share, auth);
    if (!hasAccess(access, "editor")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const { userId } = (body ?? {}) as { userId?: string };
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    await ShareCollaborator.deleteOne({ shareId: id, userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE collaborators]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
