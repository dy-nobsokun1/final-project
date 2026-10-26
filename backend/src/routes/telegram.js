import { randomBytes } from "node:crypto";
import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { botChatLink, botStartLink, isTelegramConfigured } from "../services/telegram.js";
import { HttpError } from "../utils/httpError.js";

// Mounted at /api/telegram, with no sign-in. GET -> { enabled, botUrl }: whether the bot is set up
// and the link to its chat (null when it is not), so the home page can tell everyone about Telegram
// alerts. It returns no user data.
export const telegramStatusRouter = Router();
telegramStatusRouter.get("/", (req, res) => {
  res.json({ enabled: isTelegramConfigured, botUrl: isTelegramConfigured ? botChatLink() : null });
});

// Mounted at /api/users/me/telegram. Linking works like this:
//  1. POST here returns a t.me link containing a one-time code.
//  2. The user opens it and presses Start, so Telegram sends our bot "/start <code>".
//  3. The bot (utils/telegramBot.js) finds the user with that code and saves their chat id.
export const telegramRouter = Router();
telegramRouter.use(requireAuth);

// GET -> { enabled, connected }
telegramRouter.get("/", async (req, res) => {
  const { rows } = await query("SELECT telegram_chat_id FROM users WHERE id = $1", [req.userId]);
  res.json({ enabled: isTelegramConfigured, connected: Boolean(rows[0]?.telegram_chat_id) });
});

// POST -> { link }: a fresh one-time link; any older link stops working
telegramRouter.post("/", async (req, res) => {
  if (!isTelegramConfigured) throw new HttpError(503, "Telegram notifications are not set up yet.");
  const code = randomBytes(16).toString("hex");
  await query("UPDATE users SET telegram_link_code = $2 WHERE id = $1", [req.userId, code]);
  res.json({ link: botStartLink(code) });
});

// DELETE -> stop sending this account Telegram messages
telegramRouter.delete("/", async (req, res) => {
  await query("UPDATE users SET telegram_chat_id = NULL, telegram_link_code = NULL WHERE id = $1", [req.userId]);
  res.status(204).end();
});
