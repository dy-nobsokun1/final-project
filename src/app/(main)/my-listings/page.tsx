import { Tag } from "lucide-react";
import Link from "next/link";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { Button } from "@/components/ui/button";
import { getMyListings } from "@/lib/api";

export const metadata = { title: "My listings | UniSwap" };

export default async function MyListingsPage() {
  const listings = await getMyListings();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">My listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.length} {listings.length === 1 ? "listing" : "listings"} posted
          </p>
        </div>
        <Link href="/listings/new">
          <Button>New listing</Button>
        </Link>
      </header>

      <ListingGrid
        listings={listings}
        emptyIcon={Tag}
        emptyTitle="You have not posted anything yet"
        emptyDescription="List a textbook, a desk, or a bike and it will show up here."
        emptyAction={{ href: "/listings/new", label: "Create your first listing" }}
      />
    </div>
  );
}

