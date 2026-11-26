// Shown on Saved and Account when nobody is signed in: why to sign in, and the two buttons.
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { colors, radius } from "@/theme";

export function SignInPrompt({ message }: { message: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sign in to UniSwap</Text>
      <Text style={styles.text}>{message}</Text>
      <Button label="Log in" onPress={() => router.push("/login")} />
      <Button label="Create an account" variant="plain" onPress={() => router.push("/register")} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 20, gap: 14, margin: 20 },
  title: { fontSize: 22, fontWeight: "800", color: colors.cardText },
  text: { fontSize: 15, color: colors.cardText },
});
