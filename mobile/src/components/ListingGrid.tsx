// A two-column, scrollable grid of ListingCards with pull-to-refresh. Browse and Saved both use it.
import type { ReactElement } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions } from "react-native";

import { ListingCard } from "@/components/ListingCard";
import { colors } from "@/theme";
import type { ListingWithSeller } from "@/types";

const GUTTER = 16; // space at the screen's edges
const GAP = 12; // space between the two columns

interface Props {
  listings: ListingWithSeller[];
  header?: ReactElement;
  emptyText: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export function ListingGrid({ listings, header, emptyText, refreshing, onRefresh }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - GUTTER * 2 - GAP) / 2;

  return (
    <FlatList
      data={listings}
      keyExtractor={(listing) => listing.id}
      numColumns={2}
      renderItem={({ item }) => <ListingCard listing={item} width={cardWidth} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pageText} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 32, gap: GAP },
  row: { gap: GAP },
  empty: { color: colors.pageMuted, fontSize: 16, textAlign: "center", marginTop: 40 },
});
