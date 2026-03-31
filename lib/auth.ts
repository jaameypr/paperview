/**
 * lib/auth.ts — User-based authentication utilities.
 *
 * Token format: `<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`
 * Payload carries userId, username, role, mustChangePassword.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { AuthTokenPayload, UserRole } from "@/types/user";

export const COOKIE_NAME = "pv_auth";
const BCRYPT_ROUNDS = 12;

/** 7 days in milliseconds */
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** 7 days in seconds (for cookie maxAge) */
export const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is not set");
  return secret;
}

// ── Password hashing ──────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Token creation & verification ─────────────────────────────────────

export function createAuthToken(user: {
  _id: string;
  username: string;
  role: UserRole;
  mustChangePassword: boolean;
}): string {
  const now = Date.now();
  const payload: AuthTokenPayload = {
    userId: String(user._id),
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    iat: now,
    exp: now + TOKEN_MAX_AGE_MS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getSecret();
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${hmac}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return null;

    const encodedPayload = token.slice(0, dotIndex);
    const hmac = token.slice(dotIndex + 1);
    if (!encodedPayload || !hmac) return null;

    const secret = getSecret();
    const expectedHmac = crypto
      .createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");

    const hmacBuf = Buffer.from(hmac);
    const expectedBuf = Buffer.from(expectedHmac);
    if (hmacBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) return null;

    const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as AuthTokenPayload;
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Get the authenticated user payload from a cookie value, or null. */
export function getAuthFromCookie(token: string | undefined): AuthTokenPayload | null {
  if (!token) return null;
  return verifyAuthToken(token);
}

/** Legacy compat: returns true if token is valid */
export function isAuthenticated(token: string | undefined): boolean {
  return getAuthFromCookie(token) !== null;
}

// ── Share password hashing ────────────────────────────────────────────

export function hashSharePassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifySharePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
