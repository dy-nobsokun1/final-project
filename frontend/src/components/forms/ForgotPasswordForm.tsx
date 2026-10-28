"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, FieldInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/api/actions";

/**
 * Asks for a password-reset email. The API answers the same whether or not the address has an
 * account, so the confirmation is worded "if ... has an account" and gives nothing away.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.toLowerCase().endsWith(".edu.kh")) {
      setError("Use your campus email (ending in .edu.kh).");
      return;
    }
    setError(null);
    setIsSending(true);
    const result = await requestPasswordReset(trimmed);
    setIsSending(false);
    if (result.error) {
      setError(result.fieldErrors?.email ?? result.error);
      return;
    }
    setSentTo(trimmed);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p role="status">
          If {sentTo} has a UniSwap account, we sent it a link to choose a new password. The link
          works for 1 hour. Check your Junk folder too.
        </p>
        {process.env.NODE_ENV !== "production" ? (
          <p className="text-xs text-muted-foreground">
            Development: while the API cannot send email (SMTP_* in backend/.env), it prints the
            link in its log instead.
          </p>
        ) : null}
        <Link href="/login" className="font-semibold text-foreground underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Campus email" error={error ?? undefined}>
        <FieldInput
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@university.edu.kh"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Button
        type="submit"
        size="lg"
        disabled={isSending}
        className="border border-border bg-brand-50 text-brand-ink hover:bg-brand-200"
      >
        {isSending ? "Sending..." : "Email me a reset link"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-foreground underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
