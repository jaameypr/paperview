/**
 * proxy.ts — Next.js 16 Proxy (replaces middleware.ts).
 *
 * Runs in Edge Runtime — Web Crypto API only, no Node.js crypto.
 * Verifies HMAC-SHA256 auth tokens carrying user payload.
 */

import { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "pv_auth";

/** Paths that require authentication */
const PROTECTED_PATHS = ["/dashboard", "/shares/new", "/admin", "/change-password", "/settings"];
const PROTECTED_API_PATHS = ["/api/admin"];

/** Paths that are always public */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/_next",
  "/favicon.ico",
];

function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p))) return true;
  if (PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))) return true;
  return false;
}

/** Decode a base64url string to a Uint8Array (edge-safe). */
function base64urlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface TokenPayload {
  exp?: number;
  mustChangePassword?: boolean;
}

async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return null;

    const encodedPayload = token.slice(0, dotIndex);
    const encodedSig = token.slice(dotIndex + 1);

    if (!encodedPayload || !encodedSig) return null;

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(encodedSig) as Uint8Array<ArrayBuffer>,
      encoder.encode(encodedPayload)
    );
    if (!isValid) return null;

    const payloadJson = atob(
      encodedPayload
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(encodedPayload.length + ((4 - (encodedPayload.length % 4)) % 4), "=")
    );
    const payload = JSON.parse(payloadJson) as TokenPayload;
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Build an absolute URL using the public origin as seen by the reverse proxy.
 * Falls back to request.url when no forwarded headers are present (local dev).
 */
function buildPublicUrl(path: string, request: NextRequest): URL {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "http";

  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }
  return new URL(path, request.url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Let API key requests through — route handlers verify the key
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer pv_")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET ?? "";

  const payload = token ? await verifyToken(token, secret) : null;

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = buildPublicUrl("/login", request);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force password change redirect
  if (payload.mustChangePassword && pathname !== "/change-password" && !pathname.startsWith("/api/auth")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Password change required" }, { status: 403 });
    }
    return NextResponse.redirect(buildPublicUrl("/change-password", request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
