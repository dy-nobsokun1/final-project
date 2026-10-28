"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The "Ask" link in the desktop navbar, as a filled pill so people notice there is an AI helper.
 * Black on brand-400 is 9.9:1. The icon shows from `lg` up only: at 768px the navbar has no room
 * to spare, so there the pill is as wide as the plain link was.
 */
export function AskNavPill({ href, label }: { href: string; label: string }) {
  const isActive = usePathname() === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-ink transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-50",
        // On /assistant it turns pale with a ring, so it reads as "you are here".
        isActive ? "bg-brand-50 ring-2 ring-brand-400" : "bg-brand-400 hover:bg-brand-200",
      )}
    >
      <Sparkles aria-hidden="true" className="hidden size-4 lg:block" />
      {label}
    </Link>
  );
}
