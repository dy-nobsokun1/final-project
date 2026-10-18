import { Heart } from "lucide-react";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { getSavedListings, requireUser } from "@/lib/api";

export const metadata = { title: "Saved listings | UniSwap" };

/** The listings you saved with the heart, most recently saved first. Sold ones stay, marked sold. */
export default async function SavedPage() {
  await requireUser();
  const listings = await getSavedListings();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Saved</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {listings.length} saved {listings.length === 1 ? "listing" : "listings"}. You get an alert when an
          item for sale here gets cheaper.
        </p>
      </header>

      <ListingGrid
        listings={listings}
        savedIds={listings.map((listing) => listing.id)}
        emptyIcon={Heart}
        emptyTitle="Nothing saved yet"
        emptyDescription="Tap the heart on a listing to keep it here and hear when its price drops."
        emptyAction={{ href: "/", label: "Browse listings" }}
      />
    </div>
  );
}
