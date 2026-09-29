import Link from "next/link";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { cn, formatRelativeTime } from "@/lib/utils";
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
            <Link
              href={`/messages/${conversation.id}`}
              aria-current={activeId === conversation.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 p-3 hover:bg-muted",
                activeId === conversation.id && "bg-muted",
              )}
            >
              <UserAvatar name={partner.name} src={partner.avatarUrl} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{partner.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatRelativeTime(conversation.lastMessageAt)}
                </span>
              </div>
              {conversation.unreadCount > 0 ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  {conversation.unreadCount}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

