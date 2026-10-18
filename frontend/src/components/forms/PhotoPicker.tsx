"use client";

import { Field, FieldInput } from "@/components/forms/Field";
import { PhotoThumb } from "@/components/forms/PhotoThumb";
import type { ListingPhotos } from "@/hooks/use-listing-photos";
import { MAX_LISTING_PHOTOS } from "@/lib/constants";

/**
 * Picks, orders and removes a listing's photos (from useListingPhotos). Each file is uploaded as
 * soon as it is picked, so the file input deliberately has no `name`: the files themselves are never
 * part of the listing form. Instead, every uploaded photo adds a hidden `imageUrls` input, in order,
 * and the Server Action sends those URLs to the API.
 */
export function PhotoPicker({ photos, error }: { photos: ListingPhotos; error?: string }) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Cleared so that picking the same file again (e.g. after removing it) still counts as a change.
    event.target.value = "";
    void photos.addFiles(files);
  }

  return (
    <Field
      label={`Photos (optional, up to ${MAX_LISTING_PHOTOS}; the first is the cover)`}
      error={[...photos.errors, error].filter(Boolean).join(" ") || undefined}
    >
      <FieldInput
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={photos.items.length >= MAX_LISTING_PHOTOS}
        onChange={handleChange}
        className="bg-brand-50/40"
      />
      {photos.items.length > 0 ? (
        <ul aria-label="Chosen photos" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.items.map((photo, index) => (
            <PhotoThumb
              key={photo.key}
              photo={photo}
              position={index + 1}
              onRemove={() => photos.remove(photo.key)}
              onMakeCover={() => photos.makeCover(photo.key)}
            />
          ))}
        </ul>
      ) : null}
      {photos.items.map((photo) =>
        photo.url ? <input key={photo.key} type="hidden" name="imageUrls" value={photo.url} /> : null,
      )}
    </Field>
  );
}
