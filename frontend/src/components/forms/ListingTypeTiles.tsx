import { Tag } from "lucide-react";
import { LISTING_TYPE_TAGS } from "@/components/listings/ListingTypeTag";
import { listingTypeLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ListingType } from "@/types";

/** Sale has no tag on the cards (it is the default), so its tile gets its own icon and colour. */
const SALE_TILE = { icon: Tag, colours: "bg-brand-600 text-brand-ink" };

/** The order the form offers them in, the most common first. */
const TYPES: ListingType[] = ["sale", "auction", "trade", "giveaway", "buy_request"];

interface ListingTypeTilesProps {
  value: string;
  onChange: (value: ListingType) => void;
  error?: string;
}

/**
 * The listing form's type picker: one tile per type, with the same icons and colours as the tags on
 * the cards (ListingTypeTag). Each tile is a real radio button, only visually hidden, so arrow keys
 * move between them, screen readers read "radio button, 1 of 5", and the form still submits
 * `listingType` as the old dropdown did.
 */
export function ListingTypeTiles({ value, onChange, error }: ListingTypeTilesProps) {
  return (
    <fieldset aria-describedby={error ? "listing-type-error" : undefined}>
      <legend className="mb-1.5 text-sm leading-none font-medium">Listing type</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {TYPES.map((type) => {
          const { icon: Icon, colours } = type === "sale" ? SALE_TILE : LISTING_TYPE_TAGS[type];
          return (
            <label
              key={type}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-brand-600/40 bg-brand-50/40 p-3 text-sm font-medium transition-colors hover:bg-brand-50/70 has-checked:border-brand-ink has-checked:bg-brand-50 has-checked:ring-1 has-checked:ring-brand-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-ink"
            >
              <input
                type="radio"
                name="listingType"
                value={type}
                checked={value === type}
                onChange={() => onChange(type)}
                className="sr-only"
              />
              <span className={cn("flex size-8 items-center justify-center rounded-full ring-1 ring-black/10", colours)}>
                <Icon aria-hidden="true" className="size-4" />
              </span>
              {listingTypeLabel(type)}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id="listing-type-error" role="alert" className="mt-1.5 text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
