// Loads the Browse list: GET /api/listings with the search words and category (active items only,
// the API's default). Asks again when either changes, and on pull-to-refresh.
import { useEffect, useState } from "react";

import { apiFetch, errorMessage } from "@/lib/api";
import type { ListingCategory, ListingWithSeller } from "@/types";

export function useListings(query: string, category: ListingCategory | null) {
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloads, setReloads] = useState(0); // bumped by refresh() to ask again

  useEffect(() => {
    let current = true; // false once a newer search started, so an old answer is ignored
    let path = "/api/listings?limit=40";
    if (query) path += `&query=${encodeURIComponent(query)}`;
    if (category) path += `&category=${category}`;
    setLoading(true);
    apiFetch<{ listings: ListingWithSeller[] }>(path)
      .then((data) => {
        if (!current) return;
        setListings(data.listings);
        setError(null);
      })
      .catch((err) => {
        if (current) setError(errorMessage(err));
      })
      .finally(() => {
        if (!current) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      current = false;
    };
  }, [query, category, reloads]);

  function refresh() {
    setRefreshing(true);
    setReloads((count) => count + 1);
  }

  return { listings, error, loading, refreshing, refresh };
}
