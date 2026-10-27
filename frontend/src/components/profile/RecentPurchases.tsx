import { PurchaseCard } from "@/components/profile/PurchaseCard";
import type { Purchase } from "@/types";

/** Your recent purchases with a way to review the seller. Renders nothing before the first purchase. */
export function RecentPurchases({ purchases }: { purchases: Purchase[] }) {
  if (purchases.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-2xl tracking-tight">Recent purchases</h2>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {purchases.map((purchase) => (
          <PurchaseCard key={purchase.listing.id} purchase={purchase} />
        ))}
      </div>
    </section>
  );
}
