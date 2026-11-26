// Live messages: keeps GET /api/messages/stream open while `enabled` (screen in front AND app active).
// expo/fetch can read a response body bit by bit, like the browser's EventSource. With listingId +
// withUserId it is one thread, and the API then skips the email/Telegram alert, so it must never stay
// open in the background. On an error it waits 3 s and opens again (at most 5 tries in a row).
import { fetch } from "expo/fetch";
import { useEffect, useRef } from "react";

import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { readSseEvents } from "@/lib/sse";
import type { Message } from "@/types";

interface StreamOptions {
  listingId?: string;
  withUserId?: string;
  enabled: boolean;
  onMessage: (message: Message) => void;
  /** Runs each time the stream (re)opens: reload, so nothing sent while it was closed is missed. */
  onOpen?: () => void;
}

export function useMessageStream({ listingId, withUserId, enabled, onMessage, onOpen }: StreamOptions) {
  const { token } = useAuth();
  const handlers = useRef({ onMessage, onOpen });
  handlers.current = { onMessage, onOpen };

  useEffect(() => {
    if (!token || !enabled) return;
    const controller = new AbortController();
    const query = listingId && withUserId ? `?listingId=${listingId}&withUserId=${withUserId}` : "";

    async function run() {
      for (let tries = 0; tries < 5 && !controller.signal.aborted; tries++) {
        try {
          const response = await fetch(`${API_URL}/api/messages/stream${query}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (!response.ok || !response.body) throw new Error(`Stream refused (${response.status})`);
          tries = 0; // it opened: the next error starts counting again
          handlers.current.onOpen?.();
          await readSseEvents(response.body, ({ event, data }) => {
            if (event === "message") handlers.current.onMessage(JSON.parse(data) as Message);
          });
        } catch {
          // Aborted on purpose (screen left, app in the background), or the API went away.
        }
        if (!controller.signal.aborted) await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    run();
    return () => controller.abort();
  }, [token, enabled, listingId, withUserId]);
}
