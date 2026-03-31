import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

/** POST /api/auth/logout — Clear auth cookie */
export async function POST() {
  const isProduction = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 0,
    path: "/",
  });
  return response;
}
