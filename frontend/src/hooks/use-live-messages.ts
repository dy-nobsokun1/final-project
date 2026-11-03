import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { markLiveThreadRead } from "@/lib/api/actions";
import type { Message } from "@/types";

interface Thread {
  listingId: string;
  partnerId: string;
}

/**
 * A thread's messages, kept up to date live: the server-rendered `messages` plus each new one the
 * stream (app/api/messages/stream) brings, merged by id. The sender's own message comes twice
 * (sendMessage's refresh() and the stream); merging by id keeps one.
 * - A message from the partner marks the thread read, so the inbox's unread count stays right.
 * - EventSource reconnects by itself after a network error; once it is back, one refresh()
 *   fills in anything sent while it was away.
 * - If the stream is refused (any error status), the thread works as before, just not live.
 */
export function useLiveMessages(messages: Message[], { listingId, partnerId }: Thread): Message[] {
  const router = useRouter();
  const [live, setLive] = useState<Message[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ listingId, withUserId: partnerId });
    const source = new EventSource(`/api/messages/stream?${params}`);
    let hadError = false;

    source.onmessage = (event) => {
      const message = JSON.parse(event.data) as Message;
      const isThisThread =
        message.listingId === listingId && (message.senderId === partnerId || message.receiverId === partnerId);
      if (!isThisThread) return;
      setLive((current) => [...current, message]);
      if (message.senderId === partnerId) void markLiveThreadRead(listingId, partnerId);
    };
    source.onerror = () => {
      hadError = true;
    };
    source.onopen = () => {
      if (hadError) router.refresh();
      hadError = false;
    };
    return () => source.close();
  }, [listingId, partnerId, router]);

  // The server's copy goes last, so it wins (it may know the message has been read).
  return useMemo(() => mergeById([...live, ...messages]), [live, messages]);
}

/** One copy of each message, oldest first. */
function mergeById(messages: Message[]): Message[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
