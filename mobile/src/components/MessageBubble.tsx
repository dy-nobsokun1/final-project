// One chat message: mine on the right in green, theirs on the left in pale green, with the time.
import { StyleSheet, Text, View } from "react-native";

import { formatChatTime } from "@/lib/format";
import { colors } from "@/theme";
import type { Message } from "@/types";

export function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text style={styles.body}>{message.body}</Text>
      <Text style={styles.time}>{formatChatTime(message.createdAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, gap: 2 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.inset, borderBottomLeftRadius: 4 },
  body: { fontSize: 16, lineHeight: 22, color: colors.cardText },
  time: { fontSize: 11, color: "#3d5a4e", alignSelf: "flex-end" },
});
