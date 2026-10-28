import { config } from "../config.js";

// Google's Gemini API, called with fetch (no extra package). Get a free key at
// https://aistudio.google.com/apikey. One of the shopping assistant's two models (services/assistantModel.js).
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
async function generateContent(request) {
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
    const message = result.error?.message ?? String(response.status);
    const error = new Error(`Gemini failed: ${message}`);
    error.status = response.status;
    // A 429 says which free-tier limit was hit: requests per minute, or per day (reset at midnight Pacific time).
    error.dailyLimit = response.status === 429 && /per day/i.test(message);
    throw error;
  }
  // No candidate means Gemini refused to answer (for example, a question its safety filter blocked).
  return result.candidates?.[0]?.content ?? { role: "model", parts: [] };
}

/** Our conversation (see askAssistant in utils/assistant.js) in Gemini's format: user and model turns. */
function toContents(turns) {
  return turns.map((turn) => {
    // Gemini 3 signs its tool calls (thoughtSignature), so its own turn goes back exactly as it came.
    if (turn.calls) return turn.raw;
    if (turn.results) {
      return { role: "user", parts: turn.results.map(({ id, name, response }) => ({ functionResponse: { id, name, response } })) };
    }
    return { role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.text }] };
  });
}

/**
 * One round of the shopping assistant (utils/assistant.js) on Gemini.
 * Returns { text, calls: [{ id, name, args }], raw }, where raw is Gemini's own turn, to send back later.
 */
export async function askGemini({ system, tools, turns, onlyReply }) {
  const content = await generateContent({
    systemInstruction: { parts: [{ text: system }] },
    contents: toContents(turns),
    tools: [{ functionDeclarations: tools }],
    // ANY: Gemini must always call a tool, so every answer arrives through reply. On the last round
    // reply is the only tool allowed, so the student always gets an answer.
    toolConfig: { functionCallingConfig: onlyReply ? { mode: "ANY", allowedFunctionNames: ["reply"] } : { mode: "ANY" } },
    // Choosing listings needs little reasoning, and low thinking answers faster.
    generationConfig: { thinkingConfig: { thinkingLevel: "low" } },
  });
  const parts = content.parts ?? [];
  return {
    // Thought parts are Gemini thinking aloud, not part of its answer.
    text: parts.filter((part) => !part.thought).map((part) => part.text ?? "").join(""),
    calls: parts.filter((part) => part.functionCall)
      .map(({ functionCall }) => ({ id: functionCall.id, name: functionCall.name, args: functionCall.args ?? {} })),
    raw: content,
  };
}
