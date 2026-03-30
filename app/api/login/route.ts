import { NextRequest, NextResponse } from "next/server";
import { createAuthToken, COOKIE_NAME, COOKIE_MAX_AGE_SECONDS } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !("password" in body) ||
      typeof (body as { password: unknown }).password !== "string"
    ) {
      return NextResponse.json(
        { error: "Passwort ist erforderlich" },
        { status: 400 }
      );
    }

    const { password } = body as { password: string };

    if (!password.trim()) {
      return NextResponse.json(
        { error: "Passwort darf nicht leer sein" },
        { status: 400 }
      );
    }

    const docPassword = process.env.DOC_PASSWORD;
    if (!docPassword) {
      console.error("[login] DOC_PASSWORD is not set in environment");
      return NextResponse.json(
        { error: "Serverkonfigurationsfehler" },
        { status: 500 }
      );
    }

    // Constant-time comparison to prevent timing attacks
    const { timingSafeEqual } = await import("crypto");
    const inputBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(docPassword);
    const match =
      inputBuf.length === expectedBuf.length &&
      timingSafeEqual(inputBuf, expectedBuf);

    if (!match) {
      return NextResponse.json(
        { error: "Falsches Passwort" },
        { status: 401 }
      );
    }

    const token = createAuthToken();
    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[login] Unexpected error:", err);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
