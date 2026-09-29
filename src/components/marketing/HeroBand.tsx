import Link from "next/link";
import { ArrowRight, Recycle } from "lucide-react";
import { HeroHeading } from "@/components/marketing/HeroHeading";
import { HeroSubheading } from "@/components/marketing/HeroSubheading";

/** Brand banner that sits above the browse filters on the home page. */
export function HeroBand() {
  return (
    <section className="light-surface relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-200 to-brand-50">
      {/* Decorative grid, faded out towards the bottom. */}
      <div aria-hidden="true" className="brand-grid absolute inset-0 opacity-60" />

      <div className="relative flex flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-ink">
          <Recycle aria-hidden="true" className="size-3.5" />
          Campus-only marketplace
        </span>

        {/* Bebas Neue: the big condensed display line, animated per word. */}
        <HeroHeading />

        {/* Subheading, typed out on load. */}
        <HeroSubheading />

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/listings/new"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-200"
          >
            Sell an item
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          {/* Dark CTA against the light hero. #E6F2DD on #22312D is 11.72:1.
              The border moves to brand-50/30 because the old brand-ink/40 read
              as invisible on a dark fill, and hover goes to brand-900 rather
              than brand-50, which would flash bright against the hero. */}
          <a
            href="#listings"
            className="inline-flex items-center rounded-lg border border-brand-50/30 bg-brand-deep px-5 py-2.5 text-sm font-semibold text-brand-50 transition-colors hover:bg-brand-900"
          >
            Browse listings
          </a>
        </div>
      </div>
    </section>
  );
}
