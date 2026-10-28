import { config } from "../config.js";

// Telegram Bot API, called with fetch (no extra package). Create a bot with @BotFather to get a token.

const { botToken, botUsername } = config.telegram;

export const isTelegramConfigured = Boolean(botToken && botUsername);

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram ${method} failed: ${result.description ?? response.status}`);
  return result.result;
}

/** The link that opens a chat with our bot. The bot's username is public, so anyone may see it. */
export function botChatLink() {
  return `https://t.me/${botUsername}`;
}

/** The link that opens a chat with our bot and sends "/start <code>" when the user presses Start. */
export function botStartLink(code) {
  return `https://t.me/${botUsername}?start=${code}`;
}

/**
 * Buttons under a message: rows of { text, callback_data } (sent back to the bot when tapped) or
 * { text, url } (opens a link). No buttons means none are shown, also when editing a message.
 */
function withButtons(buttons) {
  return buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {};
}

/** Sends plain text or HTML. `buttons` is optional: notifications (utils/notify.js) have none. */
export function sendTelegramMessage(chatId, text, buttons, options = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
    ...withButtons(buttons),
  });
}

/** Sends a photo from a public https URL (Telegram downloads it itself), with the text as its caption. */
export function sendTelegramPhoto(chatId, photoUrl, caption, buttons) {
  return telegram("sendPhoto", { chat_id: chatId, photo: photoUrl, caption, ...withButtons(buttons) });
}

/**
 * Sends a file/document to a Telegram chat.
 * `document`: { filename, content, contentType, caption, buttons }
 */
export async function sendTelegramDocument(chatId, { filename, content, contentType = "text/html", caption, buttons }) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", new Blob([content], { type: contentType }), filename);
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  if (buttons?.length) {
    form.append("reply_markup", JSON.stringify({ inline_keyboard: buttons }));
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram sendDocument failed: ${result.description ?? response.status}`);
  return result.result;
}

/** Changes a text message's text and buttons. A photo message cannot be changed into text. */
export function editTelegramMessage(chatId, messageId, text, buttons) {
  return telegram("editMessageText", {
    chat_id: chatId, message_id: messageId, text, disable_web_page_preview: true, ...withButtons(buttons),
  });
}

/** Changes only a message's buttons (also under a photo). */
export function editTelegramButtons(chatId, messageId, buttons) {
  return telegram("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, ...withButtons(buttons) });
}

export function deleteTelegramMessage(chatId, messageId) {
  return telegram("deleteMessage", { chat_id: chatId, message_id: messageId });
}

/** Stops a tapped button's loading spinner, optionally with a short pop-up text. */
export function answerTelegramButton(callbackQueryId, text) {
  return telegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

/** The commands listed under Telegram's "Menu" button in the bot's chat. */
export function setTelegramCommands(commands) {
  return telegram("setMyCommands", { commands });
}

/**
 * Long polling: asks Telegram for new messages and button presses for the bot, waiting up to 25
 * seconds each time, and passes each update to `onUpdate`. Works locally and on Render without a
 * public webhook URL.
 */
export async function startTelegramPolling(onUpdate) {
  let offset = 0;
  for (;;) {
    try {
      const updates = await telegram("getUpdates", {
        offset, timeout: 25, allowed_updates: ["message", "callback_query"],
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        await onUpdate(update);
      }
    } catch (error) {
      console.error("[telegram] polling error:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
