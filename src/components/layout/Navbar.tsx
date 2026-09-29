"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Suspense } from "react";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME, NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Top navigation with the search box. */
export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          {APP_NAME}
        </Link>

        <Suspense fallback={<div className="h-9 flex-1" />}>
          <SearchBox />
        </Suspense>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <UserMenu />
      </div>
    </header>
  );
}

function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  return (
    <form
      role="search"
      className="relative flex-1 max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
      }}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
      />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search listings"
        aria-label="Search listings"
        className="h-9 w-full rounded-lg border border-zinc-300 pl-9 pr-3 text-sm focus:border-zinc-900 focus:outline-none"
      />
    </form>
  );
}

function UserMenu() {
  const pathname = usePathname();
  const { user, isAuthenticated, signIn, signOut } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <Link
        href="/login"
        className={cn(
          "shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white",
          pathname === "/login" && "bg-zinc-700",
        )}
        onClick={() => {
          // The mock session has no real credential check, so signing in from
          // the navbar just activates the seeded user.
          void signIn("");
        }}
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link href="/profile" aria-label="Your profile">
        <UserAvatar name={user.name} src={user.avatarUrl} size="sm" />
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
      >
        Sign out
      </button>
    </div>
  );
}

