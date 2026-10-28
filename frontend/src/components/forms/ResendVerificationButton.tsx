"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { resendVerification } from "@/lib/api/actions";

interface ResendVerificationButtonProps {
  email: string;
  password: string;
}

/**
 * Emails a new 6-digit code; the previous code stops working. Shown on the sign-in form when the
 * password was right but the email is not verified yet, so it reuses those details. Once sent,
 * it links to the page where the code is typed.
 */
export function ResendVerificationButton({ email, password }: ResendVerificationButtonProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [wasSent, setWasSent] = useState(false);

  async function handleClick() {
    setIsSending(true);
    const result = await resendVerification(email, password);
    setIsSending(false);
    setWasSent(!result.error);
    setStatus(result.error ?? "Sent. Check your inbox and your Junk folder.");
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" disabled={isSending} onClick={handleClick}>
        {isSending ? "Sending..." : "Email me a new code"}
      </Button>
      {status ? (
        <p role="status" className="text-sm text-foreground">
          {status}
        </p>
      ) : null}
      {wasSent ? (
        <Link href="/verify-email" className="text-sm font-semibold text-foreground underline">
          Enter the code
        </Link>
      ) : null}
    </div>
  );
}
