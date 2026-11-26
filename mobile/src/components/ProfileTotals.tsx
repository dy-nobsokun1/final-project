// Three boxes on the Account tab: deals, money earned and money spent (from GET /api/users/me/stats).
// The website also draws charts; the app shows only these totals.
import { StyleSheet, Text, View } from "react-native";

import { formatPrice } from "@/lib/format";
import { colors, radius } from "@/theme";
import type { UserStats } from "@/types";

export function ProfileTotals({ stats }: { stats: UserStats }) {
  const boxes = [
    { label: "Deals", value: String(stats.deals) },
    { label: "Earned", value: formatPrice(stats.earned) },
    { label: "Spent", value: formatPrice(stats.spent) },
  ];
  return (
    <View style={styles.row}>
      {boxes.map((box) => (
        <View key={box.label} style={styles.box} accessible accessibilityLabel={`${box.label}: ${box.value}`}>
          <Text style={styles.value}>{box.value}</Text>
          <Text style={styles.label}>{box.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  box: { flex: 1, backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: 14, alignItems: "center" },
  value: { fontSize: 22, fontWeight: "800", color: colors.cardText },
  label: { fontSize: 14, color: colors.cardText, opacity: 0.75, marginTop: 2 },
});
