import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { bootstrapAdmin } from "@/lib/bootstrap";
import { verifyPassword, createAuthToken, COOKIE_NAME, COOKIE_MAX_AGE_SECONDS } from "@/lib/auth";
import User from "@/models/User";

/** POST /api/auth/login — Authenticate a user */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    await bootstrapAdmin();

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { username, password } = body as { username?: string; password?: string };

    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = createAuthToken({
      _id: String(user._id),
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });

    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      user: {
        _id: String(user._id),
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
