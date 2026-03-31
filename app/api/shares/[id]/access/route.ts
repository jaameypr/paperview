import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { verifySharePassword } from "@/lib/auth";
import Share from "@/models/Share";

/** POST /api/shares/:id/access — Unlock a password-protected share */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const share = await Share.findById(id);
    if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    if (share.visibility !== "public_password" || !share.passwordHash) {
      return NextResponse.json({ error: "Share is not password protected" }, { status: 400 });
    }

    const body: unknown = await request.json();
    const { password } = (body ?? {}) as { password?: string };
    if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

    const valid = await verifySharePassword(password, share.passwordHash);
    if (!valid) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

    const response = NextResponse.json({ success: true });
    response.cookies.set(`pv_share_${id}`, "unlocked", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[POST /api/shares/:id/access]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
