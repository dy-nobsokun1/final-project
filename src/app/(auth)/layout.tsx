import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Centered card shell for sign-in, registration and email verification.
 * These routes stay outside the main app shell, so the navbar is not shown.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="font-heading text-2xl tracking-wide text-brand-ink">
            UniSwap
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            Buy and sell with students on your campus.
          </p>
        </div>
        <div className="light-surface rounded-xl border border-border bg-card p-6 shadow-sm">
          {children as ReactNode}
        </div>
      </div>
    </div>
  );
}

