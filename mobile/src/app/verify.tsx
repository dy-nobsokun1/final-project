// Type the 6-digit code from the sign-up email. A right code verifies the account (no token yet),
// so we go to Log in with the email filled in. "Send a new code" needs the password again (API rule).
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/Button";
import { FormCard } from "@/components/FormCard";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { ResendCode } from "@/components/ResendCode";
import { apiFetch, errorMessage } from "@/lib/api";

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/verify-email", { method: "POST", body: { email: email.trim(), code: code.trim() } });
      router.replace({ pathname: "/login", params: { email: email.trim(), notice: "Email verified. Please sign in." } });
    } catch (err) {
      setError(errorMessage(err)); // wrong code, too many tries, or the code is older than 30 minutes
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCard title="Check your email" intro="We sent a 6-digit code to your AUPP email. It works for 30 minutes.">
      <Notice text={error} />
      <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextField label="Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad"
        maxLength={6} textContentType="oneTimeCode" autoComplete="one-time-code" />
      <Button label="Verify email" onPress={submit} busy={busy} />
      <ResendCode email={email} />
    </FormCard>
  );
}
