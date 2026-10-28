import { LoaderCircle, X } from "lucide-react";
import { ListingImage } from "@/components/listings/ListingImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FormPhoto } from "@/hooks/use-listing-photos";

interface PhotoThumbProps {
  photo: FormPhoto;
  /** 1 is the cover. */
  position: number;
  onRemove: () => void;
  onMakeCover: () => void;
}

/**
 * One photo on the listing form: a spinner while it uploads, then the photo with buttons to remove
 * it or make it the cover. Every button is type="button", so none of them submits the form.
 */
export function PhotoThumb({ photo, position, onRemove, onMakeCover }: PhotoThumbProps) {
  if (photo.url === null) {
    return (
      <li className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted p-2 text-center text-xs text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        Uploading...
        <span className="line-clamp-1 break-all">{photo.name}</span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="relative">
        <ListingImage
          src={photo.url}
          alt={position === 1 ? `Photo ${position} (cover)` : `Photo ${position}`}
          className="aspect-square w-full rounded-lg border border-border"
        />
        {position === 1 ? <Badge className="absolute left-1 top-1">Cover</Badge> : null}
        <Button
          type="button"
          size="icon-xs"
          variant="secondary"
          aria-label={`Remove photo ${position}`}
          onClick={onRemove}
          className="absolute right-1 top-1"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {position > 1 ? (
        <Button type="button" size="xs" variant="ghost" onClick={onMakeCover}>
          Make cover<span className="sr-only"> for photo {position}</span>
        </Button>
      ) : null}
    </li>
  );
}
