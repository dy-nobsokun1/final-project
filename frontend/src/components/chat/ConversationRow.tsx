import Link from "next/link";
import { CATEGORY_ICONS } from "@/components/listings/CategoryShortcuts";
import { ListingImage } from "@/components/listings/ListingImage";
import { CATEGORIES } from "@/lib/constants";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Conversation, User } from "@/types";

interface ConversationRowProps {
  conversation: Conversation;
  partner: User;
  isActive: boolean;
}

/**
 * One inbox row: the listing's cover photo (or its category icon when it has none), who the chat is
 * with, which listing it is about, the newest message and when it was sent. Unread threads get a dot
 * and bold text.
 */
export function ConversationRow({ conversation, partner, isActive }: ConversationRowProps) {
  const isUnread = conversation.unreadCount > 0;
  const Icon = CATEGORY_ICONS[conversation.listingCategory];
  const accent = CATEGORIES.find((item) => item.value === conversation.listingCategory)?.accent;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      aria-current={isActive ? "page" : undefined}
      // Not bg-muted: inside the light-surface card that is the card's own colour, so it showed nothing.
      className={cn("flex items-center gap-3 p-3 hover:bg-brand-50/60", isActive && "bg-brand-50/60")}
    >
      {/* The title is in the text next to it, so the picture itself needs no alt text. */}
      {conversation.listingImageUrl ? (
        <ListingImage src={conversation.listingImageUrl} alt="" className="size-12 shrink-0 rounded-lg" />
      ) : (
        <span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", accent)}>
          <Icon className="size-5" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", isUnread ? "font-bold" : "font-medium")}>{partner.name}</span>
          <time dateTime={conversation.lastMessageAt} className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(conversation.lastMessageAt)}
          </time>
        </div>
        <span className="truncate text-xs text-muted-foreground">{conversation.listingTitle}</span>
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-sm", isUnread ? "font-semibold" : "text-muted-foreground")}>
            {conversation.lastMessageIsMine ? "You: " : null}
            {conversation.lastMessageBody}
          </span>
          {isUnread ? (
            <span className="ml-auto size-2.5 shrink-0 rounded-full bg-brand-ink">
              <span className="sr-only">{conversation.unreadCount} unread</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
