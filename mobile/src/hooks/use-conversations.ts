// The Inbox's threads (GET /api/messages/conversations), newest first. They load again each time
// the Inbox tab opens, and after a pull to refresh. Each load also updates the tab's unread badge.
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { unreadTotal } from "@/hooks/use-unread-count";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inboxChanged } from "@/lib/inbox-events";
import type { Conversation } from "@/types";

export function useConversations() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>("/api/messages/conversations", { token });
      setConversations(data.conversations);
      setError(null);
      inboxChanged(unreadTotal(data.conversations));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { conversations, error, load };
}
