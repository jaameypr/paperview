import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthenticated, COOKIE_NAME } from "@/lib/auth";

/**
 * Root page: redirect to /doc if authenticated, otherwise to /login.
 * This avoids double redirects for unauthenticated users.
 */
export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (isAuthenticated(token)) {
    redirect("/doc");
  } else {
    redirect("/login");
  }
}
