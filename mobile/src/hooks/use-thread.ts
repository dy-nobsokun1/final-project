// One chat thread: the messages between me and one student about one item, oldest first.
// While the screen is in front and the app is active, the live stream adds new messages at once.
// Each time the stream opens it reloads the thread and marks it read, so nothing is missed.
import { useCallback, useEffect, useState } from "react";

import { useAppActive } from "@/hooks/use-app-active";
import { useMessageStream } from "@/hooks/use-message-stream";
import { useScreenFocused } from "@/hooks/use-screen-focused";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inboxChanged } from "@/lib/inbox-events";
import type { Message } from "@/types";

/** Adds a message once: my own message comes back from POST and from the stream, with the same id. */
function merge(list: Message[], message: Message): Message[] {
  return list.some((item) => item.id === message.id) ? list : [...list, message];
}

export function useThread(listingId: string, partnerId: string) {
  const { token } = useAuth();
  const focused = useScreenFocused();
  const appActive = useAppActive();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const thread = { listingId, withUserId: partnerId };

  const markRead = useCallback(() => {
    apiFetch("/api/messages/read", { method: "PATCH", body: { listingId, withUserId: partnerId }, token })
      .then(() => inboxChanged()) // the tab badge counts again
      .catch(() => {}); // not worth an error message: it is marked read next time
  }, [token, listingId, partnerId]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ messages: Message[] }>(
        `/api/messages?listingId=${listingId}&withUserId=${partnerId}`, { token });
      setMessages(data.messages);
      setError(null);
      markRead();
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [token, listingId, partnerId, markRead]);

  useEffect(() => {
    load();
  }, [load]);

  useMessageStream({
    ...thread,
    enabled: focused && appActive,
    onOpen: load,
    onMessage: (message) => {
      setMessages((list) => merge(list ?? [], message));
      if (message.senderId === partnerId) markRead();
    },
  });

  async function send(body: string) {
    const data = await apiFetch<{ message: Message }>("/api/messages", {
      method: "POST", body: { listingId, receiverId: partnerId, body }, token });
    setMessages((list) => merge(list ?? [], data.message));
  }

  return { messages, error, send };
}
