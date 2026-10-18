"use client";

import { useState } from "react";
import { ListingImage } from "@/components/listings/ListingImage";
import { cn } from "@/lib/utils";

/** A listing's photos on its page: one large photo, and a thumbnail per photo to switch between them. */
export function ListingGallery({ imageUrls, title }: { imageUrls: string[]; title: string }) {
  const [selected, setSelected] = useState(0);
  const count = imageUrls.length;
  // After an edit removes photos, the remembered position may be gone.
  const shown = selected < count ? selected : 0;

  return (
    <div className="flex flex-col gap-2">
      <ListingImage
        src={imageUrls[shown]}
        alt={count > 1 ? `${title}, photo ${shown + 1} of ${count}` : title}
        className="aspect-[4/3] w-full rounded-xl border border-border"
      />
      {count > 1 ? (
        <ul className="grid grid-cols-6 gap-2">
          {imageUrls.map((url, index) => (
            // The index is a fine key: this list never reorders while it is shown.
            <li key={index}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show photo ${index + 1} of ${count}`}
                aria-current={index === shown ? "true" : undefined}
                className={cn(
                  "block w-full overflow-hidden rounded-lg border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  index === shown ? "border-primary" : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                <ListingImage src={url} alt="" className="aspect-square w-full" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
