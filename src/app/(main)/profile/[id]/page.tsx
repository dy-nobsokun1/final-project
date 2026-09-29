import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { getListingsBySeller, getUserById } from "@/lib/api";

/** Public profile of any user, showing the listings they have posted. */
export default async function PublicProfilePage({
  params,
}: PageProps<"/profile/[id]">) {
  const { id } = await params;
  const [user, listings] = await Promise.all([
    getUserById(id),
    getListingsBySeller(id),
  ]);

  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <UserAvatar name={user.name} src={user.avatarUrl} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
            {user.name}
            <VerifiedBadge isVerified={user.isVerified} />
          </h1>
          <p className="text-sm text-zinc-500">
            {user.major} &middot; Class of {user.graduationYear}
          </p>
          <Badge
            variant={user.isVerified ? "secondary" : "outline"}
            className="w-fit"
          >
            {user.isVerified ? "Verified student" : "Unverified"}
          </Badge>
        </div>
      </header>

      {user.bio ? <p className="text-sm text-zinc-700">{user.bio}</p> : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {listings.length} {listings.length === 1 ? "listing" : "listings"}
        </h2>
        <ListingGrid
          listings={listings}
          emptyTitle="No listings yet"
          emptyDescription="This student has not posted anything."
        />
      </section>
    </div>
  );
}

