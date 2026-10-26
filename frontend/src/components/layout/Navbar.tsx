"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AskNavPill } from "@/components/layout/AskNavPill";
import { SearchBox } from "@/components/layout/SearchBox";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME, NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Top navigation with the search box. */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-200/50 bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="font-heading text-2xl leading-none tracking-wide text-brand-50"
        >
          {APP_NAME}
        </Link>

        <Suspense fallback={<div className="h-9 flex-1" />}>
          <SearchBox />
        </Suspense>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) =>
            link.href === "/assistant" ? (
              <AskNavPill key={link.href} href={link.href} label={link.label} />
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-brand-200 hover:text-foreground"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <Link
        href="/login"
        className={cn(
          "shrink-0 rounded-lg border border-border bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-200",
          pathname === "/login" && "bg-brand-200",
        )}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link href="/profile" aria-label="Your profile">
        <UserAvatar name={user.name} src={user.avatarUrl} />
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg border border-brand-danger bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-200"
      >
        Sign out
      </button>
    </div>
  );
}

