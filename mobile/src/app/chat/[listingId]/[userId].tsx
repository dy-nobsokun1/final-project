// A chat with one student about one item. The header shows their name, the strip the item.
// New messages arrive live (use-thread.ts). The keyboard pushes the Send box up, never over it.
import { Stack, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { Notice } from "@/components/Notice";
import { ThreadItemStrip } from "@/components/ThreadItemStrip";
import { useThread } from "@/hooks/use-thread";
import { useUserName } from "@/hooks/use-user-name";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

export default function ChatScreen() {
  const { listingId, userId } = useLocalSearchParams<{ listingId: string; userId: string }>();
  const { user } = useAuth();
  const partnerName = useUserName(userId);
  const { messages, error, send } = useThread(listingId, userId);
  const list = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding" keyboardVerticalOffset={insets.top + 44}>
      <Stack.Screen options={{ title: partnerName || "Chat" }} />
      <ThreadItemStrip listingId={listingId} />
      {error ? <View style={styles.padded}><Notice text={error} /></View> : null}
      {messages === null && !error ? <ActivityIndicator color={colors.pageText} style={styles.padded} /> : (
        <FlatList
          ref={list}
          data={messages ?? []}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => <MessageBubble message={item} mine={item.senderId === user?.id} />}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={styles.empty}>Say hello! Ask if it is still available.</Text>}
        />
      )}
      <View style={{ paddingBottom: insets.bottom }}><MessageComposer onSend={send} /></View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  padded: { padding: 16 },
  messages: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { color: colors.pageMuted, fontSize: 16, textAlign: "center", marginTop: 40 },
});
