import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LiveMessageList } from "@/components/chat/LiveMessageList";
import { MeetupCard } from "@/components/chat/MeetupCard";
import { MeetupPlanner } from "@/components/chat/MeetupPlanner";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ThreadReview } from "@/components/chat/ThreadReview";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import {
  canReview,
  getListingById,
  getListingReviews,
  getMessages,
  getThreadMeetup,
  getUserById,
  markThreadRead,
  parseConversationId,
  requireUser,
} from "@/lib/api";
import { isMeetupPast } from "@/lib/meetup-spots";

/** One API call per page view: the tab title and the page share it (React `cache`). */
const getListing = cache(getListingById);

/** The browser tab says which listing the chat is about (listing titles are public anyway). */
export async function generateMetadata({ params }: PageProps<"/messages/[id]">): Promise<Metadata> {
  const ids = parseConversationId((await params).id);
  const listing = ids ? await getListing(ids.listingId) : null;
  return { title: listing ? `Chat about ${listing.title} | UniSwap` : "Messages | UniSwap" };
}

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
    getListing(ids.listingId),
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
  const [messages, reviews, mayReview, meetup] = await Promise.all([
    getMessages(listing.id, partner.id),
    getListingReviews(listing.id),
    isFinished ? canReview(listing.id, partner.id) : false,
    getThreadMeetup(listing.id, partner.id),
  ]);
  // The API only takes a meetup once the two have chatted, and not while an accepted one is still to come.
  const meetupIsPast = meetup ? isMeetupPast(meetup.meetAt) : false;
  const mayPlanMeetup = messages.length > 0 && (meetup?.status !== "accepted" || meetupIsPast);

  return (
    // Fills the screen under the navbar (65px) and main's 24px top and bottom padding, so the
    // messages scroll inside the card and the composer stays at its bottom. Phones also lose the
    // tab bar (MobileNav, about 60px); main leaves 80px for it there, so -mb-14 takes back 56px.
    // dvh follows the phone browser's address bar as it shows and hides.
    <div className="light-surface flex h-[calc(100dvh-173px)] min-h-96 flex-col gap-4 rounded-xl bg-card p-4 max-md:-mb-14 md:h-[calc(100dvh-113px)]">
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

      {meetup ? <MeetupCard meetup={meetup} isPast={meetupIsPast} meId={me.id} partnerName={partner.name} /> : null}

      {/* flex-col-reverse makes the browser start this scroll area at the bottom, so the newest
          message is in view on load with no JavaScript. Its one child keeps the messages in
          time order, which is also the order screen readers read them in. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
        <div className="flex flex-col gap-4">
          {/* Keyed by thread, so moving to another thread starts its live list afresh. */}
          <LiveMessageList
            key={`${listing.id}_${partner.id}`}
            messages={messages}
            meId={me.id}
            listingId={listing.id}
            partnerId={partner.id}
          />
          <ThreadReview partner={partner} meId={me.id} listingId={listing.id} mayReview={mayReview} reviews={reviews} />
        </div>
      </div>

      {mayPlanMeetup ? <MeetupPlanner listingId={listing.id} partnerId={partner.id} /> : null}
      <MessageComposer listingId={listing.id} receiverId={partner.id} />
    </div>
  );
}
