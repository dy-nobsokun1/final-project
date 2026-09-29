"use client";

import { LayoutGrid, MessageSquare, Plus, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Browse", icon: LayoutGrid },
  { href: "/listings/new", label: "Sell", icon: Plus },
  { href: "/my-listings", label: "Mine", icon: Tag },
  { href: "/messages", label: "Chats", icon: MessageSquare },
] as const;

/** Bottom tab bar shown on small screens. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-40 border-t border-zinc-200 bg-white md:hidden"
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
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                  isActive ? "text-zinc-900" : "text-zinc-500",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
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

