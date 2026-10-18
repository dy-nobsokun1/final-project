import { useRef, useState } from "react";
import { uploadListingPhoto, type ActionResult } from "@/lib/api/actions";
import { MAX_LISTING_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/constants";

/** One photo on the listing form. `url` is null while it is still uploading. */
export interface FormPhoto {
  key: string;
  name: string;
  url: string | null;
}

/**
 * The photos on the listing form, in order (the first is the cover). Each picked file is uploaded
 * right away, so saving the listing only sends URLs. Starts with the listing's current photos when editing.
 */
export function useListingPhotos(initialUrls: string[]) {
  // Old data may hold the same URL twice; the API refuses duplicates, so they are dropped here.
  const [items, setItems] = useState<FormPhoto[]>(() =>
    [...new Set(initialUrls)].map((url) => ({ key: url, name: "", url })),
  );
  const [errors, setErrors] = useState<string[]>([]);
  // Not crypto.randomUUID: it is missing outside secure contexts (a phone on http://LAN-IP).
  const nextKey = useRef(0);

  async function addFiles(files: File[]) {
    const room = Math.max(MAX_LISTING_PHOTOS - items.length, 0);
    const problems: string[] = [];
    if (files.length > room) {
      problems.push(`Only ${MAX_LISTING_PHOTOS} photos fit, so ${files.length - room} were left out.`);
    }
    const accepted = files.slice(0, room).filter((file) => {
      if (file.size <= MAX_PHOTO_BYTES) return true;
      problems.push(`${file.name} is over 5 MB.`);
      return false;
    });
    setErrors(problems);

    const added = accepted.map((file) => ({ file, key: `new-${nextKey.current++}` }));
    setItems((current) => [...current, ...added.map(({ file, key }) => ({ key, name: file.name, url: null }))]);

    // One at a time and in order: Next.js sends Server Actions one after another anyway.
    for (const { file, key } of added) {
      const data = new FormData();
      data.set("photo", file);
      // The call itself can fail in the browser (network down, a new deployment). That becomes an
      // error message too, never a tile stuck on "Uploading...".
      const result = await uploadListingPhoto(data).catch(
        (): ActionResult & { url?: string } => ({ error: "The upload failed. Check your connection and try again." }),
      );
      const url = result.url;
      if (url) {
        setItems((current) => current.map((photo) => (photo.key === key ? { ...photo, url } : photo)));
      } else {
        setItems((current) => current.filter((photo) => photo.key !== key));
        setErrors((current) => [...current, `${file.name}: ${result.error ?? "Upload failed."}`]);
      }
    }
  }

  function remove(key: string) {
    setItems((current) => current.filter((photo) => photo.key !== key));
  }

  /** Moves a photo to the front, which makes it the cover. */
  function makeCover(key: string) {
    setItems((current) => {
      const photo = current.find((item) => item.key === key);
      return photo ? [photo, ...current.filter((item) => item !== photo)] : current;
    });
  }

  return { items, errors, isUploading: items.some((photo) => photo.url === null), addFiles, remove, makeCover };
}

export type ListingPhotos = ReturnType<typeof useListingPhotos>;
