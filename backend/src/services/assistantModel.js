import { config } from "../config.js";
import { askGemini, isGeminiConfigured } from "./gemini.js";
import { askGroq, isGroqConfigured } from "./groq.js";

// Which model answers the shopping assistant ("Ask UniSwap"). Both are free tiers: Groq allows about
// 1,000 requests a day, Gemini only about 20, so Groq comes first. ASSISTANT_PROVIDER=gemini (or groq)
// picks one by name instead, for example to fall back to Gemini if Groq has trouble.
const PROVIDERS = {
  groq: { name: "Groq", isConfigured: isGroqConfigured, ask: askGroq },
  gemini: { name: "Gemini", isConfigured: isGeminiConfigured, ask: askGemini },
};

function chooseProvider() {
  const { provider } = config.assistant;
  // A provider picked by name is used only if its key is set; anything else switches the assistant off.
  if (provider) return PROVIDERS[provider]?.isConfigured ? PROVIDERS[provider] : null;
  return [PROVIDERS.groq, PROVIDERS.gemini].find((option) => option.isConfigured) ?? null;
}

/** { name, ask } of the model in use, or null when the assistant is switched off. */
export const assistantModel = chooseProvider();
