import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";

// no-referrer keeps the token in this page's URL out of the Referer header of any request it makes.
export const metadata: Metadata = { title: "Choose a new password | UniSwap", referrer: "no-referrer" };

/**
 * The emailed reset link opens this page with `?token=...`. It deliberately makes no API call
 * when it loads, so mail scanners that open links in advance cannot use up the
 * token: only submitting the form does.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;

  if (typeof token !== "string" || !token) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CircleAlert aria-hidden="true" className="size-10 text-foreground" />
        <h1 className="font-heading text-2xl tracking-tight">Link not valid</h1>
        <p className="text-sm text-muted-foreground">This password reset link is incomplete.</p>
        <Link href="/forgot-password" className="text-sm font-medium underline">
          Ask for a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 font-heading text-2xl tracking-tight">Choose a new password</h1>
      <ResetPasswordForm token={token} />
    </div>
  );
}
