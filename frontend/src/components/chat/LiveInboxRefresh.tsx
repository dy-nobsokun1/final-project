"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps the inbox current. It opens the live stream for all of the student's messages
 * (app/api/messages/stream, no thread, so it does not count as reading one) and refreshes the
 * page for each new message, so rows, last messages and unread counts update. After a reconnect
 * it refreshes once too. It shows nothing; if the stream is refused, the inbox works as before.
 */
export function LiveInboxRefresh() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/messages/stream");
    let hadError = false;
    source.onmessage = () => router.refresh();
    source.onerror = () => {
      hadError = true;
    };
    source.onopen = () => {
      if (hadError) router.refresh();
      hadError = false;
    };
    return () => source.close();
  }, [router]);

  return null;
}
