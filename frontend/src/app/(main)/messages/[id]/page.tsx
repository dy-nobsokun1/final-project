import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ThreadReview } from "@/components/chat/ThreadReview";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import {
  canReview,
  getListingById,
  getListingReviews,
  getMessages,
  getUserById,
  markThreadRead,
  parseConversationId,
  requireUser,
} from "@/lib/api";

/**
 * A single message thread: the signed-in user and one other person, about one listing.
 * "Message seller" links here too, so the thread may not have any messages yet.
 */
export default async function MessageThreadPage({
  params,
}: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const me = await requireUser();
  const ids = parseConversationId(id);
  if (!ids) notFound();

  const [listing, partner] = await Promise.all([
    getListingById(ids.listingId),
    getUserById(ids.partnerId),
  ]);
  // Every thread is between the listing's owner and one other person.
  const isValidThread =
    listing && partner && partner.id !== me.id &&
    (listing.sellerId === me.id || listing.sellerId === partner.id);
  if (!isValidThread) notFound();

  // Opening the thread counts as reading it, which clears its unread badge in the inbox.
  await markThreadRead(listing.id, partner.id);
  const isFinished = listing.status === "sold" || listing.status === "traded";
  const [messages, reviews, mayReview] = await Promise.all([
    getMessages(listing.id, partner.id),
    getListingReviews(listing.id),
    isFinished ? canReview(listing.id, partner.id) : false,
  ]);

  return (
    <div className="light-surface flex h-full flex-col gap-4 rounded-xl bg-card p-4">
      <Link
        href="/messages"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All conversations
      </Link>

      <header className="flex items-center gap-3">
        <UserAvatar name={partner.name} src={partner.avatarUrl} />
        <div className="flex flex-col">
          <div className="flex items-center gap-1 font-medium text-foreground">
            {partner.name}
            <VerifiedBadge isVerified={partner.isVerified} />
          </div>
          <Link href={`/listings/${listing.id}`} className="text-xs text-muted-foreground hover:underline">
            About: {listing.title}
          </Link>
        </div>
      </header>

      {messages.length === 0 ? (
        <p className="flex-1 text-sm text-muted-foreground">
          No messages yet. Say hi and suggest a time to meet on campus.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-2">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} isOwn={message.senderId === me.id} />
          ))}
        </ul>
      )}

      <ThreadReview partner={partner} meId={me.id} listingId={listing.id} mayReview={mayReview} reviews={reviews} />
      <MessageComposer listingId={listing.id} receiverId={partner.id} />
    </div>
  );
}
