/**
 * lib/access.ts — Share-level access control utilities.
 */

import type { AuthTokenPayload } from "@/types/user";
import type { IShare } from "@/models/Share";
import ShareCollaborator from "@/models/ShareCollaborator";

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
 * Does NOT handle share-password unlocking — that is checked separately.
 */
export async function getAccessLevel(
  share: IShare,
  auth: AuthTokenPayload | null
): Promise<AccessLevel> {
  // Admin always has full access
  if (auth?.role === "admin") return "admin";

  // Owner has full access
  if (auth && String(share.ownerId) === auth.userId) return "owner";

  // Public shares allow viewer access to everyone
  if (share.visibility === "public" || share.visibility === "public_password") {
    // Check if user has explicit collaborator role (higher than viewer)
    if (auth) {
      const collab = await ShareCollaborator.findOne({
        shareId: share._id,
        userId: auth.userId,
      }).lean();
      if (collab) return collab.role as AccessLevel;
    }
    return "viewer";
  }

  // Private share: only explicit collaborators or owner/admin
  if (auth) {
    const collab = await ShareCollaborator.findOne({
      shareId: share._id,
      userId: auth.userId,
    }).lean();
    if (collab) return collab.role as AccessLevel;
  }

  return "none";
}

/** Check if a share is expired */
export function isExpired(share: IShare): boolean {
  if (!share.expiresAt) return false;
  return new Date(share.expiresAt) < new Date();
}
