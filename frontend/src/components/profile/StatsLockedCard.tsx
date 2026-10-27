interface StatsLockedCardProps {
  deals: number;
  /** How many deals unlock the charts (UNLOCK_DEALS in the API, 3). */
  unlockDeals: number;
}

/** Shown on your own profile until you have enough deals for the stats to mean something. */
export function StatsLockedCard({ deals, unlockDeals }: StatsLockedCardProps) {
  const left = unlockDeals - deals;

  return (
    <div className="light-surface flex flex-col gap-3 rounded-3xl border border-border bg-brand-50 p-5 sm:p-6">
      <p className="font-semibold">
        {deals} / {unlockDeals} deals: complete {left} more to unlock your stats
      </p>
      <div
        role="progressbar"
        aria-label="Deals completed"
        aria-valuemin={0}
        aria-valuemax={unlockDeals}
        aria-valuenow={deals}
        className="h-3 overflow-hidden rounded-full bg-brand-200"
      >
        <div className="h-full rounded-full bg-brand-900" style={{ width: `${(deals / unlockDeals) * 100}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">
        A deal is an item you sold, bought or traded here: paid online, won at auction, or bought at a price the
        seller accepted. Your earnings and spending will then show here, only to you.
      </p>
    </div>
  );
}
