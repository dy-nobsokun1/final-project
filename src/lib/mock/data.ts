import type { Conversation, Listing, Message, User } from "@/types";

/**
 * In-memory fixtures standing in for the backend.
 * Swap these for real fetch calls once the API is available; the shapes match
 * the interfaces in `src/types` so the call sites will not change.
 */

const HOUR = 1000 * 60 * 60;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/**
 * Listing photos, resolved from `public/listings`. The first entry of each
 * listing's `imageUrls` is what the card and detail view render.
 *
 * Local paths keep the demo working offline and need no `images.remotePatterns`
 * in `next.config.ts`, which is why `ListingImage` uses a plain `<img>`.
 * Filenames must not contain spaces -- they would need percent-encoding in the
 * URL, so the files use hyphens.
 */
const MOCK_IMAGES = {
  textbooks: "/listings/calculus-book.jpg",
  electronics: "/listings/used-macbook.jpg",
  furniture: "/listings/desk.svg",
  bikes: "/listings/bike.jpg",
  clothing: "/listings/jacket.svg",
  other: "/listings/fridge.svg",
  /** l6 is filed under furniture but is an appliance, so it gets its own art. */
  fridge: "/listings/mini-fridge.avif",
} as const;

export const mockUsers: User[] = [
  {
    id: "u1",
    name: "Sokunth Navy",
    email: "sokunth@example.edu",
    avatarUrl: null,
    major: "Computer Science",
    graduationYear: 2027,
    bio: "Selling textbooks and desk gear I no longer need.",
    isVerified: true,
    createdAt: ago(120 * DAY),
  },
  {
    id: "u2",
    name: "Chanrithorn Lim",
    email: "chanrithorn@example.edu",
    avatarUrl: null,
    major: "Business",
    graduationYear: 2026,
    bio: "Furniture and small appliances, cash only, campus meetup.",
    isVerified: true,
    createdAt: ago(80 * DAY),
  },
  {
    id: "u3",
    name: "Dara Phal",
    email: "dara@example.edu",
    avatarUrl: null,
    major: "Architecture",
    graduationYear: 2028,
    bio: "Bike and gear enthusiast.",
    isVerified: false,
    createdAt: ago(30 * DAY),
  },
];

/** The signed-in user for the mock session. */
export const CURRENT_USER_ID = "u1";

export const mockListings: Listing[] = [
  {
    id: "l1",
    title: "Calculus: Early Transcendentals, 9th ed.",
    description:
      "Hardcover, no highlighting. Held together well but pages are clean. Includes the access code card (unused).",
    price: 45,
    category: "textbooks",
    condition: "good",
    imageUrls: [MOCK_IMAGES.textbooks],
    sellerId: "u1",
    status: "active",
    createdAt: ago(6 * HOUR),
  },
  {
    id: "l2",
    title: "Used MacBook Air M1, 8GB / 256GB",
    description:
      "Battery cycle count 143. Small scuff on the lid, screen is perfect. Comes with the original charger.",
    price: 520,
    category: "electronics",
    condition: "like_new",
    imageUrls: [MOCK_IMAGES.electronics],
    sellerId: "u2",
    status: "active",
    createdAt: ago(2 * DAY),
  },
  {
    id: "l3",
    title: "Adjustable standing desk",
    description:
      "Solid wood top, sits at 70-125cm. Moving out so it needs to go. Heavy, bring a friend or a cart.",
    price: 90,
    category: "furniture",
    condition: "good",
    imageUrls: [MOCK_IMAGES.furniture],
    sellerId: "u2",
    status: "reserved",
    createdAt: ago(4 * DAY),
  },
  {
    id: "l4",
    title: "Trek commuter bike, 3 speeds",
    description: "Reliable daily commuter. New chain and tires fitted last month. Lock included.",
    price: 180,
    category: "bikes",
    condition: "good",
    imageUrls: [MOCK_IMAGES.bikes],
    sellerId: "u3",
    status: "active",
    createdAt: ago(9 * DAY),
  },
  {
    id: "l5",
    title: "Winter puffer jacket, size M",
    description: "Worn two seasons. Fully waterproof, no tears. Dry cleaned before listing.",
    price: 25,
    category: "clothing",
    condition: "fair",
    imageUrls: [MOCK_IMAGES.clothing],
    sellerId: "u3",
    status: "sold",
    createdAt: ago(15 * DAY),
  },
  {
    id: "l6",
    title: "Mini fridge, 3.2 cu ft",
    description: "Works perfectly, minor dent on the door. Ideal for a dorm room.",
    price: 70,
    category: "furniture",
    condition: "good",
    imageUrls: [MOCK_IMAGES.fridge],
    sellerId: "u1",
    status: "active",
    createdAt: ago(3 * DAY),
  },
];

export const mockConversations: Conversation[] = [
  {
    id: "c1",
    listingId: "l2",
    participantIds: ["u1", "u2"],
    lastMessageAt: ago(5 * HOUR),
    unreadCount: 1,
  },
  {
    id: "c2",
    listingId: "l4",
    participantIds: ["u1", "u3"],
    lastMessageAt: ago(20 * HOUR),
    unreadCount: 0,
  },
];

export const mockMessages: Message[] = [
  {
    id: "m1",
    conversationId: "c1",
    senderId: "u2",
    body: "Hi! Is the battery health still around 90% or better?",
    createdAt: ago(6 * HOUR),
    readAt: ago(6 * HOUR),
  },
  {
    id: "m2",
    conversationId: "c1",
    senderId: "u1",
    body: "It is at 93%, I checked this morning.",
    createdAt: ago(5 * HOUR),
    readAt: null,
  },
  {
    id: "m3",
    conversationId: "c2",
    senderId: "u3",
    body: "Could I test the bike on Friday afternoon?",
    createdAt: ago(20 * HOUR),
    readAt: ago(19 * HOUR),
  },
];

