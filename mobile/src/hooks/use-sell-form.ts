// The Sell form's typed values, its checks (the website's: title 5-120 characters, a category, valid
// amounts, photos finished uploading) and Publish: POST /api/listings, then open the new item.
import { router } from "expo-router";
import { useState } from "react";

import type { useSellPhotos } from "@/hooks/use-sell-photos";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Listing, ListingCategory, ListingCondition } from "@/types";

/** The app offers four types. Auctions need a date picker, so they stay on the website. */
export type SellType = "sale" | "giveaway" | "trade" | "buy_request";

const isAmount = (text: string) => text.trim() !== "" && Number.isFinite(Number(text)) && Number(text) >= 0;

export function useSellForm(photos: ReturnType<typeof useSellPhotos>) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [condition, setCondition] = useState<ListingCondition>("good"); // the website's default
  const [type, setType] = useState<SellType>("sale");
  const [price, setPrice] = useState(""); // the price for a sale, the budget for a wanted post
  const [cashTopup, setCashTopup] = useState(""); // trade only; empty means none
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function check(): string | null {
    if (title.trim().length < 5) return "Title: use at least 5 characters.";
    if (!category) return "Pick a category.";
    if (type === "sale" && !isAmount(price)) return "Enter a price of $0 or more.";
    if (type === "buy_request" && price.trim() !== "" && !isAmount(price)) return "Enter a valid budget.";
    if (type === "trade" && cashTopup.trim() !== "" && !isAmount(cashTopup)) return "Enter a valid cash top-up.";
    if (photos.uploading) return "Wait for the photo to finish uploading.";
    return null;
  }

  async function publish() {
    if (busy) return; // Publish is disabled while it runs, so one tap makes one listing
    const problem = check();
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const amount = type === "sale" || type === "buy_request" ? Number(price || 0) : 0;
      const body = {
        title: title.trim(), description: description.trim(), category, condition, listingType: type, price: amount,
        cashTopup: type === "trade" && cashTopup.trim() !== "" ? Number(cashTopup) : null,
        imageUrls: photos.urls,
      };
      const data = await apiFetch<{ listing: Listing }>("/api/listings", { method: "POST", body, token });
      setTitle(""); setDescription(""); setCategory(null); setPrice(""); setCashTopup(""); setType("sale");
      photos.clear();
      router.push(`/listings/${data.listing.id}`);
    } catch (err) {
      setError(errorMessage(err)); // the API's own message, e.g. "Title is required (max 120 characters)."
    } finally {
      setBusy(false);
    }
  }

  return {
    title, setTitle, description, setDescription, category, setCategory, condition, setCondition,
    type, setType, price, setPrice, cashTopup, setCashTopup, error, busy, publish,
  };
}
