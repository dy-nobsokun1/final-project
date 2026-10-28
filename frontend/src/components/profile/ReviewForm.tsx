"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/lib/api/actions";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
  listingId: string;
  reviewee: { id: string; name: string };
}

/** Pick 1-5 stars and optionally add a comment. The API re-checks who may review whom. */
export function ReviewForm({ listingId, reviewee }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === 0) {
      setError("Choose from 1 to 5 stars.");
      return;
    }
    const comment = String(new FormData(event.currentTarget).get("comment") ?? "");
    setIsBusy(true);
    setError(null);
    const result = await submitReview(listingId, reviewee.id, rating, comment);
    setIsBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <p className="text-sm font-medium">How was your deal with {reviewee.name}?</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} out of 5 stars`}
            aria-pressed={star === rating}
            onClick={() => setRating(star)}
          >
            <Star
              aria-hidden="true"
              className={cn("size-6", star <= rating ? "fill-current text-brand-600" : "text-muted-foreground/50")}
            />
          </button>
        ))}
      </div>
      {/* 1000 characters is the API's limit (MAX_REVIEW_LENGTH in backend/src/utils/validation.js). */}
      <Textarea name="comment" maxLength={1000} aria-label="Comment" placeholder="Optional: how did the handover go?" />
      <Button type="submit" disabled={isBusy} className="w-fit">
        {isBusy ? "Posting..." : "Post review"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </form>
  );
}
