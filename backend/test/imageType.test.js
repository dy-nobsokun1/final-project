import assert from "node:assert/strict";
import { test } from "node:test";
import { detectImageType } from "../src/utils/imageType.js";

const bytes = (...values) => Buffer.from(values);
const text = (value) => Buffer.from(value, "latin1");

test("the real image type comes from the first bytes", () => {
  assert.equal(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0)), "image/jpeg");
  assert.equal(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), "image/png");
  assert.equal(detectImageType(text("RIFF\x10\x00\x00\x00WEBPVP8 ")), "image/webp");
  assert.equal(detectImageType(text("GIF87a...")), "image/gif");
  assert.equal(detectImageType(text("GIF89a...")), "image/gif");
});

test("other files, short files and non-buffers are not images", () => {
  assert.equal(detectImageType(text("%PDF-1.7")), null);
  assert.equal(detectImageType(text("<script>alert(1)</script>")), null);
  assert.equal(detectImageType(text("RIFF\x10\x00\x00\x00WAVEfmt ")), null);
  assert.equal(detectImageType(text("RIFF")), null);
  assert.equal(detectImageType(bytes(0xff, 0xd8)), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
  assert.equal(detectImageType("not a buffer"), null);
});
