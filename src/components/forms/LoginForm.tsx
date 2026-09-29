"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FieldInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sign-in form.
 *
 * The password field exists in the UI but is deliberately not sent anywhere:
 * there is no backend yet and no secret may live in client code. `signIn` only
 * receives the email, and the real credential check belongs on the server.
 */
export function LoginForm() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your campus email.");
      return;
    }
    setError(null);
    await signIn(email.trim());
    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Campus email" error={error ?? undefined}>
        <FieldInput
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label="Password">
        <FieldInput
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Not required in this demo"
          disabled
        />
      </Field>

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

