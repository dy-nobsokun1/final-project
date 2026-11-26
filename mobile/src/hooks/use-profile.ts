// Loads what the Account tab shows for the signed-in student: the totals (GET /api/users/me/stats),
// their own listings in any status (GET /api/users/:id/listings) and what they bought
// (GET /api/users/me/purchases). Asks again each time the tab gets focus, and on pull-to-refresh.
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ListingWithSeller, Purchase, UserStats } from "@/types";

export function useProfile() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [listings, setListings] = useState<ListingWithSeller[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const [statsData, listingData, purchaseData] = await Promise.all([
        apiFetch<{ stats: UserStats }>("/api/users/me/stats", { token }),
        apiFetch<{ listings: ListingWithSeller[] }>(`/api/users/${userId}/listings`, { token }),
        apiFetch<{ purchases: Purchase[] }>("/api/users/me/purchases", { token }),
      ]);
      setStats(statsData.stats);
      setListings(listingData.listings);
      setPurchases(purchaseData.purchases);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [userId, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function refresh() {
    setRefreshing(true);
    load();
  }

  return { stats, listings, purchases, error, refreshing, refresh };
}
