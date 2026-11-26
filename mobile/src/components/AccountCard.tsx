// The signed-in student's card at the top of the Account tab: initial, name, email, major,
// the Verified badge and Sign out (the phase 1 Account screen, moved here).
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { colors, radius } from "@/theme";
import type { User } from "@/types";

export function AccountCard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.initial}>{user.name.charAt(0).toUpperCase()}</Text>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.line}>{user.email}</Text>
      {user.major ? <Text style={styles.line}>{user.major}</Text> : null}
      {user.isVerified ? <Text style={styles.badge}>Verified AUPP student</Text> : null}
      <Button label="Sign out" variant="plain" onPress={onSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 20, gap: 10 },
  initial: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.dark, color: colors.inset,
    fontSize: 32, fontWeight: "800", textAlign: "center", lineHeight: 72, overflow: "hidden", alignSelf: "center",
  },
  name: { fontSize: 24, fontWeight: "800", color: colors.cardText, textAlign: "center" },
  line: { fontSize: 15, color: colors.cardText, textAlign: "center" },
  badge: {
    alignSelf: "center", backgroundColor: colors.dark, color: colors.inset, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 4, fontWeight: "700", overflow: "hidden", marginBottom: 6,
  },
});
