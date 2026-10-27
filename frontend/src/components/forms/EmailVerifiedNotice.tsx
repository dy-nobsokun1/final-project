import { CircleCheck } from "lucide-react";
import Link from "next/link";

/** Shown by `VerifyCodeForm` once the API has accepted the code. */
export function EmailVerifiedNotice() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CircleCheck aria-hidden="true" className="size-10 text-foreground" />
      <h1 className="font-heading text-2xl tracking-tight">Email verified</h1>
      <p className="text-sm text-muted-foreground">
        Your account is ready. Sign in to start buying and selling.
      </p>
      <Link href="/login" className="text-sm font-medium underline">
        Sign in
      </Link>
    </div>
  );
}
