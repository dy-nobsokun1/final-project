"use client";

import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { EmailVerifiedNotice } from "@/components/forms/EmailVerifiedNotice";
import { Field, FieldInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { verifyEmail } from "@/lib/api/actions";

interface VerifyCodeFormProps {
  /** The address the code was sent to, remembered by the register / resend actions. May be empty. */
  initialEmail: string;
  /** Hints under the form (Junk folder, how to get a new code). Hidden once the email is verified. */
  children?: ReactNode;
}

/**
 * Asks for the 6-digit code from the sign-up email. The API counts wrong tries and expires the
 * code, so this form only strips non-digits, sends what was typed and shows the API's message.
 */
export function VerifyCodeForm({ initialEmail, children }: VerifyCodeFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (!email.trim()) return setError("Enter the campus email you signed up with.");
    if (code.length !== 6) return setError("Enter the 6-digit code from the email.");
    setError(null);
    setIsPending(true);
    const result = await verifyEmail(email.trim(), code);
    setIsPending(false);
    if (result.verified) setVerified(true);
    else setError(result.error ?? "Something went wrong. Please try again.");
  }

  if (verified) return <EmailVerifiedNotice />;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Mail aria-hidden="true" className="size-10 text-foreground" />
      <h1 className="font-heading text-2xl tracking-tight">Check your email</h1>
      <p className="text-sm text-muted-foreground">We sent a 6-digit code to your campus email.</p>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 text-left">
        <Field label="Campus email">
          <FieldInput
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu.kh"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="6-digit code" error={error ?? undefined}>
          <FieldInput
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="border border-border bg-brand-50 text-brand-ink hover:bg-brand-200"
        >
          {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {isPending ? "Confirming..." : "Confirm my email"}
        </Button>
      </form>
      {children}
    </div>
  );
}
