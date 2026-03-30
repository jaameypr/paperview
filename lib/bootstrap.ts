/**
 * lib/bootstrap.ts — Admin user bootstrap on application startup.
 *
 * Ensures an admin account exists. If none, creates one from env vars.
 * Called once during app initialization.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";
import User from "@/models/User";

let bootstrapped = false;

export async function bootstrapAdmin(): Promise<void> {
  if (bootstrapped) return;

  await connectToDatabase();

  const adminCount = await User.countDocuments({ role: "admin" });
  if (adminCount > 0) {
    bootstrapped = true;
    return;
  }

  const username = process.env.INITIAL_ADMIN_USERNAME ?? "admin";
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? "changeme";

  const existing = await User.findOne({ username });
  if (existing) {
    bootstrapped = true;
    return;
  }

  const passwordHash = await hashPassword(password);

  await User.create({
    username,
    email: "",
    passwordHash,
    role: "admin",
    isActive: true,
    mustChangePassword: true,
  });

  console.log(`[bootstrap] Admin user "${username}" created (must change password on first login)`);
  bootstrapped = true;
}
