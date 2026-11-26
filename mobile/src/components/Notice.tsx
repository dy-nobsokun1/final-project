// A short message box in a form: "error" for what went wrong, "info" for good news like "Email verified".
import { StyleSheet, Text } from "react-native";

import { colors, radius } from "@/theme";

export function Notice({ text, kind = "error" }: { text: string | null; kind?: "error" | "info" }) {
  if (!text) return null;
  return (
    <Text accessibilityRole="alert" style={[styles.box, kind === "info" ? styles.info : styles.error]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.field, padding: 12, fontSize: 15, overflow: "hidden" },
  error: { backgroundColor: colors.danger, color: colors.inset },
  info: { backgroundColor: colors.dark, color: colors.inset },
});
