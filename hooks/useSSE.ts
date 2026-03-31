"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Subscribe to an SSE event stream. Calls onEvent for each named event.
 * Automatically reconnects on error with backoff.
 */
export function useSSE(
  url: string | null,
  onEvent: (event: string, data: unknown) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const reconnect = useCallback(() => {
    if (!url) return undefined;

    const es = new EventSource(url, { withCredentials: true });
    let closed = false;

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current(e.type, data);
      } catch {
        // ignore parse errors
      }
    };

    // Listen for known event types
    const events = [
      "comment:created",
      "comment:updated",
      "comment:deleted",
      "reply:created",
      "version:created",
    ];
    for (const evt of events) {
      es.addEventListener(evt, handler);
    }

    es.onerror = () => {
      if (!closed) {
        es.close();
        // Reconnect after 3s
        setTimeout(() => {
          if (!closed) reconnect();
        }, 3000);
      }
    };

    return () => {
      closed = true;
      es.close();
    };
  }, [url]);

  useEffect(() => {
    const cleanup = reconnect();
    return cleanup;
  }, [reconnect]);
}
