import express, { Router } from "express";
import { buildBrowseQuery } from "../db/listings.js";
import { query } from "../db/pool.js";
import { findPriceHint } from "../db/priceHints.js";
import { requireAuth } from "../middleware/auth.js";
import { assistantModel } from "../services/assistantModel.js";
import { describePhoto, isVisionConfigured } from "../services/vision.js";
import { askAssistant, validateAssistantMessages } from "../utils/assistant.js";
import { HttpError } from "../utils/httpError.js";
import { createRateLimiter, DRAFT_INSTRUCTIONS, DRAFT_SCHEMA, toListingDraft } from "../utils/listingDraft.js";
import { toListing } from "../utils/serializers.js";

export const assistantRouter = Router();

/** The assistant's search tool: the same search as GET /api/listings. */
async function searchListings(filters) {
  const { text, params } = buildBrowseQuery(filters);
  const { rows } = await query(text, params);
  return rows.map(toListing);
}

// GET /api/assistant/config -> { enabled }: whether the assistant is switched on (GROQ_API_KEY or GEMINI_API_KEY set)
assistantRouter.get("/config", (req, res) => {
  res.json({ enabled: Boolean(assistantModel) });
});

// POST /api/assistant  (logged in)  { messages: [{ role: "user" | "assistant", text }] }
// -> { reply, listings, wantedDraft }. The frontend keeps the conversation and sends it with every
// question, so nothing about it is stored here.
assistantRouter.post("/", requireAuth, async (req, res) => {
  if (!assistantModel) throw new HttpError(503, "The shopping assistant is switched off.");
  const problem = validateAssistantMessages(req.body?.messages);
  if (problem) throw new HttpError(400, problem);

  try {
    res.json(await askAssistant(req.body.messages, { ask: assistantModel.ask, searchListings }));
  } catch (error) {
    // 429: the free tier's requests per minute or per day are used up.
    if (error.status === 429) {
      throw new HttpError(429, error.dailyLimit
        ? "The assistant has answered all the questions it can for today. Please try again tomorrow."
        : "The assistant is busy right now. Please try again in a minute.");
    }
    console.error("[assistant]", error.message);
    throw new HttpError(502, "The assistant is not available right now. Please try again later.");
  }
});

// "Fill in from photo" on the sell form. The browser shrinks the photo to about 1,024 px (about
// 200 KB) first, so 2 MB is plenty. The photo is never saved, and the model's answer is never logged.
const MAX_PHOTO_SIZE = "2mb";
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Each student may ask 10 times an hour, to protect the free tier for everyone.
const draftLimit = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

// GET /api/assistant/listing-draft -> { enabled }: whether the sell form shows "Fill in from photo".
assistantRouter.get("/listing-draft", (req, res) => {
  res.json({ enabled: isVisionConfigured() });
});

// POST /api/assistant/listing-draft  (logged in)  body: raw image bytes, Content-Type image/jpeg, png or webp
// -> { draft: { title, category, condition, description }, priceHint: { low, high, count, sold } | null }.
// A draft field is "" when the model left it out or gave a value we do not allow. The price hint
// comes from UniSwap's own similar listings (db/priceHints.js), never from the model.
assistantRouter.post(
  "/listing-draft",
  requireAuth,
  express.raw({ type: PHOTO_TYPES, limit: MAX_PHOTO_SIZE }),
  async (req, res) => {
    const type = req.get("content-type")?.split(";")[0].trim();
    if (!PHOTO_TYPES.includes(type)) throw new HttpError(415, "Send the photo as a JPEG, PNG or WebP.");
    if (!isVisionConfigured()) throw new HttpError(503, "Fill in from photo is switched off.");
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "No photo was sent.");
    const waitMs = draftLimit.take(req.userId);
    if (waitMs > 0) {
      const minutes = Math.ceil(waitMs / 60000);
      throw new HttpError(429, `You have used Fill in from photo 10 times this hour. Try again in ${minutes} min, or fill in the form yourself.`);
    }

    let text;
    try {
      // Only the photo and the instructions go to the model: never a name, an email or a listing.
      text = await describePhoto({ instructions: DRAFT_INSTRUCTIONS, schema: DRAFT_SCHEMA, image: req.body, mimeType: type });
    } catch (error) {
      if (error.status === 429) throw new HttpError(503, "Fill in from photo is busy right now. Try again in a minute, or fill in the form yourself.");
      console.error("[listing-draft]", error.name === "TimeoutError" ? "timed out" : error.message);
      throw new HttpError(502, "Could not read the photo right now. Please fill in the form yourself.");
    }
    const draft = toListingDraft(text);
    if (!draft) throw new HttpError(502, "Could not make sense of that photo. Try a clearer photo, or fill in the form yourself.");
    const priceHint = draft.title && draft.category ? await findPriceHint(draft) : null;
    res.json({ draft, priceHint });
  },
);
