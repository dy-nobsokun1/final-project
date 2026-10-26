import { Megaphone } from "lucide-react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { formatListingPrice } from "@/lib/utils";
import type { WantedDraft } from "@/types";

/**
 * A wanted post that Ask UniSwap drafted. Nothing is posted here: the link opens the sell form
 * filled in with it (app/(main)/listings/new/page.tsx reads these query params), and the student
 * checks it and posts it themselves.
 */
export function WantedDraftCard({ draft }: { draft: WantedDraft }) {
  const category = CATEGORIES.find((item) => item.value === draft.category)?.label ?? "Other";
  const budget = formatListingPrice({ listingType: "buy_request", price: draft.budget, auction: null });
  const params = new URLSearchParams({
    type: "buy_request",
    title: draft.title,
    description: draft.description,
    category: draft.category,
    price: String(draft.budget),
  });

  return (
    <div className="flex max-w-md flex-col gap-2 rounded-xl border border-dashed border-brand-ink/40 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Megaphone aria-hidden="true" className="size-3.5" />
        Wanted post draft
      </p>
      <p className="font-medium text-foreground">{draft.title}</p>
      {draft.description ? <p className="text-sm text-muted-foreground">{draft.description}</p> : null}
      <p className="text-sm text-foreground">
        {category} · {budget}
      </p>
      <Link
        href={`/listings/new?${params}`}
        className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85"
      >
        Check and post it
      </Link>
    </div>
  );
}
