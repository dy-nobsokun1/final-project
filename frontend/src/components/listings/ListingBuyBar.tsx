import Link from "next/link";

interface ListingBuyBarProps {
  /** The price as the listing page shows it (formatListingPrice). */
  price: string;
  /** Where the button goes: the auction panel (#bid) or the chat with the seller. */
  href: string;
  label: string;
}

/**
 * Phones only: the price and the main action in a bar fixed just above the tab bar, because on a
 * small screen the description pushes the real buttons off screen. The listing page decides when
 * it shows (never to the owner, and only while the listing is active).
 */
export function ListingBuyBar({ price, href, label }: ListingBuyBarProps) {
  return (
    <>
      {/* Takes up the bar's height at the end of the page, so the bar never covers content. */}
      <div aria-hidden="true" className="h-16 sm:hidden" />
      {/* 59.5px is MobileNav's height, so the bar sits right on top of it. */}
      <div className="fixed inset-x-0 bottom-[59.5px] z-30 flex items-center justify-between gap-3 border-t border-brand-200/50 bg-background px-4 py-2 sm:hidden">
        <p className="font-heading text-3xl leading-none tracking-wide text-foreground">{price}</p>
        <Link
          href={href}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
        >
          {label}
        </Link>
      </div>
    </>
  );
}
