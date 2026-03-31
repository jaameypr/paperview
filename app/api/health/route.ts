import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

/**
 * GET /api/health
 *
 * Returns the health status of the API and its dependencies.
 * Always responds with 200 if the server is up; individual checks
 * carry their own status field so callers can inspect each component.
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; message?: string }> = {};

  // ── Database ──────────────────────────────────────────────────────────
  try {
    await connectToDatabase();
    // Ping the primary to confirm the connection is live
    await mongoose.connection.db?.admin().ping();
    checks.database = { status: "ok" };
  } catch (err) {
    checks.database = {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // ── Storage ───────────────────────────────────────────────────────────
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const storageDir = path.join(process.cwd(), "storage");
    await fs.access(storageDir);
    checks.storage = { status: "ok" };
  } catch {
    checks.storage = { status: "error", message: "Storage directory not accessible" };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
