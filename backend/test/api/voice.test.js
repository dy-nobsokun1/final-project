import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startApi } from "./helpers.js";

// Groq's speech-to-text is replaced. The fake answers with the clip's size, so the test can see the
// bytes arrived, and keeps each request's form. All other requests go through as normal.
const realFetch = globalThis.fetch;
const groq = { forms: [], status: 200 };
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://api.groq.com/")) return realFetch(url, options);
  groq.forms.push(options.body);
  if (groq.status !== 200) return Response.json({ error: { message: "nope" } }, { status: groq.status });
  return Response.json({ text: " desk lamp under ten dollars " });
};

const api = await startApi({ env: { GROQ_API_KEY: "test-key" } });
after(() => api.close());
const { config } = await import("../../src/config.js");

const send = (token, type, bytes = Buffer.from("fake audio")) =>
  fetch(`${api.baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: bytes,
  }).then(async (response) => ({ status: response.status, body: await response.json() }));

test("needs a login and refuses other types", async () => {
  const student = await api.createUser();
  assert.equal((await send(null, "audio/webm")).status, 401);
  assert.equal((await send(student.token, "image/png")).status, 415);
  assert.equal(groq.forms.length, 0);
});

test("sends the clip to Whisper and returns the text", async () => {
  const student = await api.createUser();
  const result = await send(student.token, "audio/webm;codecs=opus");
  assert.deepEqual(result, { status: 200, body: { text: "desk lamp under ten dollars" } });
  const form = groq.forms.at(-1);
  assert.equal(form.get("model"), "whisper-large-v3-turbo");
  assert.equal(form.get("language"), "en");
  assert.equal(form.get("file").name, "voice.webm");
});

test("answers 503 while off or busy, and 502 when Groq fails", async () => {
  const student = await api.createUser();
  groq.status = 429;
  assert.deepEqual(await send(student.token, "audio/ogg"), { status: 503, body: { error: "Voice input is busy. Try again in a minute." } });
  groq.status = 500;
  assert.equal((await send(student.token, "audio/ogg")).status, 502);
  groq.status = 200;

  const key = config.groq.apiKey;
  config.groq.apiKey = undefined;
  assert.deepEqual(await send(student.token, "audio/ogg"), { status: 503, body: { error: "Voice input is off." } });
  config.groq.apiKey = key;
});
