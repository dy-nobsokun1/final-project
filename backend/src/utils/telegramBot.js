import { findListingById } from "../db/listings.js";
import { saveListing, unsaveListing } from "../db/saved.js";
import {
  findChatUser, isSaved, linkChat, myListings, newestListings, savedListings, searchListings, unreadConversations,
} from "../db/telegram.js";
import {
  answerTelegramButton, deleteTelegramMessage, editTelegramButtons, editTelegramMessage,
  sendTelegramMessage, sendTelegramPhoto, setTelegramCommands,
} from "../services/telegram.js";
import { siteOrigin } from "../services/tunnel.js";
import {
  expiredSearchScreen, goneScreen, helpScreen, inboxScreen, itemButtons, itemScreen, menuScreen,
  myListingsScreen, newestScreen, NOT_LINKED_TEXT, notLinkedScreen, publicSiteUrl, resultsScreen,
  savedScreen, searchPromptScreen,
} from "./telegramScreens.js";

// The Telegram bot: a menu for browsing UniSwap and seeing your own things, in a chat linked to
// your account from Settings. Who the student is always comes from the chat (findChatUser), on
// every message and button press, never from an id inside a button.
//
// Tapping a button changes that same message (utils/telegramScreens.js builds each screen), so the
// chat does not fill up. Notifications are sent separately, by utils/notify.js.

/** The commands under Telegram's "Menu" button. */
export const BOT_COMMANDS = [
  { command: "menu", description: "Show the menu" },
  { command: "search", description: "Search the listings, e.g. /search lamp" },
  { command: "new", description: "The newest items" },
  { command: "saved", description: "Your saved items" },
  { command: "mylistings", description: "Your listings and their offers" },
  { command: "inbox", description: "Your unread messages" },
  { command: "help", description: "What this bot can do" },
];

/** Which screen each command opens. "/start" without a code shows the menu too. */
const COMMAND_SCREENS = {
  menu: "menu", start: "menu", search: "search", new: "newest", saved: "saved", mylistings: "mine", inbox: "inbox", help: "help",
};

/** The real Bot API. The tests pass a fake instead, so they never call Telegram. */
const liveTelegram = {
  sendMessage: sendTelegramMessage,
  sendPhoto: sendTelegramPhoto,
  editMessage: editTelegramMessage,
  editButtons: editTelegramButtons,
  deleteMessage: deleteTelegramMessage,
  answerButton: answerTelegramButton,
  setCommands: setTelegramCommands,
};

/**
 * Where "Open on UniSwap" and "Open inbox" link to, or null while the website runs on localhost.
 * Asked each time: a tunnel's address changes while the API runs (services/tunnel.js).
 */
const siteUrl = () => publicSiteUrl(siteOrigin());
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SEARCH_LENGTH = 100;

/**
 * The list each chat saw last, for "More ▸" and "⬅ Back": { kind: "search", term, page }, or
 * { kind: "newest" | "saved" | "mine" }. Kept in memory only, so it is forgotten when the API restarts.
 */
const lastLists = new Map();

/** Handles one update from Telegram polling: a message or a button press. It never throws. */
export async function handleBotUpdate(update, telegram = liveTelegram) {
  try {
    if (update.message) await onMessage(update.message, telegram);
    else if (update.callback_query) await onButton(update.callback_query, telegram);
  } catch (error) {
    console.error("[telegram] bot error:", error.message);
  }
}

/** Sets the commands under Telegram's "Menu" button, at start-up. A failure is only logged. */
export async function setUpBotCommands(telegram = liveTelegram) {
  try {
    await telegram.setCommands(BOT_COMMANDS);
    console.log("[telegram] bot menu commands set");
  } catch (error) {
    console.error("[telegram] could not set the bot's menu commands:", error.message);
  }
}

async function onMessage(message, telegram) {
  // Only one-to-one chats: in a group, everyone in it would see one student's saved items and inbox.
  if (message.chat.type !== "private") return;
  const chat = { id: String(message.chat.id), telegram };
  const text = message.text?.trim() ?? "";
  // "/search lamp" -> ["search", "lamp"]. In some apps a command ends in "@<bot name>".
  const [, command, argument = ""] = /^\/(\w+)(?:@\w+)?\s*(.*)$/s.exec(text) ?? [];

  // "/start <code>" comes from the link in Settings, so it works before the chat is linked.
  if (command === "start" && argument) return linkAndGreet(chat, argument);
  const user = await findChatUser(chat.id);
  if (!user) return show(chat, notLinkedScreen());
  chat.user = user;

  if (command === "search" && argument) return show(chat, await searchScreen(chat, argument, 1));
  if (command) return show(chat, await screenFor(chat, COMMAND_SCREENS[command] ?? "menu"));
  // Any other text is a search. A photo or sticker gets the menu.
  if (text) return show(chat, await searchScreen(chat, text, 1));
  return show(chat, menuScreen());
}

/** Links the chat to the account whose one-time code this is, then shows the menu. */
async function linkAndGreet(chat, code) {
  const name = /^\w+$/.test(code) ? await linkChat(code, chat.id) : null;
  if (!name) return show(chat, { text: `That link has expired. ${NOT_LINKED_TEXT}`, buttons: [] });
  return show(chat, menuScreen(`Connected as ${name}. UniSwap notifications will now arrive here too.\n\n`));
}

