"use client";

import { Heart, LayoutGrid, MessageSquare, Plus, Sparkles, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Browse", icon: LayoutGrid },
  { href: "/assistant", label: "Ask", icon: Sparkles },
  { href: "/listings/new", label: "Sell", icon: Plus },
  { href: "/my-listings", label: "Mine", icon: Tag },
  { href: "/saved", label: "Saved", icon: Heart },
  { href: "/messages", label: "Chats", icon: MessageSquare },
] as const;

/** Bottom tab bar shown on small screens. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-40 border-t border-brand-200/50 bg-background md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {href === "/assistant" ? (
                  // Ask UniSwap gets a filled circle so it stands out; it turns pale with a ring
                  // when active. -my-1 keeps the bar 59.5px tall, which ListingBuyBar and the
                  // chat thread are sized to.
                  <span
                    aria-hidden="true"
                    className={cn(
                      "-my-1 flex size-7 items-center justify-center rounded-full text-brand-ink",
                      isActive ? "bg-brand-50 ring-2 ring-brand-400" : "bg-brand-400",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                ) : (
                  <Icon aria-hidden="true" className="size-5" />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <span className="sr-only">{APP_NAME}</span>
    </nav>
  );
}

