import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/apiAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { bootstrapAdmin } from "@/lib/bootstrap";
import User from "@/models/User";

/** GET /api/auth/me — Return current user info */
export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) {
      return NextResponse.json({ user: null });
    }

    await connectToDatabase();
    await bootstrapAdmin();

    const user = await User.findById(auth.userId).select("-passwordHash").lean();
    if (!user || !user.isActive) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        _id: String(user._id),
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ user: null });
  }
}
