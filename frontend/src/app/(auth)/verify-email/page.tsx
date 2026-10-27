import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { VerifyCodeForm } from "@/components/forms/VerifyCodeForm";
import { VERIFY_EMAIL_COOKIE } from "@/lib/api/http";

export const metadata: Metadata = { title: "Verify email | UniSwap" };

/**
 * The "check your email" step after registering. The sign-up email carries a 6-digit code and no
 * link, so nothing here depends on a URL. The register / resend actions leave the address in a
 * cookie, which prefills the form; the student can still change it. Until the code is accepted,
 * signing in is refused.
 */
export default async function VerifyEmailPage() {
  const email = (await cookies()).get(VERIFY_EMAIL_COOKIE)?.value ?? "";

  return (
    <VerifyCodeForm initialEmail={email}>
      <div className="w-full rounded-lg border border-border bg-muted p-3 text-left">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail aria-hidden="true" className="size-4 shrink-0" />
          <span>Check your Junk folder if it does not arrive within a minute. The code works for 30 minutes.</span>
        </p>
      </div>

      {process.env.NODE_ENV !== "production" ? (
        <p className="text-xs text-muted-foreground">
          Development: if the API cannot send email (see SMTP_* in backend/.env), the code is
          printed in its log instead.
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        No email, or the code stopped working?{" "}
        <Link href="/login" className="font-medium underline">Sign in</Link> to get a new code.
      </p>
    </VerifyCodeForm>
  );
}
