// One Inbox row: the item's cover photo, its title, the other student's name, the newest message
// ("You: ..." when I sent it), its time, and a dot while there are unread messages. Tap to open the chat.
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { useUserName } from "@/hooks/use-user-name";
import { canShowPhoto, formatChatTime, photoUrl } from "@/lib/format";
import { colors, radius } from "@/theme";
import type { Conversation } from "@/types";

export function ConversationRow({ conversation: row }: { conversation: Conversation }) {
  const partnerName = useUserName(row.partnerId);
  const unread = row.unreadCount > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      onPress={() => router.push(`/chat/${row.listingId}/${row.partnerId}`)}
      accessibilityLabel={`Chat with ${partnerName} about ${row.listingTitle}`}
    >
      {row.listingImageUrl && canShowPhoto(row.listingImageUrl) ? (
        <Image source={{ uri: photoUrl(row.listingImageUrl) }} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.iconBox]}>
          <CategoryIcon category={row.listingCategory} size={26} color={colors.pageMuted} />
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>{partnerName}</Text>
          <Text style={styles.time}>{formatChatTime(row.lastMessageAt)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{row.listingTitle}</Text>
        <Text style={[styles.last, unread && styles.lastUnread]} numberOfLines={1}>
          {row.lastMessageIsMine ? "You: " : ""}{row.lastMessageBody}
        </Text>
      </View>
      {unread ? <View style={styles.dot} accessibilityLabel={`${row.unreadCount} unread`} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card,
    borderRadius: radius.card, padding: 12, marginHorizontal: 16,
  },
  photo: { width: 64, height: 64, borderRadius: 12 },
  iconBox: { backgroundColor: colors.wantedCard, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  topLine: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.cardText },
  time: { fontSize: 13, color: "#3d5a4e" },
  title: { fontSize: 14, fontWeight: "600", color: colors.cardText },
  last: { fontSize: 14, color: "#3d5a4e" },
  lastUnread: { color: colors.cardText, fontWeight: "700" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.dark },
});
