// `Image` collides with `next/image`, so it is aliased to keep both usable.
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListingImageProps {
  src?: string;
  alt: string;
  className?: string;
}

/**
 * Listing photo with a placeholder while uploads are not wired up.
 * Real uploads will need a remote pattern in `next.config.ts`; see the note
 * in `src/components/profile/UserAvatar.tsx` for why the fallback stays a plain img.
 */
export function ListingImage({ src, alt, className }: ListingImageProps) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-zinc-100 text-zinc-400",
          className,
        )}
      >
        <ImageIcon aria-hidden="true" className="size-8" />
        <span className="sr-only">No photo for {alt}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("object-cover", className)} />
  );
}

