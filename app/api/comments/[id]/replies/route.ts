import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Comment from "@/models/Comment";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/comments/:id/replies — add a reply to a comment */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    const { author, text } = body as { author?: unknown; text?: unknown };

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Antworttext darf nicht leer sein" },
        { status: 400 }
      );
    }

    const comment = await Comment.findByIdAndUpdate(
      id,
      {
        $push: {
          replies: {
            author:
              typeof author === "string" && author.trim().length > 0
                ? author.trim()
                : "Anonym",
            text: text.trim(),
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).lean();

    if (!comment) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/comments/:id/replies]", err);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
