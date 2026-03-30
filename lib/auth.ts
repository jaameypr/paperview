/**
 * lib/auth.ts — Auth utilities for Node.js runtime (server components, route handlers).
 *
 * Uses Node.js crypto for HMAC creation and verification.
 * Token format: `<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`
 */

import crypto from "crypto";

export const COOKIE_NAME = "doc_auth";

/** 7 days in milliseconds */
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** 7 days in seconds (for cookie maxAge) */
export const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Create a signed auth token.
 * Payload contains issued-at and expiry timestamps.
 */
export function createAuthToken(): string {
  const now = Date.now();
  const payload = {
    iat: now,
    exp: now + TOKEN_MAX_AGE_MS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );

  const secret = getSecret();
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${hmac}`;
}

/**
 * Verify a token produced by createAuthToken().
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyAuthToken(token: string): boolean {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return false;

    const encodedPayload = token.slice(0, dotIndex);
    const hmac = token.slice(dotIndex + 1);

    if (!encodedPayload || !hmac) return false;

    const secret = getSecret();
    const expectedHmac = crypto
      .createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");

    // Timing-safe comparison
    const hmacBuf = Buffer.from(hmac);
    const expectedBuf = Buffer.from(expectedHmac);

    if (hmacBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) return false;

    // Check expiry
    const payloadJson = Buffer.from(encodedPayload, "base64url").toString(
      "utf-8"
    );
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (payload.exp && Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the given cookie value represents an authenticated session.
 * Safe to call with undefined (returns false).
 */
export function isAuthenticated(token: string | undefined): boolean {
  if (!token) return false;
  return verifyAuthToken(token);
}
