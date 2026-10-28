"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuctionFields } from "@/components/forms/AuctionFields";
import { Field, FieldInput, FieldTextarea } from "@/components/forms/Field";
import { FieldSelect } from "@/components/forms/FieldSelect";
import { ListingTypeTiles } from "@/components/forms/ListingTypeTiles";
import { PhotoPicker } from "@/components/forms/PhotoPicker";
import { Button } from "@/components/ui/button";
import { useListingPhotos } from "@/hooks/use-listing-photos";
import { createListing, updateListing } from "@/lib/api/actions";
import { CATEGORIES, CONDITIONS, priceFieldLabel } from "@/lib/constants";
import { DEMO_PRESETS, getDemoAuctionEndsAt } from "@/lib/demo-presets";
import type { Listing, ListingCategory, ListingCondition, ListingDraft, ListingType } from "@/types";

/** Matches the API's longest auction (MAX_AUCTION_DAYS in backend/src/utils/validation.js). */
const MAX_AUCTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Create-a-listing form with presentation demo helpers:
 * - Faded placeholder text that turns darker and solid on Tab (Chatbot UX pattern).
 * - Automatic background photo upload of authentic real photography from Unsplash.
 * - Instant fallback to demo presets on submit to eliminate validation errors during live demos.
 * - Tab key naturally advances focus to next fields.
 */
