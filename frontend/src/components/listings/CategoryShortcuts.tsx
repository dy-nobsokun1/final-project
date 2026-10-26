import { Bike, BookOpen, Laptop, type LucideIcon, Shapes, Shirt, Sofa } from "lucide-react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ListingCategory } from "@/types";

const ICONS: Record<ListingCategory, LucideIcon> = {
  textbooks: BookOpen,
  electronics: Laptop,
  furniture: Sofa,
  clothing: Shirt,
  bikes: Bike,
  other: Shapes,
};

interface CategoryShortcutsProps {
  /** The browse page's query params, so a tile keeps the search and the other filters. */
  params: Record<string, string | string[] | undefined>;
  active: ListingCategory | "all";
}

/** Row of category tiles under the hero. Picking the active tile again clears it. */
export function CategoryShortcuts({ params, active }: CategoryShortcutsProps) {
  return (
    <nav aria-label="Categories">
      {/* Scrolls sideways on phones (bleeding to the screen edge), one row of six from sm up.
          `scroll-px-4` makes the snap points respect the 16px gutter instead of the screen edge. */}
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0 sm:pb-0">
        {CATEGORIES.map(({ value, label, accent }) => {
          const Icon = ICONS[value];
          const isActive = value === active;
          return (
            <li key={value} className="shrink-0 snap-start">
              <Link
                href={categoryHref(params, isActive ? null : value)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "light-surface flex w-24 flex-col items-center gap-2 rounded-xl border border-border bg-card px-2 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-lg hover:shadow-brand-600/20 sm:w-auto",
                  isActive && "border-brand-ink bg-brand-50",
                )}
              >
                {/* Same colours as the category chip on each listing card. */}
                <span className={cn("flex size-11 items-center justify-center rounded-full", accent)}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The browse URL with `category` set (or removed when null) and every other param kept. */
function categoryHref(
  params: CategoryShortcutsProps["params"],
  category: ListingCategory | null,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "category" && typeof value === "string") query.set(key, value);
  }
  if (category) query.set("category", category);
  const search = query.toString();
  return search ? `/?${search}` : "/";
}