async function onButton(press, telegram) {
  let notice; // a short pop-up text, e.g. "Saved ❤️"
  try {
    const { message } = press;
    if (message?.chat.type !== "private") return;
    // `old` is the message whose button was tapped: the next screen replaces it.
    const chat = { id: String(message.chat.id), telegram, old: { id: message.message_id, isPhoto: Boolean(message.photo) } };
    chat.user = await findChatUser(chat.id);
    if (!chat.user) return await show(chat, notLinkedScreen());
    notice = await pressButton(chat, press.data ?? "");
  } finally {
    // Always answered, even after an error, so the button stops spinning.
    await telegram.answerButton(press.id, notice).catch(() => {});
  }
}

/** Does what a button's data asks: "item:<id>", "save:<id>", "unsave:<id>", "page:<n>", "back", or a screen. */
async function pressButton(chat, data) {
  const [action, value = ""] = data.split(":");
  if (action === "item") return showItem(chat, value);
  if (action === "save" || action === "unsave") return toggleSave(chat, action, value);
  const last = lastLists.get(chat.id);
  if (action === "page") {
    const page = Number(value);
    if (last?.kind !== "search" || !Number.isInteger(page) || page < 1) return show(chat, expiredSearchScreen());
    return show(chat, await searchScreen(chat, last.term, page));
  }
  if (action === "back") {
    if (!last) return show(chat, menuScreen("That list has expired.\n\n"));
    return show(chat, last.kind === "search" ? await searchScreen(chat, last.term, last.page) : await screenFor(chat, last.kind));
  }
  return show(chat, await screenFor(chat, action));
}

async function searchScreen(chat, text, page) {
  const term = Array.from(text).slice(0, MAX_SEARCH_LENGTH).join("").trim();
  lastLists.set(chat.id, { kind: "search", term, page });
  return resultsScreen(term, page, await searchListings(term, page));
}

/** The screen a menu button or command opens. An unknown name shows the menu. */
async function screenFor(chat, name) {
  if (name === "search") return searchPromptScreen();
  if (name === "inbox") return inboxScreen(await unreadConversations(chat.user.id), siteUrl());
  if (name === "help") return helpScreen();
  if (name === "newest" || name === "saved" || name === "mine") {
    lastLists.set(chat.id, { kind: name });
    if (name === "newest") return newestScreen(await newestListings());
    if (name === "saved") return savedScreen(await savedListings(chat.user.id));
    return myListingsScreen(await myListings(chat.user.id));
  }
  return menuScreen();
}

/** What an item card needs besides the listing: "⬅ Back" returns to the chat's last list. */
function cardOptions(chat, { isSaved, isOwn }) {
  return { isSaved, isOwn, backTo: lastLists.get(chat.id)?.kind ?? null, siteUrl: siteUrl() };
}

async function showItem(chat, listingId) {
  const listing = UUID.test(listingId) ? await findListingById(listingId) : null;
  if (!listing) return show(chat, goneScreen());
  const isOwn = listing.user_id === chat.user.id;
  const saved = !isOwn && await isSaved(chat.user.id, listing.id);
  return show(chat, itemScreen(listing, cardOptions(chat, { isSaved: saved, isOwn })));
}

/** Save or Unsave on an item card: changes saved_listings, then only that card's buttons. */
async function toggleSave(chat, action, listingId) {
  if (!UUID.test(listingId)) return show(chat, goneScreen());
  if (action === "save") {
    const result = await saveListing(chat.user.id, listingId);
    if (result === "own") return "You can't save your own listing.";
    if (result === "not_found") return show(chat, goneScreen());
  } else {
    await unsaveListing(chat.user.id, listingId);
  }
  const buttons = itemButtons(listingId, cardOptions(chat, { isSaved: action === "save", isOwn: false }));
  // The change is already saved, so a card that can no longer be edited (too old, say) is fine.
  await chat.telegram.editButtons(chat.id, chat.old.id, buttons).catch(() => {});
  return action === "save" ? "Saved ❤️" : "Removed from Saved";
}

/**
 * Shows a screen. After a button press, a text message is changed in place. A photo cannot become
 * text, nor text a photo, so then the new screen is sent below and the old message is deleted.
 */
async function show(chat, screen) {
  const { telegram, old } = chat;
  if (old && !old.isPhoto && !screen.photoUrl) {
    try {
      await telegram.editMessage(chat.id, old.id, screen.text, screen.buttons);
      return;
    } catch (error) {
      // Tapping the same button twice changes nothing, and Telegram says so: nothing to do.
      if (error.message.includes("message is not modified")) return;
      // Any other failure (the message is too old to edit, say): send the screen as a new message.
    }
  }
  await send(chat, screen);
  if (old) await telegram.deleteMessage(chat.id, old.id).catch(() => {});
}

async function send({ id, telegram }, screen) {
  if (screen.photoUrl) {
    try {
      return await telegram.sendPhoto(id, screen.photoUrl, screen.text, screen.buttons);
    } catch (error) {
      // Telegram could not fetch the photo: the card still arrives, as text.
      console.error("[telegram] could not send a photo:", error.message);
    }
  }
  return telegram.sendMessage(id, screen.text, screen.buttons);
}
