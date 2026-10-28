// The Telegram bot's screens (utils/telegramBot.js shows them). Each function only builds text and
// buttons from rows the database already returned, so the tests can check them without Telegram.
// Everything is plain text (no parse_mode), so titles, names and descriptions need no escaping.
//
// A screen is { text, buttons, photoUrl? }. `buttons` is a list of rows, each a list of Telegram
// buttons: { text, callback_data } comes back to the bot when tapped (at most 64 bytes), and
// { text, url } opens a link.

const TYPE_LABELS = { sale: "For sale", trade: "For trade", giveaway: "Giveaway", buy_request: "Wanted", auction: "Auction" };
const CONDITION_LABELS = { new: "New", like_new: "Like new", good: "Good", fair: "Fair" };
const CATEGORY_LABELS = {
  textbooks: "Textbooks", electronics: "Electronics", furniture: "Furniture",
  clothing: "Clothing", bikes: "Bikes", other: "Other",
};
const STATUS_LABELS = { active: "Available", reserved: "Reserved", sold: "Sold", traded: "Traded" };

/** How much of a description the item card shows. */
const DESCRIPTION_LENGTH = 200;

export const NOT_LINKED_TEXT =
  "To get UniSwap notifications here, open UniSwap, go to Settings and press \"Connect Telegram\".";

const button = (text, data) => ({ text, callback_data: data });
const link = (text, url) => ({ text, url });
const MENU_BUTTON = button("⬅ Menu", "menu");

