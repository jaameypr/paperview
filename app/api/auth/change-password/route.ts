import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyPassword, hashPassword, createAuthToken, COOKIE_NAME, COOKIE_MAX_AGE_SECONDS } from "@/lib/auth";
import { getRequestAuth } from "@/lib/apiAuth";
import User from "@/models/User";

/** POST /api/auth/change-password — Change own password */
export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await connectToDatabase();

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await User.findById(auth.userId);
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = false;
    await user.save();

    const token = createAuthToken({
      _id: String(user._id),
      username: user.username,
      role: user.role,
      mustChangePassword: false,
    });

    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[POST /api/auth/change-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
