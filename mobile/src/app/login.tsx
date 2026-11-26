// Log in with an AUPP email and password. A 403 means the email is not verified yet: go to the code screen.
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { Button } from "@/components/Button";
import { FormCard } from "@/components/FormCard";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/theme";

export default function LoginScreen() {
  // After the code screen we arrive here with the email filled in and "Email verified".
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // Back to where the student was (e.g. the item whose heart they tapped), else to Browse.
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        router.push({ pathname: "/verify", params: { email: email.trim() } });
      } else {
        setError(errorMessage(err)); // e.g. wrong password, or 429 "Too many wrong passwords..."
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCard title="Welcome back" intro="Log in with your AUPP student email.">
      <Notice text={params.notice ?? null} kind="info" />
      <Notice text={error} />
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@aupp.edu.kh"
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry
        autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      <Button label="Log in" onPress={submit} busy={busy} />
      <Link href="/register" replace style={{ color: colors.cardText, textAlign: "center", fontWeight: "600" }}>
        <Text>New here? Create an account</Text>
      </Link>
    </FormCard>
  );
}
