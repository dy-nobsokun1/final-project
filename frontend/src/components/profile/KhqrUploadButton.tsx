"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { readKhqrImage } from "@/lib/khqr/read-image";
import { cn } from "@/lib/utils";

/**
 * "Upload your KHQR": reads the Bakong account ID from a picture of the seller's own KHQR and hands
 * it to `onRead`. Saving stays with the caller. The picture is read in this browser tab and is never
 * uploaded or kept. The button is a label around a visually hidden file input, as in PhotoAddBox.
 */
export function KhqrUploadButton({ onRead }: { onRead: (accountId: string) => void }) {
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so that picking the same file again still counts as a change.
    event.target.value = "";
    if (!file) return;
    setIsReading(true);
    setError(null);
    const result = await readKhqrImage(file);
    setIsReading(false);
    if ("id" in result) onRead(result.id);
    else setError(result.error);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "w-fit cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foreground",
        )}
      >
        <QrCode aria-hidden="true" />
        {isReading ? "Reading..." : "Upload your KHQR"}
        <input type="file" accept="image/*" disabled={isReading} onChange={handleChange} className="sr-only" />
      </label>
      <p className="text-xs text-muted-foreground">
        UniSwap reads the ID in your browser. The image is not uploaded or kept.
      </p>
      {error ? <p role="alert" className="text-sm text-foreground">{error}</p> : null}
    </div>
  );
}
