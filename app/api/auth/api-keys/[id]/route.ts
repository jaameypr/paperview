import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";
import ApiKey from "@/models/ApiKey";

/** DELETE /api/auth/api-keys/:id — Delete an API key (cookie-only auth for security) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const apiKey = await ApiKey.findById(id);
    if (!apiKey) return NextResponse.json({ error: "API key not found" }, { status: 404 });

    if (String(apiKey.userId) !== auth.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await apiKey.deleteOne();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/auth/api-keys/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
