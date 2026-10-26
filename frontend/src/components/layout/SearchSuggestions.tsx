import { Search } from "lucide-react";
import { ListingImage } from "@/components/listings/ListingImage";
import { cn } from "@/lib/utils";
import type { SearchSuggestion } from "@/types";

interface SearchSuggestionsProps {
  /** The listbox's id. Row i gets the id `${id}-${i}`, for the input's aria-activedescendant. */
  id: string;
  suggestions: SearchSuggestion[];
  /** The text these suggestions were found for, for the "No items match" line. */
  resultsFor: string;
  /** What the box holds now, for the "See all results" row. */
  query: string;
  /** The highlighted row (the last one is "See all results"), or -1 for none. */
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
}

/**
 * The dropdown under the navbar search box: up to 5 listings, then "See all results". Focus stays
 * in the input (the combobox pattern), so the rows are not focusable, and pressing on one does not
 * take focus away, which would close the list before the click lands.
 */
export function SearchSuggestions({ id, suggestions, resultsFor, query, activeIndex, onHover, onPick }: SearchSuggestionsProps) {
  // Highlighted: black on #B1D3B9 is 12.9:1. Otherwise #E6F2DD on #31443E is 8.9:1, the price 6.4:1.
  const rowClass = (index: number) =>
    cn(
      "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm",
      index === activeIndex ? "bg-brand-200 text-brand-ink" : "text-brand-50",
    );

  return (
    <div
      onMouseDown={(event) => event.preventDefault()}
      className="absolute inset-x-0 top-full z-50 mt-1.5 rounded-xl border border-brand-200/50 bg-brand-deep-2 p-1.5 shadow-lg"
    >
      {suggestions.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-brand-200">No items match &ldquo;{resultsFor}&rdquo;</p>
      ) : null}
      <ul id={id} role="listbox" aria-label="Search suggestions">
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseMove={() => onHover(index)}
            onClick={() => onPick(index)}
            className={rowClass(index)}
          >
            {/* The title names the item, so screen readers skip the photo (and its no-photo text). */}
            <span aria-hidden="true" className="shrink-0">
              <ListingImage src={suggestion.imageUrl ?? undefined} alt="" className="size-10 rounded-md [&_svg]:size-5" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{suggestion.title}</span>
            <span className={cn("shrink-0", index === activeIndex ? "text-brand-ink" : "text-brand-200")}>
              {suggestion.priceText}
            </span>
          </li>
        ))}
        <li
          id={`${id}-${suggestions.length}`}
          role="option"
          aria-selected={activeIndex === suggestions.length}
          onMouseMove={() => onHover(suggestions.length)}
          onClick={() => onPick(suggestions.length)}
          className={cn(rowClass(suggestions.length), "font-semibold")}
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="min-w-0 truncate">See all results for &ldquo;{query.trim()}&rdquo;</span>
        </li>
      </ul>
    </div>
  );
}
