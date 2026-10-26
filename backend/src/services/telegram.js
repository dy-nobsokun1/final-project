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

export function sendTelegramMessage(chatId, text) {
  return telegram("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

/**
 * Long polling: asks Telegram for new messages to the bot, waiting up to 25 seconds each time,
 * and passes each one to `onMessage`. Works locally and on Render without a public webhook URL.
 */
export async function startTelegramPolling(onMessage) {
  let offset = 0;
  for (;;) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) await onMessage(update.message);
      }
    } catch (error) {
      console.error("[telegram] polling error:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
