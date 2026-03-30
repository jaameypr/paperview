import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthenticated, COOKIE_NAME } from "@/lib/auth";
import DocClient from "@/components/doc-client";

/**
 * Protected document page.
 *
 * Auth is enforced at two layers:
 * 1. middleware.ts (Edge Runtime, fast redirect)
 * 2. Here in the Server Component (defense in depth)
 */
export default async function DocPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!isAuthenticated(token)) {
    redirect("/login");
  }

  return <DocClient />;
}
