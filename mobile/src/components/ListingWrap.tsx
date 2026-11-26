// A titled two-column block of ListingCards inside a ScrollView (the Account tab). Not a FlatList,
// because a list inside a scrolling page must not scroll on its own.
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { ListingCard } from "@/components/ListingCard";
import { colors } from "@/theme";
import type { ListingWithSeller } from "@/types";

const GUTTER = 16; // space at the screen's edges (same as ListingGrid)
const GAP = 12; // space between the two columns

interface Props {
  title: string;
  listings: ListingWithSeller[];
  showStatus?: boolean;
}

export function ListingWrap({ title, listings, showStatus }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - GUTTER * 2 - GAP) / 2;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <View style={styles.wrap}>
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} width={cardWidth} showStatus={showStatus} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 22, fontWeight: "800", color: colors.pageText },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
});
