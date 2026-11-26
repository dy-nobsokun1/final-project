// The box at the bottom of a chat: type a message and tap Send. The text stays if sending fails.
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { errorMessage } from "@/lib/api";
import { colors, radius } from "@/theme";

export function MessageComposer({ onSend }: { onSend: (body: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = text.trim();

  async function send() {
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(body);
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Write a message..."
          placeholderTextColor="#4f6b5f" multiline maxLength={2000} accessibilityLabel="Message" />
        <Pressable accessibilityRole="button" onPress={send} disabled={!body || busy}
          style={[styles.send, (!body || busy) && styles.sendOff]}>
          {busy ? <ActivityIndicator color={colors.cardText} /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, gap: 6, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.page },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  input: {
    flex: 1, maxHeight: 120, backgroundColor: colors.inset, color: colors.cardText, borderRadius: 20,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 16,
  },
  send: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, height: 42, justifyContent: "center" },
  sendOff: { opacity: 0.5 },
  sendText: { fontSize: 16, fontWeight: "800", color: colors.cardText },
  error: { color: "#ffb3b3", fontSize: 14 },
});
