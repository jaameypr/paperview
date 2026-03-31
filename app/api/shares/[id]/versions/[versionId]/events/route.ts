import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { getRequestAuth } from "@/lib/apiAuth";
import { getAccessLevel, hasAccess } from "@/lib/access";
import { subscribe, shareVersionChannel } from "@/lib/sse";
import Share from "@/models/Share";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const auth = await getRequestAuth(request);
  const cookieStore = await cookies();

  await connectToDatabase();
  const share = await Share.findById(id);
  if (!share) {
    return new Response("Share not found", { status: 404 });
  }

  const access = await getAccessLevel(share, auth, cookieStore);
  if (!hasAccess(access, "viewer")) {
    return new Response("Access denied", { status: 403 });
  }

  const channel = shareVersionChannel(id, versionId);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial ping
      controller.enqueue(encoder.encode(":ok\n\n"));

      const unsubscribe = subscribe(channel, (event, data) => {
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Client disconnected
        }
      });

      // Keep-alive ping every 30 seconds
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":ping\n\n"));
        } catch {
          clearInterval(interval);
          unsubscribe();
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
