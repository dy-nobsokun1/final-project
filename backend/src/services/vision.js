import { config } from "../config.js";

// The vision model behind "Fill in from photo" (routes/assistant.js), called with fetch like
// services/groq.js and gemini.js. Only the photo and the instructions are sent: never a name, an
// email or any listing. Nothing is stored or logged here.
//
// Gemini by default (see config.vision): its free limits count per Google project and per model, so
// gemini-3.1-flash-lite has its own, apart from the assistant's model. Google does not publish the
// free numbers (https://aistudio.google.com/rate-limit). Groq is only used when VISION_PROVIDER=groq,
// because its only vision model is the assistant's own qwen, which would share the assistant's quota.

// A photo normally takes 1 to 3 seconds. Give up after this, so the form never waits for long.
const TIMEOUT_MS = 20 * 1000;
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
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
    signal: AbortSignal.timeout(TIMEOUT_MS),
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

export const isVisionConfigured = () => chosenProvider() !== null;

/**
 * Sends one photo with the instructions and returns the model's text (JSON, still to be checked).
 * Throws on failure: `status` is the provider's HTTP status, or a TimeoutError after TIMEOUT_MS.
 */
export async function describePhoto({ instructions, schema, image, mimeType }) {
  const provider = chosenProvider();
  if (!provider) throw Object.assign(new Error("No vision provider is configured."), { status: 503 });
  return provider.ask({ instructions, schema, image, mimeType });
}
