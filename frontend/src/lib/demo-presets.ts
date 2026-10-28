import type { ListingCategory, ListingCondition, ListingType } from "@/types";

export interface DemoPreset {
  type: ListingType;
  title: string;
  price: number;
  category: ListingCategory;
  condition: ListingCondition;
  description: string;
  photoUrl: string;
  minIncrement?: number;
  getAuctionEndsAt?: () => string;
}

/** Returns a date 3 days from now in the user's local YYYY-MM-DDTHH:mm format. */
export function getDemoAuctionEndsAt(): string {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Authentic, campus-ready demo presets matching real camera photography from the web for each listing type.
 */
export const DEMO_PRESETS: Record<ListingType, DemoPreset> = {
  sale: {
    type: "sale",
    title: "Calculus: Early Transcendentals, 9th ed.",
    price: 7,
    category: "textbooks",
    condition: "like_new",
    description:
      "Clean hardcover 9th edition by James Stewart. No markings or highlighting.",
    photoUrl: "/listings/demo-calculus.png",
  },
  auction: {
    type: "auction",
    title: "City Bike (Single-speed, 26-inch)",
    price: 50,
    category: "bikes",
    condition: "good",
    description:
      "Lightweight single-speed city bike with reliable brakes and front basket. Great for commuting around campus. Bidding starts at $50.",
    photoUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop&q=80",
    minIncrement: 5,
    getAuctionEndsAt: getDemoAuctionEndsAt,
  },
  trade: {
    type: "trade",
    title: "RGB Mechanical Keyboard (TKL)",
    price: 0,
    category: "electronics",
    condition: "good",
    description:
      "Tactile mechanical keyboard in great condition with custom keycaps. Looking to trade for a vertical mouse or desk lamp on campus.",
    photoUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
  },
  giveaway: {
    type: "giveaway",
    title: "Metal Desk Lamp (Adjustable)",
    price: 0,
    category: "other",
    condition: "good",
    description:
      "Sturdy black metal adjustable desk lamp. Works perfectly with standard E27 LED bulb included. Free to pick up near the library.",
    photoUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80",
  },
  buy_request: {
    type: "buy_request",
    title: "Compact Dorm Mini-Fridge",
    price: 30,
    category: "other",
    condition: "good",
    description:
      "Looking to buy a clean, working compact mini-fridge for my campus dorm room. Can meet and pay anywhere on campus.",
    photoUrl: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80",
  },
};

/**
 * Standard Stripe test card presets for presentation and demo checkouts.
 */
export const DEMO_CARD_PRESET = {
  number: "4242 4242 4242 4242",
  rawNumber: "4242424242424242",
  exp: "12/30",
  cvc: "123",
  name: "Test Student",
  country: "Cambodia (or US)",
  postalCode: "12000 / 90210",
};
