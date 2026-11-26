// The top of the item page: status pill, type tag, title, the big price (and a trade's cash top-up).
import { StyleSheet, Text, View } from "react-native";

import { formatListingPrice, formatPrice, listingTypeLabel, statusLabel } from "@/lib/format";
import { colors, radius } from "@/theme";
import type { Listing } from "@/types";

export function ListingHeading({ listing }: { listing: Listing }) {
  const wanted = listing.listingType === "buy_request";
  return (
    <View style={styles.wrap}>
      <View style={styles.tags}>
        <Text style={[styles.pill, listing.status === "active" ? styles.available : styles.closed]}>
          {statusLabel(listing.status)}
        </Text>
        <Text style={[styles.pill, wanted ? styles.wanted : styles.type]}>
          {wanted ? "WANTED" : listingTypeLabel(listing.listingType)}
        </Text>
      </View>
      <Text style={styles.title}>{listing.title}</Text>
      <Text style={styles.price}>{formatListingPrice(listing)}</Text>
      {listing.listingType === "trade" && listing.cashTopup ? (
        <Text style={styles.topup}>Plus {formatPrice(listing.cashTopup)} cash top-up</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  tags: { flexDirection: "row", gap: 8 },
  pill: {
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4,
    fontSize: 13, fontWeight: "700", overflow: "hidden",
  },
  available: { backgroundColor: colors.primary, color: colors.cardText },
  closed: { backgroundColor: colors.danger, color: colors.inset },
  type: { backgroundColor: colors.dark, color: colors.inset },
  wanted: { backgroundColor: colors.wanted, color: colors.cardText, letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: "800", color: colors.pageText },
  price: { fontSize: 32, fontWeight: "900", color: colors.pageText },
  topup: { fontSize: 16, color: colors.pageMuted, fontWeight: "600" },
});
