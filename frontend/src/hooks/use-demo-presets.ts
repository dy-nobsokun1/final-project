"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import type { ListingPhotos } from "@/hooks/use-listing-photos";
import { DEMO_PRESETS, getDemoAuctionEndsAt, type DemoPreset } from "@/lib/demo-presets";
import type { ListingCategory, ListingCondition, ListingType } from "@/types";

/** Presentation helpers for the sell form. Off unless frontend/.env.local has NEXT_PUBLIC_DEMO_PRESETS=true. */
const DEMO_ON = process.env.NEXT_PUBLIC_DEMO_PRESETS === "true";
/** Names the preset photo, so it can be told apart from photos the student picked. */
const PHOTO_PREFIX = "demo-preset-";
/** Server URLs of preset photos that were already uploaded, by source image. Never a local preview. */
const uploadedPhotos = new Map<string, string>();

/** The preset text for a form field, by the field's `name`. */
function textFor(name: string, preset: DemoPreset): string | undefined {
  if (name === "title") return preset.title;
  if (name === "description") return preset.description;
  if (name === "price") return String(preset.price);
  if (name === "auctionEndsAt") return (preset.getAuctionEndsAt ?? getDemoAuctionEndsAt)();
  if (name === "minIncrement") return String(preset.minIncrement ?? 5);
  return undefined;
}

const TEXT_FIELDS = ["title", "description", "price", "auctionEndsAt", "minIncrement"];

/**
 * Shows the preset photo for a type: it replaces the previous preset photo, never a photo the student
 * picked, and is only added while the student has picked none. It counts as uploading (so the form
 * cannot be sent) until the server URL is back; a failed upload removes it and shows an error.
 */
async function showPresetPhoto(preset: DemoPreset, photos: RefObject<ListingPhotos>, latest: RefObject<number>) {
  const run = ++latest.current;
  for (const photo of photos.current.items) {
    if (photo.name.startsWith(PHOTO_PREFIX)) photos.current.remove(photo.key);
  }
  if (photos.current.items.some((photo) => !photo.name.startsWith(PHOTO_PREFIX))) return;

  const name = `${PHOTO_PREFIX}${preset.type}.jpg`;
  const cached = uploadedPhotos.get(preset.photoUrl);
  if (cached) {
    photos.current.addUploaded(name, cached);
    return;
  }
  try {
    const response = await fetch(preset.photoUrl);
    if (!response.ok) throw new Error("The preset photo could not be loaded.");
    const blob = await response.blob();
    if (run !== latest.current) return; // another type was picked while this one loaded
    const [url] = await photos.current.addFiles([new File([blob], name, { type: blob.type || "image/jpeg" })]);
    if (url) uploadedPhotos.set(preset.photoUrl, url);
  } catch (error) {
    console.warn("Preset photo skipped:", error);
  }
}

interface DemoPresetOptions {
  /** False when editing a listing or starting from an Ask UniSwap draft. */
  enabled: boolean;
  listingType: ListingType;
  formRef: RefObject<HTMLFormElement | null>;
  photos: ListingPhotos;
}

/**
 * Demo helpers for a brand-new listing: preset placeholders, Tab to fill an empty field, Alt+D to fill
 * the whole form, and the preset photo. They only fill fields in; submitting never adds a value, so the
 * form's own validation always runs. Returns `preset` (null when off), the form's `onKeyDown`, and
 * `selects`, whose `id` is a `key` that makes the category and condition selects take Alt+D's values.
 */
export function useDemoPresets({ enabled, listingType, formRef, photos }: DemoPresetOptions) {
  const preset = DEMO_ON && enabled ? DEMO_PRESETS[listingType] : null;
  const [selects, setSelects] = useState<{ id: number; category?: ListingCategory; condition?: ListingCondition }>({
    id: 0,
  });
  const photosRef = useRef(photos);
  const latestPhoto = useRef(0);

  useEffect(() => {
    photosRef.current = photos;
  });

  useEffect(() => {
    if (preset) void showPresetPhoto(preset, photosRef, latestPhoto);
  }, [preset]);

  // Alt+D (Option+D on a Mac) fills every field of the current type at once.
  useEffect(() => {
    if (!preset) return;
    function fillAll(event: globalThis.KeyboardEvent) {
      const isD = event.code === "KeyD" || event.key.toLowerCase() === "d" || event.key === "∂";
      if (!preset || !event.altKey || event.ctrlKey || event.metaKey || !isD) return;
      event.preventDefault();
      for (const name of TEXT_FIELDS) {
        const field = formRef.current?.elements.namedItem(name);
        const text = textFor(name, preset);
        if (text !== undefined && (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
          field.value = text;
        }
      }
      setSelects((current) => ({ id: current.id + 1, category: preset.category, condition: preset.condition }));
      void showPresetPhoto(preset, photosRef, latestPhoto);
    }
    window.addEventListener("keydown", fillAll);
    return () => window.removeEventListener("keydown", fillAll);
  }, [preset, formRef]);

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const field = event.target;
    if (!preset || event.key !== "Tab" || event.shiftKey) return;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.value !== "") return;
    const text = textFor(field.name, preset);
    if (text !== undefined) field.value = text;
  }

  return { preset, selects, onKeyDown: preset ? onKeyDown : undefined };
}
