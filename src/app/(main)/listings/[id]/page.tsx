import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingImage } from "@/components/listings/ListingImage";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { getListingById } from "@/lib/api";
import { CATEGORIES, conditionLabel } from "@/lib/constants";
import { formatPrice, formatRelativeTime } from "@/lib/utils";

/** Detail view for a single listing. */
export default async function ListingDetailPage({ params }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) notFound();

  const category = CATEGORIES.find((item) => item.value === listing.category);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to browse
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        <ListingImage
          src={listing.imageUrls[0]}
          alt={listing.title}
          className="aspect-[4/3] w-full rounded-xl border border-border"
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {category ? <Badge variant="secondary">{category.label}</Badge> : null}
              <Badge variant="outline">{conditionLabel(listing.condition)}</Badge>
              {listing.status !== "active" ? (
                <Badge variant={listing.status === "sold" ? "outline" : "default"}>
                  {listing.status === "sold" ? "Sold" : "Reserved"}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
            <p className="text-3xl font-semibold">{formatPrice(listing.price)}</p>
          </div>

          <p className="leading-relaxed text-foreground">{listing.description}</p>

          <Link
            href={`/messages?listing=${listing.id}`}
            className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/85"
          >
            Message seller
          </Link>

          <div className="light-surface rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={listing.seller.name} src={listing.seller.avatarUrl} />
              <div className="flex flex-col">
                <Link
                  href={`/profile/${listing.seller.id}`}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  {listing.seller.name}
                  <VerifiedBadge isVerified={listing.seller.isVerified} />
                </Link>
                <p className="text-xs text-muted-foreground">Posted {formatRelativeTime(listing.createdAt)}</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden="true" className="size-4" />
              Meet on campus. Exchange items in person.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

