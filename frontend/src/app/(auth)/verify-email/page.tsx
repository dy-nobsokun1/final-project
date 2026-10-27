import { CircleCheck, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmEmailForm } from "@/components/forms/ConfirmEmailForm";

// no-referrer keeps the token in this page's URL out of the Referer header of any request it makes.
export const metadata: Metadata = { title: "Verify email | UniSwap", referrer: "no-referrer" };

/**
 * Two states on one route. Right after registering there is no token, so this is the
 * "check your email" step. The link in that email comes back here with `?token=...`,
 * which shows a button; only pressing it asks the API to unlock the account. Until then, signing in is refused.
 */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;

  if (typeof token === "string" && token) return <ConfirmEmailForm token={token} />;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CircleCheck aria-hidden="true" className="size-10 text-foreground" />
      <h1 className="font-heading text-2xl tracking-tight">Check your email</h1>
      <p className="text-sm text-muted-foreground">
        We sent a confirmation link to your campus email. Open it to unlock your account; you
        cannot sign in until then.
      </p>

      <div className="w-full rounded-lg border border-border bg-muted p-3 text-left">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail aria-hidden="true" className="size-4 shrink-0" />
          <span>Check your spam folder if it does not arrive within a minute.</span>
        </p>
      </div>

      {process.env.NODE_ENV !== "production" ? (
        <p className="text-xs text-muted-foreground">
          Development: if the API cannot send email (see SMTP_* in backend/.env), the link is
          printed in its log instead.
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        No email? <Link href="/login" className="font-medium underline">Sign in</Link> to get a
        new link.
      </p>
    </div>
  );
}