/** $12 or $12.50, like formatPrice on the website. */
export function usd(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** A listing row's price as the website shows it (formatListingPrice in frontend/src/lib/utils.ts). */
export function priceText(row) {
  const price = Number(row.price);
  if (row.listing_type === "giveaway") return "Free";
  // A wanted post's price is its budget; 0 means any price.
  if (row.listing_type === "buy_request") return price > 0 ? `Budget: up to ${usd(price)}` : "Budget: any";
  if (row.listing_type === "auction") return usd(Number(row.highest_bid ?? price));
  if (row.listing_type === "trade" && price === 0) return "Trade";
  return usd(price);
}

/** Cuts text to `max` characters, ending in "…". Array.from counts an emoji as one, so none is cut in half. */
export function shorten(text, max) {
  const characters = Array.from(text.trim());
  return characters.length <= max ? characters.join("") : `${characters.slice(0, max - 1).join("").trimEnd()}…`;
}

/** The website's address for link buttons, or null: Telegram refuses links to localhost or plain http. */
export function publicSiteUrl(origin) {
  try {
    const url = new URL(origin);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" && !isLocal ? url.origin : null;
  } catch {
    return null;
  }
}

export function notLinkedScreen() {
  return { text: NOT_LINKED_TEXT, buttons: [] };
}

/** The main menu. `greeting` goes above it, e.g. after the chat was linked. */
export function menuScreen(greeting = "") {
  return {
    text: `${greeting}What would you like to do? You can also just type what you're looking for.`,
    buttons: [
      [button("🔎 Search", "search"), button("🆕 Newest", "newest")],
      [button("❤️ Saved", "saved"), button("📦 My listings", "mine")],
      [button("💬 Inbox", "inbox"), button("❓ Help", "help")],
    ],
  };
}

export function searchPromptScreen() {
  return { text: "What are you looking for? Just type it.", buttons: [[MENU_BUTTON]] };
}

/** One button per listing, each opening its item card. */
function listingButtons(rows, label) {
  return rows.map((row) => [button(label(row), `item:${row.id}`)]);
}

const titleAndPrice = (row) => `${shorten(row.title, 40)} · ${priceText(row)}`;

/** One page of search results (searchListings in db/telegram.js), with "More ▸" if there are more. */
export function resultsScreen(term, page, { listings, hasMore }) {
  if (listings.length === 0) {
    const text = page > 1
      ? `No more results for "${term}".`
      : `Nothing matches "${term}" right now. Try another word, or post a wanted request on UniSwap.`;
    return { text, buttons: [[MENU_BUTTON]] };
  }
  const lastRow = hasMore ? [MENU_BUTTON, button("More ▸", `page:${page + 1}`)] : [MENU_BUTTON];
  return {
    text: `Results for "${term}"${page > 1 ? ` (page ${page})` : ""}. Tap one to see it.`,
    buttons: [...listingButtons(listings, titleAndPrice), lastRow],
  };
}

export function newestScreen(rows) {
  if (rows.length === 0) return { text: "There are no listings yet.", buttons: [[MENU_BUTTON]] };
  return { text: "The newest items on UniSwap. Tap one to see it.", buttons: [...listingButtons(rows, titleAndPrice), [MENU_BUTTON]] };
}

/** "More" after the API restarted: the last search is no longer known. */
export function expiredSearchScreen() {
  return { text: "That search has expired. Type what you're looking for to search again.", buttons: [[MENU_BUTTON]] };
}

const BACK_LABELS = {
  search: "⬅ Back to results", newest: "⬅ Back to results",
  saved: "⬅ Back to Saved", mine: "⬅ Back to My listings",
};

/**
 * The card for one listing (a LISTING_SELECT row). `backTo` is the list it was opened from (the
 * kinds in BACK_LABELS), or null. `siteUrl` comes from publicSiteUrl.
 */
export function itemScreen(row, { isSaved, isOwn, backTo, siteUrl }) {
  const ended = row.listing_type === "auction" && row.auction_ended ? " (ended)" : "";
  const lines = [
    row.title,
    `${priceText(row)} · ${TYPE_LABELS[row.listing_type]}${ended}`,
    `Condition: ${CONDITION_LABELS[row.condition]} · ${CATEGORY_LABELS[row.category]}`,
    `${row.listing_type === "buy_request" ? "Posted by" : "Seller"}: ${row.seller_name}`,
  ];
  if (row.status !== "active") lines.push(`Status: ${STATUS_LABELS[row.status]}`);
  if (isOwn) lines.push("This is your listing.");
  if (row.description.trim()) lines.push("", shorten(row.description, DESCRIPTION_LENGTH));

  const cover = row.image_urls[0];
  return {
    text: lines.join("\n"),
    photoUrl: cover?.startsWith("https://") ? cover : undefined,
    buttons: itemButtons(row.id, { isSaved, isOwn, backTo, siteUrl }),
  };
}

/** The item card's buttons. The bot also rebuilds them alone after Save or Unsave. */
export function itemButtons(listingId, { isSaved, isOwn, backTo, siteUrl }) {
  const rows = [];
  if (!isOwn) rows.push([isSaved ? button("💔 Unsave", `unsave:${listingId}`) : button("❤️ Save", `save:${listingId}`)]);
  if (siteUrl) rows.push([link("Open on UniSwap", `${siteUrl}/listings/${listingId}`)]);
  rows.push(BACK_LABELS[backTo] ? [button(BACK_LABELS[backTo], "back"), MENU_BUTTON] : [MENU_BUTTON]);
  return rows;
}

export function goneScreen() {
  return { text: "That listing isn't on UniSwap any more.", buttons: [[MENU_BUTTON]] };
}

export function savedScreen(rows) {
  if (rows.length === 0) {
    return { text: "You haven't saved anything yet. Tap ❤️ Save on an item to keep it here.", buttons: [[MENU_BUTTON]] };
  }
  const label = (row) => `${shorten(row.title, 30)} · ${priceText(row)} · ${STATUS_LABELS[row.status]}`;
  return { text: "Your saved items, newest first:", buttons: [...listingButtons(rows, label), [MENU_BUTTON]] };
}

const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Your active and reserved listings (myListings in db/telegram.js), with their saves and waiting offers. */
export function myListingsScreen(rows) {
  if (rows.length === 0) {
    return { text: "You have no available or reserved listings. Post one on UniSwap.", buttons: [[MENU_BUTTON]] };
  }
  const label = (row) => {
    const offers = row.waiting_offers > 0 ? ` · ${count(row.waiting_offers, "offer")} waiting` : "";
    return `${shorten(row.title, 24)} · ${priceText(row)} · ${STATUS_LABELS[row.status]} · ${count(row.save_count, "save")}${offers}`;
  };
  return { text: "Your listings that are still available or reserved:", buttons: [...listingButtons(rows, label), [MENU_BUTTON]] };
}

/** How many conversations the inbox lists by name. */
const INBOX_LINES = 10;

/** Unread messages, one line per conversation (unreadConversations in db/telegram.js). */
export function inboxScreen(conversations, siteUrl) {
  const total = conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0);
  const buttons = siteUrl ? [[link("Open inbox", `${siteUrl}/messages`)], [MENU_BUTTON]] : [[MENU_BUTTON]];
  if (total === 0) return { text: "No unread messages.", buttons };

  const lines = conversations.slice(0, INBOX_LINES).map((conversation) =>
    `${conversation.partner_name} about "${shorten(conversation.listing_title, 40)}" (${conversation.unread_count})`);
  const more = conversations.length - INBOX_LINES;
  if (more > 0) lines.push(`…and ${count(more, "more conversation")}`);
  const heading = `💬 You have ${count(total, "unread message")}.`;
  const note = "Reply on UniSwap: reading them here doesn't mark them as read.";
  return { text: [heading, "", ...lines, "", note].join("\n"), buttons };
}

export function helpScreen() {
  const lines = [
    "• Type any word (or /search lamp) to search the listings, or tap 🆕 Newest.",
    "• ❤️ Saved, 📦 My listings and 💬 Inbox show your own UniSwap account.",
    "• Notifications (new messages, offers, bids, price drops) keep arriving here as before.",
    "• To buy, pay, bid or reply, open UniSwap.",
  ];
  return { text: lines.join("\n"), buttons: [[MENU_BUTTON]] };
}
