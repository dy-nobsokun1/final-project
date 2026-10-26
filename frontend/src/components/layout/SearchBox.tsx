"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type KeyboardEvent } from "react";
import { SearchSuggestions } from "@/components/layout/SearchSuggestions";
import { useSearchSuggestions } from "@/hooks/use-search-suggestions";

/**
 * The navbar's search box. Typing opens suggestions under it (SearchSuggestions). ↓ and ↑ move
 * through them, Enter opens the highlighted one, and Esc closes the list and keeps the text.
 * With nothing highlighted, Enter searches the home page as before.
 */
export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Only asks while the list is open, so a page loaded with ?q= does not fetch suggestions.
  const answer = useSearchSuggestions(isOpen ? query : "");
  const listboxId = useId();

  const suggestions = answer?.results ?? [];
  const searchHref = query ? `/?q=${encodeURIComponent(query)}` : "/";
  // The rows, in order: each suggestion, then "See all results".
  const hrefs = [...suggestions.map((suggestion) => `/listings/${suggestion.id}`), searchHref];
  const isShown = isOpen && answer !== null;

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const last = hrefs.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); // keeps the caret where it is
      if (!isShown) {
        setIsOpen(true);
      } else if (event.key === "ArrowDown") {
        // From nothing highlighted (-1) or the last row, ↓ goes to the first row.
        setActiveIndex(activeIndex >= last ? 0 : activeIndex + 1);
      } else {
        // From nothing highlighted or the first row, ↑ goes to the last row.
        setActiveIndex(activeIndex <= 0 ? last : activeIndex - 1);
      }
    } else if (event.key === "Enter" && isShown && activeIndex >= 0) {
      event.preventDefault();
      go(hrefs[activeIndex]);
    } else if (event.key === "Escape" && isShown) {
      event.preventDefault(); // a search input would otherwise clear its text
      close();
    }
  }

  return (
    <form
      role="search"
      className="relative flex-1 max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        go(searchHref);
      }}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-200"
      />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={close}
        placeholder="Search listings"
        aria-label="Search listings"
        role="combobox"
        aria-expanded={isShown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={isShown && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
        className="h-9 w-full rounded-full border border-input bg-brand-deep-2 pl-9 pr-3 text-sm text-brand-50 transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-brand-600 focus:text-brand-ink focus:outline-none"
      />
      {isShown ? (
        <SearchSuggestions
          id={listboxId}
          suggestions={suggestions}
          resultsFor={answer.query}
          query={query}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onPick={(index) => go(hrefs[index])}
        />
      ) : null}
      <p role="status" className="sr-only">
        {isShown ? `${suggestions.length || "No"} suggestion${suggestions.length === 1 ? "" : "s"}` : ""}
      </p>
    </form>
  );
}
