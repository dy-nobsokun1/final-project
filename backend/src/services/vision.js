import { config } from "../config.js";
import { createRateLimiter } from "../utils/listingDraft.js";

// The vision model behind "Fill in from photo" (routes/assistant.js), called with fetch like
// services/groq.js and gemini.js. Only the photo and the instructions are sent: never a name, an
// email or any listing. Nothing is stored or logged here.
//
// Gemini by default (see config.vision): its free limits count per Google project and per model, so
// gemini-3.1-flash-lite has its own, apart from the assistant's model. Google does not publish the
// free numbers (https://aistudio.google.com/rate-limit). On 4 Nov 2026 it often answered 503 "high
// demand", after up to 14 s. So when it is busy or slow, the photo goes once to Groq instead. Groq's
// only vision model is the assistant's own qwen, so that shares the assistant's quota: it is capped at
// VISION_FALLBACK_PER_DAY photos (20 by default, about 2,000 tokens each: 20% of the 200,000 a day).

// A good answer takes 1 to 4 seconds. Each provider gets this long, so both together stay under 20 s.
const TIMEOUT_MS = { gemini: 8 * 1000, groq: 10 * 1000 };
const MAX_TOKENS = 600;

/** Asks Gemini for JSON that follows `schema`. `image` is a Buffer. Returns the answer's text. */
async function askGemini({ instructions, schema, image, mimeType }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.vision.geminiModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.gemini.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{
          role: "user",
          parts: [{ inlineData: { mimeType, data: image.toString("base64") } }, { text: "Describe this item." }],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: MAX_TOKENS,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS.gemini),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError("Gemini", response.status, result);
  // Thought parts are Gemini thinking aloud, not part of its answer.
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((part) => !part.thought).map((part) => part.text ?? "").join("");
}

/** Asks Groq (OpenAI-style) for a JSON object. Groq's JSON mode takes no schema; the prompt describes it. */
async function askGroq({ instructions, image, mimeType }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.groq.apiKey}` },
    body: JSON.stringify({
      model: config.vision.groqModel,
      messages: [
        { role: "system", content: instructions },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${image.toString("base64")}` } },
            { type: "text", text: "Describe this item." },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: MAX_TOKENS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS.groq),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError("Groq", response.status, result);
  return result.choices?.[0]?.message?.content ?? "";
}

/** An error carrying the provider's HTTP `status` (429 = its free limit is used up). */
function providerError(name, status, result) {
  const error = new Error(`${name} vision failed: ${result.error?.message ?? status}`);
  error.status = status;
  return error;
}

const PROVIDERS = {
  gemini: { isConfigured: () => Boolean(config.gemini.apiKey), ask: askGemini },
  groq: { isConfigured: () => Boolean(config.groq.apiKey), ask: askGroq },
};

/** The provider in use, or null when "Fill in from photo" is off. Read at call time, so tests can switch it. */
function chosenProvider() {
  const provider = PROVIDERS[config.vision.provider];
  return provider?.isConfigured() ? provider : null;
}

/** The other provider, when the fallback is on and it has a key. */
function fallbackProvider(main) {
  if (!config.vision.fallback) return null;
  return Object.values(PROVIDERS).find((provider) => provider !== main && provider.isConfigured()) ?? null;
}

// Counts fallbacks for the whole app (one key), in the last 24 hours. Kept in memory, like the per-student limit.
const fallbacks = createRateLimiter({ limit: config.vision.fallbackPerDay, windowMs: 24 * 60 * 60 * 1000 });

/** Busy (429), down (5xx), timed out or unreachable: worth one try elsewhere. A 400 is our own mistake. */
const isBusy = (error) => error.status === 429 || error.status >= 500 || error.name === "TimeoutError" || error.name === "TypeError";

export const isVisionConfigured = () => chosenProvider() !== null;

/**
 * Sends one photo with the instructions and returns the model's text (JSON, still to be checked).
 * When the main provider is busy, tries the fallback once (see above).
 * Throws on failure: `status` is the provider's HTTP status, or a TimeoutError after TIMEOUT_MS.
 */
export async function describePhoto({ instructions, schema, image, mimeType }) {
  const main = chosenProvider();
  if (!main) throw Object.assign(new Error("No vision provider is configured."), { status: 503 });
  const request = { instructions, schema, image, mimeType };
  try {
    return await main.ask(request);
  } catch (error) {
    const fallback = fallbackProvider(main);
    if (!fallback || !isBusy(error) || fallbacks.take("all") > 0) throw error;
    return fallback.ask(request);
  }
}
