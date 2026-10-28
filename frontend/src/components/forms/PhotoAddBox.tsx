"use client";

import { ImagePlus } from "lucide-react";
import { useField } from "@/components/forms/Field";
import { MAX_LISTING_PHOTOS, MAX_PHOTO_MB } from "@/lib/constants";

interface PhotoAddBoxProps {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}

/**
 * PhotoPicker's file button: a dashed box instead of the browser's raw "Choose Files" control. The
 * box is a label around a visually hidden file input, so clicking it, or Tab then Enter or Space,
 * still opens the file picker, and the Field's label and error stay linked to the input.
 * The dashed border is black at 50%, about 3.7:1 against the box (brand-600 was only 2.5:1).
 */
export function PhotoAddBox({ disabled, onFiles }: PhotoAddBoxProps) {
  const { controlId, errorId, hasError } = useField();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Cleared so that picking the same file again (e.g. after removing it) still counts as a change.
    event.target.value = "";
    onFiles(files);
  }

  return (
    <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-brand-ink/50 bg-brand-50/40 px-4 py-6 text-center transition-colors hover:bg-brand-50/70 has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-ink">
      <ImagePlus aria-hidden="true" className="size-6" />
      <span className="text-sm font-medium">{disabled ? "All photos added" : "Add photos"}</span>
      <span className="text-xs text-muted-foreground">
        Up to {MAX_LISTING_PHOTOS}, at most {MAX_PHOTO_MB} MB each. The first is the cover.
      </span>
      <input
        id={controlId}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={disabled}
        onChange={handleChange}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className="sr-only"
      />
    </label>
  );
}
