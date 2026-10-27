import { RatingStars } from "@/components/profile/RatingStars";
import { StatsLockedCard } from "@/components/profile/StatsLockedCard";
import { StatsSection } from "@/components/profile/StatsSection";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { UserStats } from "@/types";

/** "3 sales", "1 trade". */
function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * "Your stats" on your own profile only (it shows money): a progress card until the stats unlock,
 * then a Selling and a Buying side, each left out when it has no deals.
 */
export function ProfileDashboard({ stats }: { stats: UserStats }) {
  const badge = stats.deals >= 10 ? "Top seller" : stats.deals >= 5 ? "Active trader" : null;
  const rating =
    stats.averageRating === null ? (
      <span className="font-sans text-sm tracking-normal">No reviews yet</span>
    ) : (
      <span className="flex items-center gap-1.5 font-sans text-sm tracking-normal">
        <RatingStars rating={stats.averageRating} />
        {stats.averageRating} · {plural(stats.reviewCount, "review")}
      </span>
    );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-2xl tracking-tight">Your stats</h2>
        {badge ? <Badge className="bg-brand-50 text-brand-ink">{badge}</Badge> : null}
      </div>

      {stats.unlocked ? (
        <>
          <p className="text-sm text-muted-foreground">
            {plural(stats.deals, "deal")}: {plural(stats.sales, "sale")}, {plural(stats.trades, "trade")} and{" "}
            {plural(stats.purchases, "purchase")}. Only you can see this section.
          </p>
          {stats.soldListings > 0 ? (
            <StatsSection
              title="Selling"
              figures={[
                { label: "Earned in total", value: formatPrice(stats.earned) },
                { label: "Sold or traded", value: stats.soldListings },
                { label: "Still active", value: stats.activeListings },
                { label: "Rating", value: rating },
              ]}
              barsTitle="Earnings per month"
              months={stats.months.map(({ month, earned }) => ({ month, amount: earned }))}
              ringTitle="Sold by category"
              categories={stats.soldByCategory}
            />
          ) : null}
          {stats.purchases > 0 ? (
            <StatsSection
              title="Buying"
              figures={[
                { label: "Spent in total", value: formatPrice(stats.spent) },
                { label: "Bought", value: stats.purchases },
              ]}
              barsTitle="Spending per month"
              months={stats.months.map(({ month, spent }) => ({ month, amount: spent }))}
              ringTitle="Bought by category"
              categories={stats.boughtByCategory}
            />
          ) : null}
        </>
      ) : (
        <StatsLockedCard deals={stats.deals} unlockDeals={stats.unlockDeals} />
      )}
    </section>
  );
}
