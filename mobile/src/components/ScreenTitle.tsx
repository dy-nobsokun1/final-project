// The big title at the top of a tab (the tabs have no navigation bar of their own).
import { StyleSheet, Text } from "react-native";

import { colors } from "@/theme";

export function ScreenTitle({ text }: { text: string }) {
  return <Text accessibilityRole="header" style={styles.title}>{text}</Text>;
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: "800", color: colors.pageText, paddingHorizontal: 16, paddingTop: 8 },
});
