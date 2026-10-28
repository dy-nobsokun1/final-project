"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteListing, updateListingStatus, type ActionResult } from "@/lib/api/actions";
import type { ListingStatus, ListingType } from "@/types";

interface ListingOwnerActionsProps {
  listingId: string;
  listingType: ListingType;
  status: ListingStatus;
}

/** Shown to a listing's owner in place of "Message seller": close it, relist it, edit it, or delete it. */
export function ListingOwnerActions({ listingId, listingType, status }: ListingOwnerActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const closedStatus: ListingStatus = listingType === "trade" ? "traded" : "sold";

  async function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setIsBusy(true);
    setError(null);
    const result = await action();
    setIsBusy(false);
    if (result.error) setError(result.error);
    else onSuccess?.();
  }

  function handleDelete() {
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    void run(() => deleteListing(listingId), () => router.push("/my-listings"));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {/* A reserved item (an accepted offer, a won auction) is usually sold next. Selling it straight
            from "reserved" keeps the buyer an accepted offer reserved it for, so the two can review each other. */}
        {status === "active" || status === "reserved" ? (
          <Button disabled={isBusy} onClick={() => run(() => updateListingStatus(listingId, closedStatus))}>
            Mark as {closedStatus}
          </Button>
        ) : null}
        {status === "active" ? (
          <Button
            variant="secondary"
            disabled={isBusy}
            onClick={() => run(() => updateListingStatus(listingId, "reserved"))}
          >
            Mark reserved
          </Button>
        ) : (
          <Button
            variant={status === "reserved" ? "secondary" : "default"}
            disabled={isBusy}
            onClick={() => run(() => updateListingStatus(listingId, "active"))}
          >
            Make available again
          </Button>
        )}
        <Button variant="secondary" disabled={isBusy} onClick={() => router.push(`/listings/${listingId}/edit`)}>
          Edit
        </Button>
        {/* The API keeps sold and traded listings as a record of the deal, so they cannot be deleted. */}
        {status === "sold" || status === "traded" ? null : (
          <Button variant="destructive" disabled={isBusy} onClick={handleDelete}>
            Delete
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
