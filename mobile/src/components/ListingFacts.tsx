// A small table of facts on the item page: condition, category, when it was posted, and saves (when there are any).
import { StyleSheet, Text, View } from "react-native";

import { categoryLabel, conditionLabel, formatDate } from "@/lib/format";
import { colors, radius } from "@/theme";
import type { Listing } from "@/types";

export function ListingFacts({ listing }: { listing: Listing }) {
  const facts: Array<[string, string]> = [
    ["Condition", conditionLabel(listing.condition)],
    ["Category", categoryLabel(listing.category)],
    ["Posted", formatDate(listing.createdAt)],
  ];
  // Like the website: no "Saved by" line until someone has saved it.
  if (listing.saveCount > 0) {
    facts.push(["Saved by", `${listing.saveCount} ${listing.saveCount === 1 ? "student" : "students"}`]);
  }

  return (
    <View style={styles.box}>
      {facts.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: radius.card, padding: 16, gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 15, color: colors.cardText, opacity: 0.75 },
  value: { fontSize: 15, color: colors.cardText, fontWeight: "700" },
});
