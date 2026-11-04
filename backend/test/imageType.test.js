import assert from "node:assert/strict";
import { test } from "node:test";
import { hasImageSignature } from "../src/utils/imageType.js";

const bytes = (...values) => Buffer.from(values);
const text = (value) => Buffer.from(value, "latin1");

test("real image bytes match their type", () => {
  assert.equal(hasImageSignature(bytes(0xff, 0xd8, 0xff, 0xe0, 0), "image/jpeg"), true);
  assert.equal(hasImageSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0), "image/png"), true);
  assert.equal(hasImageSignature(text("RIFF\x10\x00\x00\x00WEBPVP8 "), "image/webp"), true);
  assert.equal(hasImageSignature(text("GIF87a..."), "image/gif"), true);
  assert.equal(hasImageSignature(text("GIF89a..."), "image/gif"), true);
});

test("other bytes, a wrong type, short files and unknown types are refused", () => {
  assert.equal(hasImageSignature(text("%PDF-1.7"), "image/jpeg"), false);
  assert.equal(hasImageSignature(text("<script>alert(1)</script>"), "image/png"), false);
  // A real PNG claimed as JPEG does not pass: the header must tell the truth.
  assert.equal(hasImageSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/jpeg"), false);
  assert.equal(hasImageSignature(text("RIFF\x10\x00\x00\x00WAVEfmt "), "image/webp"), false);
  assert.equal(hasImageSignature(text("RIFF"), "image/webp"), false);
  assert.equal(hasImageSignature(bytes(0xff, 0xd8), "image/jpeg"), false);
  assert.equal(hasImageSignature(bytes(0xff, 0xd8, 0xff), "image/avif"), false);
  assert.equal(hasImageSignature("not a buffer", "image/jpeg"), false);
});
