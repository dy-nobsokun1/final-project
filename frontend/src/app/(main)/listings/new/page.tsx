import { NewListingForm } from "@/components/forms/NewListingForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";
import type { ListingDraft } from "@/types";

export const metadata = { title: "Sell an item | UniSwap" };

export default async function NewListingPage({ searchParams }: PageProps<"/listings/new">) {
  await requireUser();
  const draft = wantedDraft(await searchParams);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Create a listing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {draft
            ? "Ask UniSwap filled this in for you. Check every field, then post it."
            : "Be honest about condition. Clear listings sell faster."}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Item details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewListingForm draft={draft} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * A wanted post drafted by Ask UniSwap arrives as query params (WantedDraftCard). Only wanted posts
 * are filled in this way, and unknown categories and bad prices fall back to safe values.
 */
function wantedDraft(params: Record<string, string | string[] | undefined>): ListingDraft | undefined {
  if (params.type !== "buy_request") return undefined;
  const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const price = Number(params.price);
  return {
    listingType: "buy_request",
    title: text(params.title),
    description: text(params.description),
    category: CATEGORIES.find((item) => item.value === params.category)?.value ?? "other",
    price: Number.isFinite(price) && price >= 0 ? price : 0,
  };
}
