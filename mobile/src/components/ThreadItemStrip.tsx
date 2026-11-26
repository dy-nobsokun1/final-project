// The strip at the top of a chat: which item the chat is about. Tap it to open the item page.
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { apiFetch } from "@/lib/api";
import { formatListingPrice } from "@/lib/format";
import { colors } from "@/theme";
import type { ListingWithSeller } from "@/types";

export function ThreadItemStrip({ listingId }: { listingId: string }) {
  const [listing, setListing] = useState<ListingWithSeller | null>(null);
  useEffect(() => {
    apiFetch<{ listing: ListingWithSeller }>(`/api/listings/${listingId}`)
      .then((data) => setListing(data.listing))
      .catch(() => {}); // the chat still works without the strip
  }, [listingId]);
  if (!listing) return null;

  return (
    <Pressable style={styles.strip} onPress={() => router.push(`/listings/${listingId}`)} accessibilityRole="link">
      <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
      <Text style={styles.price}>{formatListingPrice(listing)} ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: colors.card,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.cardText },
  price: { fontSize: 15, fontWeight: "800", color: colors.cardText },
});
