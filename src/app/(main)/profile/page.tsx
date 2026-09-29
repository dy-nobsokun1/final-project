import { Inbox } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { getConversations, getMyListings, getUserById } from "@/lib/api";
import { CURRENT_USER_ID } from "@/lib/mock/data";

export const metadata = { title: "My profile | UniSwap" };

/** Profile of the signed-in user. */
export default async function ProfilePage() {
  const [listings, conversations, user] = await Promise.all([
    getMyListings(),
    getConversations(),
    getUserById(CURRENT_USER_ID),
  ]);

  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 p-6">
          <UserAvatar name={user.name} src={user.avatarUrl} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
              {user.name}
              <VerifiedBadge isVerified={user.isVerified} />
            </h1>
            <p className="text-sm text-zinc-500">
              {user.major} &middot; Class of {user.graduationYear}
            </p>
            <p className="mt-2 text-sm text-zinc-700">{user.bio}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings">
              <Button variant="secondary">Settings</Button>
            </Link>
            <Link href="/messages">
              <Button variant="ghost">
                <Inbox aria-hidden="true" className="size-4" />
                {conversations.length} chats
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Active listings</h2>
        <ListingGrid
          listings={listings.filter((listing) => listing.status === "active")}
          emptyTitle="No active listings"
          emptyDescription="List something to start selling."
          emptyAction={{ href: "/listings/new", label: "Create a listing" }}
        />
      </section>
    </div>
  );
}

