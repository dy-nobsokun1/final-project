"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { setListingSaved } from "@/lib/api/actions";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  listingId: string;
  /** For the button's accessible name: "Save <title>". */
  listingTitle: string;
  sellerId: string;
  /** Whether it is saved, as the server last said. */
  saved: boolean;
  className?: string;
}

/** The heart: saves a listing to the Saved page, or unsaves it. Signed-out visitors go to sign in. */
export function SaveButton({ listingId, listingTitle, sellerId, saved, className }: SaveButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // No heart on your own listing: the API refuses to save it too.
  if (user?.id === sellerId) return null;

  function handleClick() {
    if (!user) {
      router.push("/login");
      return;
    }
    const next = !optimisticSaved;
    setError(null);
    // The heart changes at once. On an error the action returns before refresh(), so when the
    // transition ends the heart falls back to the `saved` prop; on success refresh() brings the new
    // prop. The button is not disabled while saving: Next.js sends Server Actions one at a time,
    // and `next` is read from the optimistic value, so quick double clicks still end up right.
    startTransition(async () => {
      setOptimisticSaved(next);
      const result = await setListingSaved(listingId, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Button
        type="button"
        size="icon-lg"
        variant="outline"
        aria-label={`Save ${listingTitle}`}
        aria-pressed={optimisticSaved}
        title={optimisticSaved ? "Saved" : "Save"}
        onClick={handleClick}
        className="rounded-full border-border bg-brand-50 text-brand-ink hover:bg-brand-200 hover:text-brand-ink"
      >
        <Heart aria-hidden="true" className={cn("size-5", optimisticSaved && "fill-brand-danger text-brand-danger")} />
      </Button>
      {error ? (
        <p role="alert" className="light-surface max-w-48 rounded-md bg-card px-2 py-1 text-xs text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
