import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, hashPassword, COOKIE_NAME } from "@/lib/auth";
import User from "@/models/User";

function requireAdmin(auth: { role: string } | null) {
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

/** PATCH /api/admin/users/:id — Update user (deactivate, change role, reset password) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    const denied = requireAdmin(auth);
    if (denied) return denied;

    const { id } = await params;
    await connectToDatabase();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const updates = body as {
      isActive?: boolean;
      role?: string;
      newPassword?: string;
      email?: string;
    };

    if (typeof updates.isActive === "boolean") {
      user.isActive = updates.isActive;
    }
    if (updates.role === "admin" || updates.role === "user") {
      user.role = updates.role;
    }
    if (typeof updates.email === "string") {
      user.email = updates.email.trim();
    }
    if (typeof updates.newPassword === "string" && updates.newPassword.length >= 6) {
      user.passwordHash = await hashPassword(updates.newPassword);
      user.mustChangePassword = true;
    }

    await user.save();

    return NextResponse.json({
      user: {
        _id: String(user._id),
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    console.error("[PATCH /api/admin/users/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/admin/users/:id — Delete a user */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    const denied = requireAdmin(auth);
    if (denied) return denied;

    const { id } = await params;

    // Prevent admin from deleting themselves
    if (auth!.userId === id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/users/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
