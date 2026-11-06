"use client";

import { useState } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useLiveMessages } from "@/hooks/use-live-messages";
import type { Message } from "@/types";

interface LiveMessageListProps {
  /** The thread as the server rendered it, oldest first. */
  messages: Message[];
  meId: string;
  listingId: string;
  partnerId: string;
}

/** A thread's chat bubbles, oldest first. New messages from either side show up live. */
export function LiveMessageList({ messages, meId, listingId, partnerId }: LiveMessageListProps) {
  const shown = useLiveMessages(messages, { listingId, partnerId });
  // The messages there when the thread opened. Only the ones added later slide in, so opening a
  // thread does not animate its whole history.
  const [firstIds] = useState(() => new Set(messages.map((message) => message.id)));

  if (shown.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No messages yet. Say hi and suggest a time to meet on campus.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {shown.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.senderId === meId}
          isNew={!firstIds.has(message.id)}
        />
      ))}
    </ul>
  );
}
