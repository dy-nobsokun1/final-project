import { useEffect, useState } from "react";
import type { SearchSuggestion } from "@/types";

/** Suggestions start once the box has this many characters (not counting spaces at the ends). */
const MIN_CHARS = 2;
/** How long typing must pause before asking, so each key press does not send a request. */
const PAUSE_MS = 250;

/** The last answer, with the text it was for (the box may already hold newer text). */
export interface SuggestionsAnswer {
  query: string;
  results: SearchSuggestion[];
}

/**
 * Listings matching `query`, for the navbar search box, from the Next server's
 * /api/search-suggestions route. It asks once typing pauses. A newer query cancels the older
 * request, and an answer that still arrives late is ignored, so typing "ra" then "ram" always ends
 * on the "ram" results. The last answer stays until the next one arrives, so rows never flash
 * empty while it loads. Returns null while the query is too short or nothing has come back yet.
 */
export function useSearchSuggestions(query: string): SuggestionsAnswer | null {
  const [answer, setAnswer] = useState<SuggestionsAnswer | null>(null);
  const term = query.trim();

  useEffect(() => {
    if (term.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const results: SearchSuggestion[] = response.ok ? await response.json() : [];
        if (!controller.signal.aborted) setAnswer({ query: term, results });
      } catch {
        // Cancelled by a newer query, or the network failed: keep the rows already shown.
      }
    }, PAUSE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  return term.length < MIN_CHARS ? null : answer;
}
