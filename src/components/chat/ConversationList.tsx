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
    return <p className="p-4 text-sm text-zinc-500">No conversations yet.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {conversations.map((conversation) => {
        const partner = partners[conversation.id];
        if (!partner) return null;

        return (
          <li key={conversation.id}>
            <Link
              href={`/messages/${conversation.id}`}
              aria-current={activeId === conversation.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 p-3 hover:bg-zinc-50",
                activeId === conversation.id && "bg-zinc-100",
              )}
            >
              <UserAvatar name={partner.name} src={partner.avatarUrl} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{partner.name}</span>
                <span className="truncate text-xs text-zinc-500">
                  {formatRelativeTime(conversation.lastMessageAt)}
                </span>
              </div>
              {conversation.unreadCount > 0 ? (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
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

