import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Comment from "@/models/Comment";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/comments/:id — toggle resolved status */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      typeof (body as Record<string, unknown>).resolved !== "boolean"
    ) {
      return NextResponse.json(
        { error: "resolved muss ein Boolean sein" },
        { status: 400 }
      );
    }

    const { resolved } = body as { resolved: boolean };

    const comment = await Comment.findByIdAndUpdate(
      id,
      { resolved },
      { new: true }
    ).lean();

    if (!comment) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ comment });
  } catch (err) {
    console.error("[PATCH /api/comments/:id]", err);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

/** DELETE /api/comments/:id — permanently delete a comment and all its replies */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const comment = await Comment.findByIdAndDelete(id);

    if (!comment) {
      return NextResponse.json(
        { error: "Kommentar nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/comments/:id]", err);
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
