import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ReviewList } from "@/components/profile/ReviewList";
import { getListingsBySeller, getSavedListingIds, getUserById, getUserReviews } from "@/lib/api";

/** Public profile of any user: their rating, the listings they have posted, and their reviews. */
export default async function PublicProfilePage({
  params,
}: PageProps<"/profile/[id]">) {
  const { id } = await params;
  const [user, listings, { reviews, averageRating, reviewCount }, savedIds] = await Promise.all([
    getUserById(id),
    getListingsBySeller(id),
    getUserReviews(id),
    getSavedListingIds(),
  ]);

  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader user={user} listings={listings} averageRating={averageRating} reviewCount={reviewCount} />

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl tracking-tight">
          {listings.length} {listings.length === 1 ? "listing" : "listings"}
        </h2>
        <ListingGrid
          listings={listings}
          savedIds={savedIds}
          emptyTitle="No listings yet"
          emptyDescription="This student has not posted anything."
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl tracking-tight">Reviews</h2>
        <ReviewList reviews={reviews} />
      </section>
    </div>
  );
}
