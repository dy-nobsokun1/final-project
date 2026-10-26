import { Router } from "express";
import { buildBrowseQuery } from "../db/listings.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { assistantModel } from "../services/assistantModel.js";
import { askAssistant, validateAssistantMessages } from "../utils/assistant.js";
import { HttpError } from "../utils/httpError.js";
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
