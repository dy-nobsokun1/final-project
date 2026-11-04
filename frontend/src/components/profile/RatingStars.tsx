import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** 1 to 5. An average like 4.4 fills the nearest whole number of stars. */
  rating: number;
  className?: string;
}

/** Five stars with the first `rating` filled in. Screen readers hear the number instead. */
export function RatingStars({ rating, className }: RatingStarsProps) {
  const filled = Math.round(rating);
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= filled ? "fill-current text-brand-600" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}