export function NewListingForm({ listing, draft }: { listing?: Listing; draft?: ListingDraft }) {
  const start = listing ?? draft;
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listingType, setListingType] = useState<ListingType>((start?.listingType as ListingType) ?? "sale");

  const currentPreset = DEMO_PRESETS[listingType] ?? DEMO_PRESETS.sale;

  // Fields start empty so the faded placeholder shows (Chatbot UX). Tab fills them into solid dark text.
  const [title, setTitle] = useState(start?.title ?? "");
  const [description, setDescription] = useState(start?.description ?? "");
  const [price, setPrice] = useState(start?.price !== undefined ? String(start.price) : "");
  const [category, setCategory] = useState<ListingCategory>(start?.category ?? currentPreset.category);
  const [condition, setCondition] = useState<ListingCondition>(listing?.condition ?? currentPreset.condition);
  const [auctionEndsAt, setAuctionEndsAt] = useState(listing?.auction?.endsAt ?? "");
  const [minIncrement, setMinIncrement] = useState(
    listing?.auction?.minIncrement !== undefined ? String(listing.auction.minIncrement) : "",
  );

  const photos = useListingPhotos(listing?.imageUrls ?? []);
  const lockedByBids = (listing?.auction?.bidCount ?? 0) > 0;

  // Once the user clicks the close/remove button on the dummy image, it stays removed
  // for the rest of the session and only reappears if the page is reloaded.
  const photoDismissedRef = useRef(false);

  const wrappedPhotos = useMemo(
    () => ({
      ...photos,
      remove: (key: string) => {
        photoDismissedRef.current = true;
        photos.remove(key);
      },
    }),
    [photos],
  );

  // Track the last loaded listing type to eliminate flickering and duplicate fetches on mount/render
  const lastLoadedType = useRef<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    if (listing || photoDismissedRef.current) return;
    if (lastLoadedType.current === listingType) return;
    lastLoadedType.current = listingType;
    const preset = DEMO_PRESETS[listingType];
    if (preset) {
      void photosRef.current.setFromUrl(preset.photoUrl);
    }
  }, [listingType, listing]);

  const populatePreset = useCallback(
    (type: ListingType) => {
      const preset = DEMO_PRESETS[type] ?? DEMO_PRESETS.sale;
      setTitle(preset.title);
      setDescription(preset.description);
      setPrice(String(preset.price));
      setCategory(preset.category);
      setCondition(preset.condition);
      if (type === "auction") {
        setAuctionEndsAt(preset.getAuctionEndsAt?.() ?? getDemoAuctionEndsAt());
        setMinIncrement(String(preset.minIncrement ?? 5));
      }
      if (!photoDismissedRef.current) {
        void photosRef.current.setFromUrl(preset.photoUrl);
      }
    },
    [],
  );

  // Keyboard shortcut Alt + D (or Option + D on macOS) triggers instant auto-fill
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        (event.code === "KeyD" || event.key.toLowerCase() === "d" || event.key === "∂")
      ) {
        event.preventDefault();
        populatePreset(listingType);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [listingType, populatePreset]);

  function handleTypeChange(nextType: ListingType) {
    setListingType(nextType);
    const preset = DEMO_PRESETS[nextType] ?? DEMO_PRESETS.sale;
    setCategory(preset.category);
    setCondition(preset.condition);
    if (!listing) {
      // Clear text so the new preset's faded placeholder shows
      setTitle("");
      setDescription("");
      setPrice("");
      setAuctionEndsAt("");
      setMinIncrement("");
    }
  }

  function handleClear() {
    setTitle("");
    setDescription("");
    setPrice("");
    setCategory(currentPreset.category);
    setCondition(currentPreset.condition);
    setAuctionEndsAt("");
    setMinIncrement("");
    photos.clear();
    setErrors({});
  }

  // Tab in an empty input fills in the preset text (turning faded placeholder into dark solid text)
  // and allows native Tab focus to naturally advance to the next field.
  function handleTitleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Tab" || event.shiftKey || title !== "") return;
    setTitle(currentPreset.title);
  }

  function handleDescriptionKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey || description !== "") return;
    setDescription(currentPreset.description);
  }

  function handlePriceKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Tab" || event.shiftKey || (price !== "" && price !== "0")) return;
    setPrice(String(currentPreset.price));
  }

  function handleEndsAtKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Tab" || event.shiftKey || auctionEndsAt !== "") return;
    setAuctionEndsAt(currentPreset.getAuctionEndsAt?.() ?? getDemoAuctionEndsAt());
  }

  function handleMinIncrementKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Tab" || event.shiftKey || minIncrement !== "") return;
    setMinIncrement(String(currentPreset.minIncrement ?? 5));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    // If any field is still empty, fallback to the preset value so demo submissions always pass!
    const titleVal = (String(data.get("title") ?? "").trim() || currentPreset.title).trim();
    const descVal = (String(data.get("description") ?? "").trim() || currentPreset.description).trim();
    const rawPrice = String(data.get("price") ?? "").trim();
    const priceVal =
      listingType === "giveaway"
        ? 0
        : Number(rawPrice !== "" && rawPrice !== "0" ? rawPrice : currentPreset.price);
    const catVal = String(data.get("category") ?? "").trim() || currentPreset.category;
    const condVal = String(data.get("condition") ?? "").trim() || currentPreset.condition;

    data.set("title", titleVal);
    data.set("description", descVal);
    data.set("category", catVal);
    data.set("condition", condVal);
    if (listingType !== "giveaway") {
      data.set("price", String(priceVal));
    }

    const next: Record<string, string> = {};
    if (titleVal.length < 5) next.title = "Use at least 5 characters.";
    if (!Number.isFinite(priceVal) || priceVal < 0) next.price = "Enter a valid price.";
    if (descVal.length < 20) next.description = "Describe the item in at least 20 characters.";
    if (photos.isUploading) next.imageUrls = "Wait for the photos to finish uploading.";

    if (listingType === "auction" && !lockedByBids) {
      const endsAtStr =
        String(data.get("auctionEndsAt") ?? "").trim() ||
        currentPreset.getAuctionEndsAt?.() ||
        getDemoAuctionEndsAt();
      const endsAt = new Date(endsAtStr).getTime();
      if (!Number.isFinite(endsAt) || endsAt <= Date.now() || endsAt > Date.now() + MAX_AUCTION_MS) {
        next.auctionEndsAt = "Pick a time in the future, within 30 days.";
      } else {
        data.set("auctionEndsAt", new Date(endsAt).toISOString());
      }
      const minInc = Number(String(data.get("minIncrement") ?? "").trim() || currentPreset.minIncrement || 5);
      if (!(minInc > 0)) {
        next.minIncrement = "Enter an amount above 0.";
      } else {
        data.set("minIncrement", String(minInc));
      }
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
        <ListingTypeTiles value={listingType} onChange={handleTypeChange} error={errors.listingType} />
      ) : null}

      <Field label="Title" error={errors.title}>
        <FieldInput
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder={currentPreset.title}
          className="bg-brand-50/40 text-foreground placeholder:text-foreground/45"
        />
      </Field>

      <Field label="Description" error={errors.description}>
        <FieldTextarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleDescriptionKeyDown}
          rows={5}
          placeholder={currentPreset.description}
          className="bg-brand-50/40 text-foreground placeholder:text-foreground/45"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {listingType !== "giveaway" ? (
          <Field label={priceFieldLabel(listingType)} error={errors.price}>
            <FieldInput
              name="price"
              type="number"
              min={0}
              step="1"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={handlePriceKeyDown}
              placeholder={String(currentPreset.price)}
              disabled={lockedByBids}
              className="bg-brand-50/40 text-foreground placeholder:text-foreground/45"
            />
          </Field>
        ) : null}
        <Field label="Category" error={errors.category}>
          <FieldSelect
            name="category"
            value={category}
            onValueChange={(val) => setCategory(val as ListingCategory)}
            options={CATEGORIES}
          />
        </Field>
        <Field label="Condition" error={errors.condition}>
          <FieldSelect
            name="condition"
            value={condition}
            onValueChange={(val) => setCondition(val as ListingCondition)}
            options={CONDITIONS}
          />
        </Field>
      </div>

      {listingType === "auction" && !lockedByBids ? (
        <AuctionFields
          errors={errors}
          endsAt={listing?.auction?.endsAt}
          minIncrement={listing?.auction?.minIncrement}
          valueEndsAt={auctionEndsAt}
          onChangeEndsAt={setAuctionEndsAt}
          onKeyDownEndsAt={handleEndsAtKeyDown}
          placeholderEndsAt={currentPreset.getAuctionEndsAt?.() ?? getDemoAuctionEndsAt()}
          valueMinIncrement={minIncrement}
          onChangeMinIncrement={setMinIncrement}
          onKeyDownMinIncrement={handleMinIncrementKeyDown}
          placeholderMinIncrement={String(currentPreset.minIncrement ?? 5)}
        />
      ) : null}

      {lockedByBids ? (
        <p className="text-sm text-muted-foreground">
          People have already bid, so the type, price and auction settings are locked.
        </p>
      ) : null}

      <PhotoPicker photos={wrappedPhotos} error={errors.imageUrls} />

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" disabled={isSubmitting || photos.isUploading}>
          {photos.isUploading
            ? "Uploading photos..."
            : listing
              ? isSubmitting
                ? "Saving..."
                : "Save changes"
              : isSubmitting
                ? "Publishing..."
                : "Publish listing"}
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
