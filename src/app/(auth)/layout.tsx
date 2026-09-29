import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Centered card shell for sign-in, registration and email verification.
 * These routes stay outside the main app shell, so the navbar is not shown.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            UniSwap
          </Link>
          <p className="mt-1 text-sm text-zinc-500">
            Buy and sell with students on your campus.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          {children as ReactNode}
        </div>
      </div>
    </div>
  );
}

