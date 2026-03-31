import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/auth";
import { bootstrapAdmin } from "@/lib/bootstrap";
import ApiKey from "@/models/ApiKey";
import User from "@/models/User";

/**
 * POST /api/auth/api-keys/exchange
 *
 * Exchange username + password for a new API key.
 * Useful for CI/CD pipelines and scripts that can't use browser cookies.
 *
 * Body: { username, password, description? }
 * Returns: { key, keyPrefix, description, createdAt }
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { username, password, description } = body as {
      username?: unknown;
      password?: unknown;
      description?: unknown;
    };

    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "password is required" }, { status: 400 });
    }

    await connectToDatabase();
    await bootstrapAdmin();

    const user = await User.findOne({ username: username.trim() });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const desc =
      description && typeof description === "string"
        ? description.trim().slice(0, 200)
        : "";

    const key = "pv_" + crypto.randomBytes(32).toString("hex");
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    const keyPrefix = key.slice(0, 10);

    const apiKey = await ApiKey.create({
      userId: user._id,
      keyHash,
      keyPrefix,
      description: desc,
    });

    return NextResponse.json(
      {
        key,
        keyPrefix,
        description: apiKey.description,
        createdAt: apiKey.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/auth/api-keys/exchange]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
