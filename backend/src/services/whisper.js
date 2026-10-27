import { config } from "../config.js";

// Groq's speech-to-text (Whisper), called with fetch like services/groq.js. It uses the same free
// GROQ_API_KEY. Only the audio is sent, never names or emails, and nothing is stored here.

const URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";
const TIMEOUT_MS = 30 * 1000;

/** The file extension Groq needs to recognise each audio type. */
export const AUDIO_EXTENSIONS = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Read at call time, so tests can switch voice input on and off. */
export const isWhisperConfigured = () => Boolean(config.groq.apiKey);

/**
 * Turns one clip into text. `type` is one of AUDIO_EXTENSIONS' keys.
 * Throws an error with Groq's HTTP `status` on failure (429 = its free limit is used up).
 */
export async function transcribe(audio, type) {
  const form = new FormData();
  form.append("file", new Blob([audio], { type }), `voice.${AUDIO_EXTENSIONS[type]}`);
  form.append("model", MODEL);
  form.append("language", "en");
  form.append("response_format", "json");
  form.append("temperature", "0");

  const response = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.groq.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const error = new Error(`Groq transcription failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const { text } = await response.json();
  return String(text ?? "").trim();
}
