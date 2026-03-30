import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthFromCookie, COOKIE_NAME } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const auth = getAuthFromCookie(cookieStore.get(COOKIE_NAME)?.value);

  if (auth) {
    if (auth.mustChangePassword) redirect("/change-password");
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
