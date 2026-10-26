import { ConversationRow } from "@/components/chat/ConversationRow";
import type { Conversation, User } from "@/types";

interface ConversationListProps {
  conversations: Conversation[];
  partners: Record<string, User>;
  activeId?: string;
}

/** Thread list in the messages inbox. */
export function ConversationList({ conversations, partners, activeId }: ConversationListProps) {
  if (conversations.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((conversation) => {
        const partner = partners[conversation.id];
        if (!partner) return null;

        return (
          <li key={conversation.id}>
            <ConversationRow
              conversation={conversation}
              partner={partner}
              isActive={activeId === conversation.id}
            />
          </li>
        );
      })}
    </ul>
  );
}
