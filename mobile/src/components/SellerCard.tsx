// Who posted the item: their initial, name, a Verified badge, and their stars from reviews
// (GET /api/users/:id/reviews). If the stars cannot load, the card just leaves them out.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { apiFetch } from "@/lib/api";
import { colors, radius } from "@/theme";
import type { ListingWithSeller, ReviewSummary } from "@/types";

/** "★★★★☆ 4.3 (6 reviews)", or "No reviews yet". */
function starsText(summary: ReviewSummary): string {
  if (summary.averageRating === null) return "No reviews yet";
  const full = Math.round(summary.averageRating);
  const reviews = summary.reviewCount === 1 ? "1 review" : `${summary.reviewCount} reviews`;
  return `${"★".repeat(full)}${"☆".repeat(5 - full)} ${summary.averageRating} (${reviews})`;
}

export function SellerCard({ seller, wanted }: { seller: ListingWithSeller["seller"]; wanted: boolean }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    apiFetch<ReviewSummary>(`/api/users/${seller.id}/reviews`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [seller.id]);

  return (
    <View style={styles.card}>
      <Text style={styles.initial}>{seller.name.charAt(0).toUpperCase()}</Text>
      <View style={styles.text}>
        <Text style={styles.label}>{wanted ? "Looking for it" : "Seller"}</Text>
        <Text style={styles.name}>
          {seller.name}
          {seller.isVerified ? "  ✓ Verified" : ""}
        </Text>
        {summary ? <Text style={styles.stars}>{starsText(summary)}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 16, flexDirection: "row", gap: 14, alignItems: "center" },
  initial: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.dark, color: colors.inset,
    fontSize: 22, fontWeight: "800", textAlign: "center", lineHeight: 52, overflow: "hidden",
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 13, color: colors.cardText, opacity: 0.7 },
  name: { fontSize: 17, fontWeight: "800", color: colors.cardText },
  stars: { fontSize: 15, color: colors.cardText },
});
