// The number on the Inbox tab: unread messages in all threads (sum of each thread's unreadCount).
// It loads when the student signs in, when the app comes back to the front, and when a screen
// calls inboxChanged() (the Inbox reloaded, or a thread was read).
import { useCallback, useEffect, useState } from "react";

import { useAppActive } from "@/hooks/use-app-active";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { onInboxChanged } from "@/lib/inbox-events";
import type { Conversation } from "@/types";

export function unreadTotal(conversations: Conversation[]): number {
  return conversations.reduce((sum, row) => sum + row.unreadCount, 0);
}

export function useUnreadCount(): number {
  const { token } = useAuth();
  const appActive = useAppActive();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!token) return setCount(0);
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>("/api/messages/conversations", { token });
      setCount(unreadTotal(data.conversations));
    } catch {
      // Keep the old number: a badge is not worth an error message.
    }
  }, [token]);

  useEffect(() => {
    if (appActive) load();
  }, [appActive, load]);

  useEffect(() => onInboxChanged((unread) => (unread === undefined ? load() : setCount(unread))), [load]);

  return count;
}
