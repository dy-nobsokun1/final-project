// Inbox tab: every chat this student has, one row per item and person, newest first.
// It loads again each time the tab opens and on pull to refresh. Signed out, it asks to sign in.
import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConversationRow } from "@/components/ConversationRow";
import { Notice } from "@/components/Notice";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useConversations } from "@/hooks/use-conversations";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

export default function InboxScreen() {
  const { token, loading } = useAuth();
  const { conversations, error, load } = useConversations();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  let content;
  if (loading) content = <ActivityIndicator color={colors.pageText} style={styles.spinner} />;
  else if (!token) content = <SignInPrompt message="Sign in to chat with buyers and sellers." />;
  else if (conversations === null && !error) content = <ActivityIndicator color={colors.pageText} style={styles.spinner} />;
  else {
    content = (
      <FlatList
        data={conversations ?? []}
        keyExtractor={(row) => `${row.listingId}:${row.partnerId}`}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        ListHeaderComponent={error ? <Notice text={error} /> : undefined}
        ListEmptyComponent={error ? undefined : <Text style={styles.empty}>No chats yet. Open an item and tap Message seller.</Text>}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.pageText} />}
      />
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScreenTitle text="Inbox" />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page, gap: 12 },
  spinner: { marginTop: 40 },
  list: { gap: 10, paddingBottom: 120 },
  empty: { color: colors.pageMuted, fontSize: 16, textAlign: "center", marginTop: 40, marginHorizontal: 24 },
});
