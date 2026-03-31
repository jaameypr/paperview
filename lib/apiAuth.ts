import { NextRequest } from "next/server";
import crypto from "crypto";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import ApiKey from "@/models/ApiKey";
import User from "@/models/User";
import type { AuthTokenPayload } from "@/types/user";

export async function getRequestAuth(request: NextRequest): Promise<AuthTokenPayload | null> {
  // 1. Cookie auth (existing behavior)
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  const cookieAuth = getAuthFromCookie(cookieToken);
  if (cookieAuth) return cookieAuth;

  // 2. Bearer API key auth
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer pv_")) return null;

  const key = authHeader.slice(7); // remove "Bearer "
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  await connectToDatabase();
  const apiKey = await ApiKey.findOne({ keyHash }).lean();
  if (!apiKey) return null;

  const user = await User.findById(apiKey.userId)
    .select("username role isActive mustChangePassword")
    .lean();
  if (!user || !user.isActive) return null;

  // Update lastUsedAt async (fire and forget)
  ApiKey.findByIdAndUpdate(apiKey._id, { lastUsedAt: new Date() })
    .exec()
    .catch(() => {});

  const now = Date.now();
  return {
    userId: String(user._id),
    username: user.username,
    role: user.role,
    mustChangePassword: false,
    iat: now,
    exp: now + 7 * 24 * 60 * 60 * 1000,
  };
}
