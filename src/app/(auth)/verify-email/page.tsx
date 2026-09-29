import { CircleCheck, Mail } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Verify email | UniSwap" };

/**
 * Confirmation step. No token is validated here yet: a real implementation
 * would read a signed token from the query string and verify it on the server.
 */
export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CircleCheck aria-hidden="true" className="size-10 text-emerald-600" />
      <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
      <p className="text-sm text-zinc-500">
        We sent a confirmation link to your campus email. Click it to finish setting
        up your account.
      </p>

      <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left">
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <Mail aria-hidden="true" className="size-4 shrink-0" />
          <span>Check your spam folder if it does not arrive within a minute.</span>
        </p>
      </div>

      <Link href="/login" className="text-sm font-medium underline">
        Back to sign in
      </Link>
    </div>
  );
}

