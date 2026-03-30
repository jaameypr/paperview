import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Comment from "@/models/Comment";
import type { HighlightRect } from "@/types/comment";

/** GET /api/comments?page=N&status=open|resolved|all */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const statusParam = searchParams.get("status") ?? "all";

    const filter: Record<string, unknown> = {};

    if (pageParam !== null) {
      const page = parseInt(pageParam, 10);
      if (isNaN(page) || page < 1) {
        return NextResponse.json(
          { error: "Ungültige Seitennummer. Muss >= 1 sein." },
          { status: 400 }
        );
      }
      filter.page = page;
    }

    if (statusParam === "open") {
      filter.resolved = false;
    } else if (statusParam === "resolved") {
      filter.resolved = true;
    }

    const comments = await Comment.find(filter)
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    return NextResponse.json({ comments });
  } catch (err) {
    console.error("[GET /api/comments]", err);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kommentare" },
      { status: 500 }
    );
  }
}

/** POST /api/comments — create a new comment */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    const {
      author,
      page,
      text,
      quote,
      highlightRects,
    } = body as {
      author?: unknown;
      page?: unknown;
      text?: unknown;
      quote?: unknown;
      highlightRects?: unknown;
    };

    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Kommentartext darf nicht leer sein" },
        { status: 400 }
      );
    }

    if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
      return NextResponse.json(
        { error: "Seite muss eine ganze Zahl >= 1 sein" },
        { status: 400 }
      );
    }

    // Validate highlight rects if provided
    let validRects: HighlightRect[] | undefined;
    if (Array.isArray(highlightRects) && highlightRects.length > 0) {
      validRects = (highlightRects as unknown[])
        .filter(
          (r): r is HighlightRect =>
            r !== null &&
            typeof r === "object" &&
            typeof (r as Record<string, unknown>).x === "number" &&
            typeof (r as Record<string, unknown>).y === "number" &&
            typeof (r as Record<string, unknown>).width === "number" &&
            typeof (r as Record<string, unknown>).height === "number"
        )
        .map((r) => ({
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          ...(r.page != null ? { page: r.page } : {}),
        }));
    }

    const comment = await Comment.create({
      author:
        typeof author === "string" && author.trim().length > 0
          ? author.trim()
          : "Anonym",
      page,
      text: text.trim(),
      quote:
        typeof quote === "string" && quote.trim().length > 0
          ? quote.trim()
          : undefined,
      highlightRects: validRects,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/comments]", err);
    return NextResponse.json(
      { error: "Fehler beim Speichern des Kommentars" },
      { status: 500 }
    );
  }
}
