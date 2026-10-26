import { config } from "../config.js";

// Google's Gemini API, called with fetch (no extra package). Get a free key at
// https://aistudio.google.com/apikey. Used by the shopping assistant (utils/assistant.js).
// On the free tier Google may read what is sent to improve its products, so the assistant only
// sends the student's question and listing details, never names, emails or other personal data.

const { apiKey, model } = config.gemini;

export const isGeminiConfigured = Boolean(apiKey);

// A reply normally takes a few seconds. Give up after this, so a stuck request does not hang the page.
const TIMEOUT_MS = 30 * 1000;

/**
 * One generateContent call. `request` is Gemini's request body ({ systemInstruction, contents, tools, ... }).
 * Returns the model's answer, { role: "model", parts }: each part holds text, or a
 * functionCall { name, args } when Gemini wants one of our tools run.
 * Throws on failure; the error's `status` is Gemini's HTTP status (429 = too many requests).
 */
export async function generateContent(request) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Gemini failed: ${result.error?.message ?? response.status}`);
    error.status = response.status;
    throw error;
  }
  // No candidate means Gemini refused to answer (for example, a question its safety filter blocked).
  return result.candidates?.[0]?.content ?? { role: "model", parts: [] };
}
