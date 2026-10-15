import { notFound, redirect } from "next/navigation";
import { NewListingForm } from "@/components/forms/NewListingForm";
import { ListingImage } from "@/components/listings/ListingImage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getListingById, requireUser } from "@/lib/api";

export const metadata = { title: "Edit listing | UniSwap" };

/** Owner-only page for changing a listing's details and photo. The API checks ownership again. */
export default async function EditListingPage({ params }: PageProps<"/listings/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser();
  const listing = await getListingById(id);

  if (!listing) notFound();
  if (listing.seller.id !== user.id) redirect(`/listings/${id}`);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Edit listing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes show up for everyone as soon as you save.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Item details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ListingImage
            src={listing.imageUrls[0]}
            alt={listing.title}
            className="aspect-[4/3] w-40 rounded-lg border border-border"
          />
          <NewListingForm listing={listing} />
        </CardContent>
      </Card>
    </div>
  );
}
