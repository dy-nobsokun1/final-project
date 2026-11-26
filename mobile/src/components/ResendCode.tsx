// "Didn't get the code?": sends a new one. The API asks for the password too, so nobody can
// fill someone else's inbox with codes. Hidden behind a link until the student needs it.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { apiFetch, errorMessage } from "@/lib/api";
import { colors } from "@/theme";

export function ResendCode({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: "error" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/resend-verification", { method: "POST", body: { email: email.trim(), password } });
      setMessage({ text: "A new code is on its way.", kind: "info" });
    } catch (err) {
      setMessage({ text: errorMessage(err), kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Text style={styles.link}>Didn't get the code? Send a new one</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.box}>
      <Notice text={message?.text ?? null} kind={message?.kind} />
      <TextField label="Your password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button label="Send a new code" onPress={resend} busy={busy} variant="plain" />
    </View>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.cardText, textAlign: "center", fontWeight: "600", textDecorationLine: "underline" },
  box: { gap: 12 },
});
