// The page for a sign-in form: a scrollable deep green page with one pale green card in the middle.
import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/theme";

export function FormCard({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.intro}>{intro}</Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  scroll: { padding: 20, paddingTop: 28 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 20, gap: 14 },
  title: { fontSize: 26, fontWeight: "800", color: colors.cardText },
  intro: { fontSize: 15, color: colors.cardText, opacity: 0.8 },
});
