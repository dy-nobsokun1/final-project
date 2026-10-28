import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { VerifiedBadge } from "@/components/profile/VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import type { Listing, User } from "@/types";

interface ProfileHeaderProps {
  user: User;
  /** Everything the user has posted, in any status, for the stats. */
  listings: Pick<Listing, "status">[];
  averageRating: number | null;
  reviewCount: number;
  /** Your own profile: asks for a bio when it is empty, and leaves out the "Verified student" badge. */
  isOwnProfile?: boolean;
  /** Links shown beside the name, or on their own row below it on phones. */
  actions?: ReactNode;
}

/** Top of both profile pages, styled like the home page hero: the same card, gradient and grid. */
export function ProfileHeader({ user, listings, averageRating, reviewCount, isOwnProfile, actions }: ProfileHeaderProps) {
  const details = [user.major, user.graduationYear && `Class of ${user.graduationYear}`].filter(Boolean).join(" · ");

  return (
    <section className="light-surface relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-200 to-brand-50">
      <div aria-hidden="true" className="brand-grid absolute inset-0 opacity-60" />

      <div className="relative flex flex-col gap-5 p-5 sm:p-8">
        {/* Phones stack the links under the name, so the name is never squeezed. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar name={user.name} src={user.avatarUrl} size="xl" />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="flex flex-wrap items-center gap-1.5 text-2xl font-semibold tracking-tight break-words">
                {user.name}
                <VerifiedBadge isVerified={user.isVerified} />
              </h1>
              {details ? <p className="text-sm text-muted-foreground">{details}</p> : null}
              {isOwnProfile ? null : (
                <Badge variant="outline" className="w-fit border-border bg-brand-50 text-brand-ink">
                  {user.isVerified ? "Verified student" : "Unverified"}
                </Badge>
              )}
            </div>
          </div>
          {actions ? <div className="flex gap-2 *:flex-1 sm:shrink-0 sm:*:flex-none">{actions}</div> : null}
        </div>

        {user.bio ? (
          <p className="max-w-prose text-sm">{user.bio}</p>
        ) : isOwnProfile ? (
          <Link href="/settings" className="w-fit text-sm font-semibold underline underline-offset-4 hover:no-underline">
            Add a bio in Settings
          </Link>
        ) : null}

        <ProfileStats
          listings={listings}
          averageRating={averageRating}
          reviewCount={reviewCount}
          createdAt={user.createdAt}
        />
      </div>
    </section>
  );
}
