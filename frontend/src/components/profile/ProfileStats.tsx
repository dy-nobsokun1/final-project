import { RatingStars } from "@/components/profile/RatingStars";
import type { Listing } from "@/types";

interface ProfileStatsProps {
  /** Everything the user has posted, in any status. */
  listings: Pick<Listing, "status">[];
  averageRating: number | null;
  reviewCount: number;
  /** When the account was created (ISO date). */
  createdAt: string;
}

/** The numbers in a profile header: listings, sales, rating and when they joined. */
export function ProfileStats({ listings, averageRating, reviewCount, createdAt }: ProfileStatsProps) {
  const stats = [
    { label: "Active listings", value: listings.filter((listing) => listing.status === "active").length },
    {
      label: "Items sold",
      value: listings.filter((listing) => listing.status === "sold" || listing.status === "traded").length,
    },
    {
      label: "Member since",
      value: new Date(createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col">
          <dt className="text-xs font-semibold text-muted-foreground">{stat.label}</dt>
          <dd className="font-heading text-2xl tracking-wide">{stat.value}</dd>
        </div>
      ))}
      {/* No reviews yet: nothing to show, rather than five empty stars. */}
      {averageRating !== null ? (
        <div className="flex flex-col">
          <dt className="text-xs font-semibold text-muted-foreground">Rating</dt>
          <dd className="flex flex-wrap items-center gap-x-1.5 text-sm">
            <RatingStars rating={averageRating} />
            {averageRating} · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
