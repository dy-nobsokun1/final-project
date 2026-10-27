"use client";

import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmEmail } from "@/lib/api/actions";

type Outcome = "verified" | "invalid" | null;

/**
 * Verifies the emailed token only when the button is pressed. Mail scanners (like Outlook's Safe
 * Links) open links on their own, so merely loading the page must not use the single-use token up.
 */
export function ConfirmEmailForm({ token }: { token: string }) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    setError("");
    const result = await confirmEmail(token);
    if (result.error) setError(result.error);
    else setOutcome(result.verified ? "verified" : "invalid");
    setIsPending(false);
  }

  if (outcome) {
    const isVerified = outcome === "verified";
    const Icon = isVerified ? CircleCheck : CircleAlert;
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Icon aria-hidden="true" className="size-10 text-foreground" />
        <h1 className="font-heading text-2xl tracking-tight">
          {isVerified ? "Email verified" : "Link not valid"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isVerified
            ? "Your account is ready. Sign in to start buying and selling."
            : "This verification link is invalid or has already been used. If you already confirmed, just sign in."}
        </p>
        <Link href="/login" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CircleCheck aria-hidden="true" className="size-10 text-foreground" />
      <h1 className="font-heading text-2xl tracking-tight">Confirm your email</h1>
      <p className="text-sm text-muted-foreground">Press the button to finish creating your account.</p>
      <Button size="lg" onClick={handleConfirm} disabled={isPending} className="w-full">
        {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {isPending ? "Confirming..." : "Confirm my email"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
