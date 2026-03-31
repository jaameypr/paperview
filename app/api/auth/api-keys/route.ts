import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";
import ApiKey from "@/models/ApiKey";

/** GET /api/auth/api-keys — List current user's API keys */
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();

    const keys = await ApiKey.find({ userId: auth.userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      keys: keys.map((k) => ({
        _id: String(k._id),
        keyPrefix: k.keyPrefix,
        description: k.description,
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/auth/api-keys]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/auth/api-keys — Create a new API key */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: unknown = await request.json();
    const description =
      body && typeof body === "object" && "description" in body
        ? String((body as { description: unknown }).description).trim().slice(0, 200)
        : "";

    await connectToDatabase();

    const key = "pv_" + crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    const keyPrefix = key.slice(0, 10);

    const apiKey = await ApiKey.create({
      userId: auth.userId,
      keyHash,
      keyPrefix,
      description,
    });

    return NextResponse.json(
      {
        key,
        id: String(apiKey._id),
        keyPrefix,
        description: apiKey.description,
        createdAt: apiKey.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/auth/api-keys]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
