import { config } from "../config.js";

// Groq's chat API (OpenAI-compatible), called with fetch (no extra package). Get a free key, no card,
// at https://console.groq.com/keys. One of the shopping assistant's two models (services/assistantModel.js).
// Like with Gemini, the assistant only sends the student's question and listing details, never names or emails.

const { apiKey, model } = config.groq;

export const isGroqConfigured = Boolean(apiKey);

// A reply normally takes a second or two. Give up after this, so a stuck request does not hang the page.
const TIMEOUT_MS = 30 * 1000;

/** Our conversation (see askAssistant in utils/assistant.js) in Groq's format: OpenAI-style messages. */
function toMessages(turns) {
  return turns.flatMap((turn) => {
    if (turn.calls) {
      return [{
        role: "assistant",
        tool_calls: turn.calls.map((call) => ({
          id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
        })),
      }];
    }
    // One "tool" message per result, linked to its call by id.
    if (turn.results) {
      return turn.results.map((result) => ({ role: "tool", tool_call_id: result.id, content: JSON.stringify(result.response) }));
    }
    return [{ role: turn.role, content: turn.text }];
  });
}

/** Tool arguments arrive as a JSON string. A broken one counts as no arguments. */
function parseArgs(text) {
  try {
    const args = JSON.parse(text);
    return args && typeof args === "object" ? args : {};
  } catch {
    return {};
  }
}

/**
 * One round of the shopping assistant (utils/assistant.js) on Groq.
 * Returns { text, calls: [{ id, name, args }] }. Throws on failure; the error's `status` is Groq's
 * HTTP status (429 = too many requests) and `dailyLimit` says whether the day's limit is used up.
 */
export async function askGroq({ system, tools, turns, onlyReply }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...toMessages(turns)],
      tools: tools.map((tool) => ({ type: "function", function: tool })),
      // "required": the model must always call a tool, so every answer arrives through reply. On the
      // last round it must call reply itself, so the student always gets an answer.
      tool_choice: onlyReply ? { type: "function", function: { name: "reply" } } : "required",
      max_completion_tokens: 1024,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error?.message ?? String(response.status);
    const error = new Error(`Groq failed: ${message}`);
    error.status = response.status;
    // A 429 says which free limit was hit, e.g. "requests per minute (RPM)" or "tokens per day (TPD)".
    error.dailyLimit = response.status === 429 && /per day/i.test(message);
    throw error;
  }
  const message = result.choices?.[0]?.message ?? {};
  return {
    text: message.content ?? "",
    calls: (message.tool_calls ?? []).map((call) => ({
      id: call.id, name: call.function?.name, args: parseArgs(call.function?.arguments),
    })),
  };
}
