import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { RatingStars } from "@/components/profile/RatingStars";
import { ReviewList } from "@/components/profile/ReviewList";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { getListingsBySeller, getUserById, getUserReviews } from "@/lib/api";

/** Public profile of any user: their rating, the listings they have posted, and their reviews. */
export default async function PublicProfilePage({
  params,
}: PageProps<"/profile/[id]">) {
  const { id } = await params;
  const [user, listings, { reviews, averageRating, reviewCount }] = await Promise.all([
    getUserById(id),
    getListingsBySeller(id),
    getUserReviews(id),
  ]);

  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <UserAvatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
            {user.name}
            <VerifiedBadge isVerified={user.isVerified} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {[user.major, user.graduationYear && `Class of ${user.graduationYear}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <Badge
            variant={user.isVerified ? "secondary" : "outline"}
            className="w-fit"
          >
            {user.isVerified ? "Verified student" : "Unverified"}
          </Badge>
          {averageRating !== null ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <RatingStars rating={averageRating} />
              {averageRating} · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          ) : null}
        </div>
      </header>

      {user.bio ? <p className="text-sm text-foreground">{user.bio}</p> : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {listings.length} {listings.length === 1 ? "listing" : "listings"}
        </h2>
        <ListingGrid
          listings={listings}
          emptyTitle="No listings yet"
          emptyDescription="This student has not posted anything."
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Reviews</h2>
        <ReviewList reviews={reviews} />
      </section>
    </div>
  );
}

