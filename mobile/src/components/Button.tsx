// The app's button. "primary" is the green main action; "plain" is a quieter outlined one.
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radius } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "plain";
}

export function Button({ label, onPress, busy = false, variant = "primary" }: Props) {
  const plain = variant === "plain";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.button, plain && styles.plain, (pressed || busy) && styles.pressed]}
    >
      {busy ? <ActivityIndicator color={colors.cardText} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  plain: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.cardText },
  pressed: { opacity: 0.6 },
  label: { color: colors.cardText, fontSize: 16, fontWeight: "700" },
});
