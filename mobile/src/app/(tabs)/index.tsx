// Browse tab: search, category chips and a grid of everything for sale, trade, giveaway or wanted.
// Works signed out, like the website.
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryChips } from "@/components/CategoryChips";
import { ListingGrid } from "@/components/ListingGrid";
import { Notice } from "@/components/Notice";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SearchBar } from "@/components/SearchBar";
import { useListings } from "@/hooks/use-listings";
import { colors } from "@/theme";
import type { ListingCategory } from "@/types";

export default function BrowseScreen() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const { listings, error, loading, refreshing, refresh } = useListings(query, category);

  const header = (
    <View style={styles.header}>
      <SearchBar onSearch={setQuery} />
      <CategoryChips selected={category} onSelect={setCategory} />
      <Notice text={error} />
      {loading && !refreshing ? <ActivityIndicator color={colors.pageText} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScreenTitle text="UniSwap" />
      <ListingGrid
        listings={loading && !refreshing ? [] : listings}
        header={header}
        emptyText={loading || error ? "" : query ? `Nothing matches "${query}" yet.` : "No items here yet."}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  header: { gap: 12, paddingTop: 12, paddingBottom: 4 },
});
