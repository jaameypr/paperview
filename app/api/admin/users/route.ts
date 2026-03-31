import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";
import { getRequestAuth } from "@/lib/apiAuth";
import User from "@/models/User";

function requireAdmin(auth: { role: string } | null) {
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return null;
}

/** GET /api/admin/users — List all users */
export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    const denied = requireAdmin(auth);
    if (denied) return denied;

    await connectToDatabase();

    const users = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      users: users.map((u) => ({
        _id: String(u._id),
        username: u.username,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/admin/users — Create a new user */
export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    const denied = requireAdmin(auth);
    if (denied) return denied;

    await connectToDatabase();

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { username, email, password, role } = body as {
      username?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return NextResponse.json({ error: "Username must be at least 2 characters" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      username: username.trim(),
      email: typeof email === "string" ? email.trim() : "",
      passwordHash,
      role: role === "admin" ? "admin" : "user",
      isActive: true,
      mustChangePassword: false,
    });

    return NextResponse.json(
      {
        user: {
          _id: String(user._id),
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/admin/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
