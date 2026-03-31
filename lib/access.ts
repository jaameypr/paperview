/**
 * lib/access.ts — Share-level access control utilities.
 */

import type { AuthTokenPayload } from "@/types/user";
import type { IShare } from "@/models/Share";
import ShareCollaborator from "@/models/ShareCollaborator";
import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";

export type AccessLevel = "none" | "viewer" | "commenter" | "editor" | "owner" | "admin";

const LEVEL_ORDER: Record<AccessLevel, number> = {
  none: 0,
  viewer: 1,
  commenter: 2,
  editor: 3,
  owner: 4,
  admin: 5,
};

export function hasAccess(actual: AccessLevel, required: AccessLevel): boolean {
  return LEVEL_ORDER[actual] >= LEVEL_ORDER[required];
}

/**
 * Determine the access level a user has on a share.
 * For public_password shares, pass cookieStore to verify the unlock cookie.
 */
export async function getAccessLevel(
  share: IShare,
  auth: AuthTokenPayload | null,
  cookieStore?: { get(name: string): { value: string } | undefined }
): Promise<AccessLevel> {
  // Admin always has full access
  if (auth?.role === "admin") return "admin";

  // Owner has full access
  if (auth && String(share.ownerId) === auth.userId) return "owner";

  // Check explicit collaborator role
  if (auth) {
    const collab = await ShareCollaborator.findOne({
      shareId: share._id,
      userId: auth.userId,
    }).lean();
    if (collab) return collab.role as AccessLevel;
  }

  // Public shares: grant commenter access if comments are enabled
  if (share.visibility === "public") {
    if (share.commentsEnabled && share.previewMode === "viewer_comments") {
      return "commenter";
    }
    return "viewer";
  }

  // Password-protected shares: require unlock cookie
  if (share.visibility === "public_password") {
    const shareId = String(share._id);
    const unlockCookie = cookieStore?.get(`pv_share_${shareId}`);
    if (unlockCookie?.value === "unlocked") {
      return "viewer";
    }
    // Return "none" if password not provided — route handlers use this to prompt for password
    return "none";
  }

  // Private share: no access for non-collaborators
  return "none";
}

/** Check if a share is expired */
export function isExpired(share: IShare): boolean {
  if (!share.expiresAt) return false;
  return new Date(share.expiresAt) < new Date();
}
