"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ListingPhotos } from "@/hooks/use-listing-photos";
import { DRAFT_SELECTS, fillListingForm, type PhotoDraft, type PriceHint } from "@/lib/fill-listing-form";
import { shrinkPhoto } from "@/lib/shrink-photo";

/** The API gives up after 20 s; this covers that plus the upload. */
const TIMEOUT_MS = 30 * 1000;
/**
 * The sell form's starting select values (NewListingForm.tsx). Read here, not from the page: Radix
 * fills its hidden <select> only after its options load. A select holding another value was set by an
 * Ask UniSwap draft or the demo presets, so it is not empty.
 */
const START_VALUES: Record<string, string> = { category: "textbooks", condition: "good" };

export type PhotoDraftState =
  | { status: "idle" | "working" }
  | { status: "done"; filled: number; hint: PriceHint | null; filledPrice: number | null }
  | { status: "error"; message: string };

/**
 * "Fill in from photo" on a new listing: sends the first picked photo, shrunk, to POST /api/listing-draft
 * and fills the form's EMPTY fields from the answer (lib/fill-listing-form.ts). A category or condition
 * select counts as empty while it holds its starting value and the student has not picked it.
 * `enabled` is false until the API says a vision model is set up, so the button stays hidden without one.
 */
export function usePhotoDraft(formRef: RefObject<HTMLFormElement | null>, photos: ListingPhotos) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<PhotoDraftState>({ status: "idle" });
  const picked = useRef(new Set<string>());
  const ourValues = useRef<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/listing-draft").then((response) => response.json())
      .then((body) => setEnabled(body.enabled === true), () => setEnabled(false));
  }, []);

  // Remembers which selects the student picked. Radix fires "change" for a student's pick, and also for
  // our own fill: those carry the value we set, so they are skipped.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    function onChange(event: Event) {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.value !== ourValues.current[target.name]) picked.current.add(target.name);
    }
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [formRef]);

  // Only a photo picked on this device has its file; the cached demo photo has none.
  const photo = photos.items.find((item) => item.file);

  async function run() {
    const form = formRef.current;
    if (!photo?.file || !form) return;
    setState({ status: "working" });
    try {
      const response = await fetch("/api/listing-draft", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: await shrinkPhoto(photo.file),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not read the photo right now. Please fill in the form yourself.");
      const { draft, priceHint } = body as { draft: PhotoDraft; priceHint: PriceHint | null };
      const freeSelects = DRAFT_SELECTS.filter((name) => !picked.current.has(name)
        && form.querySelector<HTMLSelectElement>(`select[name="${name}"]`)?.value === START_VALUES[name]);
      for (const name of freeSelects) ourValues.current[name] = draft[name];
      setState({ status: "done", hint: priceHint, ...fillListingForm(form, draft, priceHint, freeSelects) });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      const message = timedOut || !(error instanceof Error) || error.name !== "Error"
        ? "Could not read the photo right now. Please fill in the form yourself." : error.message;
      setState({ status: "error", message });
    }
  }

  return { canRun: enabled && Boolean(photo), state, run };
}
