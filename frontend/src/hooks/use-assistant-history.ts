import { useSyncExternalStore } from "react";
import type { AssistantMessage } from "@/types";

/** The chat shows and keeps at most this many messages, the most the API takes too. */
const MAX_HISTORY = 20;
const KEY_PREFIX = "uniswap-assistant:";

// This tab's copy of each saved chat, by storage key. The page reads this copy, so the chat still
// works when sessionStorage cannot be used (private mode, full or blocked); it then lasts until a reload.
const chats = new Map<string, AssistantMessage[]>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Checks one stored message, so old or broken data is ignored instead of breaking the page. */
function isMessage(value: unknown): value is AssistantMessage {
  if (typeof value !== "object" || value === null) return false;
  const { role, text, answer } = value as Record<string, unknown>;
  if (typeof text !== "string") return false;
  if (role === "user") return answer === undefined;
  if (role !== "assistant" || typeof answer !== "object" || answer === null) return false;
  const { reply, listings, wantedDraft } = answer as Record<string, unknown>;
  // typeof null is "object" too, so this also accepts an answer without a draft.
  return typeof reply === "string" && Array.isArray(listings) && typeof wantedDraft === "object";
}

function readSaved(key: string): AssistantMessage[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) && saved.every(isMessage) ? saved.slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function getChat(key: string): AssistantMessage[] {
  let chat = chats.get(key);
  if (!chat) {
    chat = readSaved(key);
    chats.set(key, chat);
  }
  return chat;
}

function saveChat(key: string, messages: AssistantMessage[]) {
  const chat = messages.slice(-MAX_HISTORY);
  chats.set(key, chat);
  try {
    if (chat.length > 0) sessionStorage.setItem(key, JSON.stringify(chat));
    else sessionStorage.removeItem(key);
  } catch {
    // Storage is blocked or full: the copy above keeps the chat until a reload.
  }
  notify();
}

/**
 * The signed-in student's Ask UniSwap chat, saved in sessionStorage: it survives leaving the page
 * and reloading, and is gone when the tab closes. Each account has its own key, so another student
 * signing in on this tab starts with an empty chat.
 *
 * The messages are null until the browser has read them. The server cannot see sessionStorage, so
 * the page shows nothing there at first instead of flashing the starter questions; on a move from
 * another page they are read straight away.
 */
export function useAssistantHistory(userId: string) {
  const key = KEY_PREFIX + userId;
  const messages = useSyncExternalStore(subscribe, () => getChat(key), () => null);
  const saveMessages = (next: AssistantMessage[]) => saveChat(key, next);
  return [messages, saveMessages] as const;
}

/** Forgets every saved chat in this tab. Signing out calls it, so a shared computer keeps none. */
export function clearAssistantHistory() {
  chats.clear();
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage cannot be used, so nothing was saved there.
  }
  notify();
}
