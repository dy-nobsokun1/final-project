// Saved tab: the items this student saved with the heart (GET /api/users/me/saved).
// It loads again every time the tab opens, so an item unsaved on its page disappears here too.
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ListingGrid } from "@/components/ListingGrid";
import { Notice } from "@/components/Notice";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SignInPrompt } from "@/components/SignInPrompt";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";
import type { ListingWithSeller } from "@/types";

export default function SavedScreen() {
  const { token, loading } = useAuth();
  const [listings, setListings] = useState<ListingWithSeller[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ listings: ListingWithSeller[] }>("/api/users/me/saved", { token });
      setListings(data.listings);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  let content;
  if (loading) content = <ActivityIndicator color={colors.pageText} style={styles.spinner} />;
  else if (!token) content = <SignInPrompt message="Tap the heart on any item to keep it here." />;
  else if (listings === null && !error) content = <ActivityIndicator color={colors.pageText} style={styles.spinner} />;
  else {
    content = (
      <ListingGrid
        listings={listings ?? []}
        header={error ? <Notice text={error} /> : undefined}
        emptyText={error ? "" : "Nothing saved yet. Tap the heart on an item to save it."}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScreenTitle text="Saved" />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page, gap: 12 },
  spinner: { marginTop: 40 },
});
