"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FieldInput } from "@/components/forms/Field";
import { ResendVerificationButton } from "@/components/forms/ResendVerificationButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sign-in form. The email and password go to a Server Action, which checks them against the
 * API and stores the session in an httpOnly cookie. The password is never stored in the browser.
 * Accounts that have not verified their email are refused, with a button to resend the link.
 * "Forgot your password?" leads to /forgot-password, which emails a reset link.
 */
export function LoginForm() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your campus email and password.");
      return;
    }
    setError(null);
    setNeedsVerification(false);
    const result = await signIn(email.trim(), password);
    if (result.error) {
      setError(result.error);
      // Right password, unverified email: keep the fields so "Resend" can use them.
      if (result.needsVerification) setNeedsVerification(true);
      else setPassword("");
      return;
    }
    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

      <Field label="Password" error={error ?? undefined}>
        <FieldInput
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <Link href="/forgot-password" className="-mt-2 self-end text-sm text-foreground underline">
        Forgot your password?
      </Link>

      {needsVerification ? (
        <ResendVerificationButton email={email.trim()} password={password} />
      ) : null}

      {/* Light fill with black text: the old #1B3022 fill only reached 1.5:1. */}
      <Button
        type="submit"
        size="lg"
        disabled={isLoading}
        className="border border-border bg-brand-50 text-brand-ink hover:bg-brand-200"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to UniSwap?{" "}
        <Link href="/register" className="font-semibold text-foreground underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
