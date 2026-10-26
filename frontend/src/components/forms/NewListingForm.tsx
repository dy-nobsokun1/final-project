"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuctionFields } from "@/components/forms/AuctionFields";
import { Field, FieldInput, FieldTextarea } from "@/components/forms/Field";
import { FieldSelect } from "@/components/forms/FieldSelect";
import { ListingTypeTiles } from "@/components/forms/ListingTypeTiles";
import { PhotoPicker } from "@/components/forms/PhotoPicker";
import { Button } from "@/components/ui/button";
import { useListingPhotos } from "@/hooks/use-listing-photos";
import { createListing, updateListing } from "@/lib/api/actions";
import { CATEGORIES, CONDITIONS, priceFieldLabel } from "@/lib/constants";
import type { Listing } from "@/types";

/** Matches the API's longest auction (MAX_AUCTION_DAYS in backend/src/utils/validation.js). */
const MAX_AUCTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Create-a-listing form. Checks the fields here for quick feedback, then sends the fields and the
 * photo URLs to a Server Action, which creates the listing via the API. Photos upload one by one as
 * soon as they are picked (PhotoPicker), so saving only sends their URLs.
 *
 * Given a `listing`, it edits that listing instead: the fields start filled in and saving updates it.
 * Once an auction has bids, its type, price and auction settings are locked (as in the API).
 */
export function NewListingForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listingType, setListingType] = useState<string>(listing?.listingType ?? "sale");
  const photos = useListingPhotos(listing?.imageUrls ?? []);
  const lockedByBids = (listing?.auction?.bidCount ?? 0) > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const price = Number(data.get("price") ?? 0);
    const description = String(data.get("description") ?? "").trim();

    const next: Record<string, string> = {};
    if (title.length < 5) next.title = "Use at least 5 characters.";
    if (!Number.isFinite(price) || price < 0) next.price = "Enter a valid price.";
    if (description.length < 20) next.description = "Describe the item in at least 20 characters.";
    if (photos.isUploading) next.imageUrls = "Wait for the photos to finish uploading.";
    if (listingType === "auction" && !lockedByBids) {
      // datetime-local gives the user's local time with no zone ("2026-10-04T18:00"). Converting it
      // here, in the browser, keeps the user's time zone; the API receives an exact ISO time.
      const endsAt = new Date(String(data.get("auctionEndsAt") ?? "")).getTime();
      if (!Number.isFinite(endsAt) || endsAt <= Date.now() || endsAt > Date.now() + MAX_AUCTION_MS) {
        next.auctionEndsAt = "Pick a time in the future, within 30 days.";
      } else {
        data.set("auctionEndsAt", new Date(endsAt).toISOString());
      }
      if (!(Number(data.get("minIncrement")) > 0)) next.minIncrement = "Enter an amount above 0.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    const result = listing ? await updateListing(listing.id, data) : await createListing(data);
    if (result.listingId) {
      router.push(`/listings/${result.listingId}`);
      return;
    }
    setIsSubmitting(false);
    const fallback = listing ? "Could not save your changes." : "Could not publish the listing.";
    setErrors({ ...result.fieldErrors, form: result.error ?? fallback });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!lockedByBids ? (
        <ListingTypeTiles value={listingType} onChange={setListingType} error={errors.listingType} />
      ) : null}
      {/* Field box is brand-50 at 40%, which resolves to roughly #C6DFC7 over
          the #B1D3B9 card, and the placeholder sits at 50% for a see-through
          hint. #2E2E2E at 50% measures 2.65:1 against that box -- under the
          4.5:1 AA floor, so raise the placeholder modifier if the hints need
          to be read comfortably. Scoped to this form; the shared Input and
          Textarea keep their default transparent fill. */}
      <Field label="Title" error={errors.title}>
        <FieldInput
          name="title"
          defaultValue={listing?.title}
          placeholder="Calculus: Early Transcendentals, 9th ed."
          className="bg-brand-50/40 placeholder:text-foreground/50"
        />
      </Field>
      <Field label="Description" error={errors.description}>
        <FieldTextarea
          name="description"
          defaultValue={listing?.description}
          rows={5}
          placeholder="Condition, defects, and what is included."
          className="bg-brand-50/40 placeholder:text-foreground/50"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* A giveaway has no price, so the field is hidden and the price is sent as 0.
            A disabled input is left out of the form data, so a locked price is not sent. */}
        {listingType !== "giveaway" ? (
          <Field label={priceFieldLabel(listingType)} error={errors.price}>
            <FieldInput
              name="price"
              type="number"
              min={0}
              step="1"
              inputMode="decimal"
              defaultValue={listing?.price}
              disabled={lockedByBids}
              className="bg-brand-50/40 placeholder:text-foreground/50"
            />
          </Field>
        ) : null}
        <Field label="Category" error={errors.category}>
          <FieldSelect name="category" defaultValue={listing?.category ?? "textbooks"} options={CATEGORIES} />
        </Field>
        <Field label="Condition" error={errors.condition}>
          <FieldSelect name="condition" defaultValue={listing?.condition ?? "good"} options={CONDITIONS} />
        </Field>
      </div>

      {listingType === "auction" && !lockedByBids ? (
        <AuctionFields errors={errors} endsAt={listing?.auction?.endsAt} minIncrement={listing?.auction?.minIncrement} />
      ) : null}
      {lockedByBids ? (
        <p className="text-sm text-muted-foreground">
          People have already bid, so the type, price and auction settings are locked.
        </p>
      ) : null}

      <PhotoPicker photos={photos} error={errors.imageUrls} />

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" disabled={isSubmitting || photos.isUploading}>
          {photos.isUploading ? "Uploading photos..."
            : listing ? (isSubmitting ? "Saving..." : "Save changes")
            : (isSubmitting ? "Publishing..." : "Publish listing")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
      {errors.form ? (
        <p role="alert" className="text-sm text-foreground">
          {errors.form}
        </p>
      ) : null}
    </form>
  );
}
