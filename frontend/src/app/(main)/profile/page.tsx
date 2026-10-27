import { Inbox } from "lucide-react";
import Link from "next/link";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { getConversations, getMyListings, getMyStats, getUserReviews, requireUser } from "@/lib/api";

export const metadata = { title: "My profile | UniSwap" };

/** Profile of the signed-in user. */
export default async function ProfilePage() {
  const user = await requireUser();
  const [listings, conversations, { averageRating, reviewCount }, stats] = await Promise.all([
    getMyListings(),
    getConversations(),
    getUserReviews(user.id),
    getMyStats(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        user={user}
        listings={listings}
        averageRating={averageRating}
        reviewCount={reviewCount}
        isOwnProfile
        actions={
          <>
            {/* Styled links, not <Link><Button/></Link>, which put a button inside a link.
                Same dark and light pills as the home page hero. */}
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg border border-brand-50/30 bg-brand-deep px-5 py-2.5 text-sm font-semibold text-brand-50 transition-colors hover:bg-brand-900"
            >
              Settings
            </Link>
            <Link
              href="/messages"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-200"
            >
              <Inbox aria-hidden="true" className="size-4" />
              {conversations.length} chats
            </Link>
          </>
        }
      />

      {/* Only here, never on /profile/[id]: it shows money. */}
      {stats ? <ProfileDashboard stats={stats} /> : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl tracking-tight">Active listings</h2>
        <ListingGrid
          listings={listings.filter((listing) => listing.status === "active")}
          emptyTitle="No active listings"
          emptyDescription="List something to start selling."
          emptyAction={{ href: "/listings/new", label: "Create a listing" }}
        />
      </section>
    </div>
  );
}
