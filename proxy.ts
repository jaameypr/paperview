/**
 * proxy.ts — Next.js 16 Proxy (ersetzt middleware.ts).
 *
 * In Next.js 16 wurde "middleware.ts" durch "proxy.ts" abgelöst.
 * Nur Web Crypto API (kein Node.js) → läuft im Edge Runtime.
 */

import { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "doc_auth";

/** Paths that require authentication */
const PROTECTED_PATHS = ["/doc"];
const PROTECTED_API_PATHS = ["/api/comments", "/api/document"];

/** Paths that are always public */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/api/logout",
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

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return false;

    const encodedPayload = token.slice(0, dotIndex);
    const encodedSig = token.slice(dotIndex + 1);

    if (!encodedPayload || !encodedSig) return false;

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
    if (!isValid) return false;

    const payloadJson = atob(
      encodedPayload
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(encodedPayload.length + ((4 - (encodedPayload.length % 4)) % 4), "=")
    );
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (payload.exp && Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET ?? "";

  const authenticated = token ? await verifyToken(token, secret) : false;

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
