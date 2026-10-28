"use client";

import { Field } from "@/components/forms/Field";
import { PhotoAddBox } from "@/components/forms/PhotoAddBox";
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
  return (
    <Field
      label="Photos (optional)"
      error={[...photos.errors, error].filter(Boolean).join(" ") || undefined}
    >
      <PhotoAddBox
        disabled={photos.items.length >= MAX_LISTING_PHOTOS}
        onFiles={(files) => void photos.addFiles(files)}
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
