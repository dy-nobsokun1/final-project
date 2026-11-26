// Sign up. Only @aupp.edu.kh emails (the same rule as the website and the API). The API then emails
// a 6-digit code, and nobody is signed in until that code is typed on the next screen.
import { router } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/Button";
import { FormCard } from "@/components/FormCard";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { apiFetch, errorMessage } from "@/lib/api";

const AUPP_EMAIL = /^[^\s@]+@aupp\.edu\.kh$/i;

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    if (!AUPP_EMAIL.test(cleanEmail)) return setError("Use your AUPP student email (@aupp.edu.kh).");
    if (password.length < 8) return setError("Your password needs at least 8 characters.");
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/auth/register", { method: "POST", body: { name: name.trim(), email: cleanEmail, password } });
      router.replace({ pathname: "/verify", params: { email: cleanEmail } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCard title="Join UniSwap" intro="For AUPP students. We email you a 6-digit code to check it is you.">
      <Notice text={error} />
      <TextField label="Full name" value={name} onChangeText={setName} autoComplete="name" />
      <TextField label="AUPP email" value={email} onChangeText={setEmail} placeholder="you@aupp.edu.kh"
        keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry
        placeholder="At least 8 characters" autoComplete="new-password" textContentType="newPassword" />
      <Button label="Create account" onPress={submit} busy={busy} />
    </FormCard>
  );
}
