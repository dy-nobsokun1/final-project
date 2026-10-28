import assert from "node:assert/strict";
import { test } from "node:test";
import { relatedSearch } from "../src/db/relatedWords.js";

const GPU_WORDS = 'gpu or "graphics card" or "video card" or nvidia or geforce or radeon or rtx or gtx';

test("a general word brings in its group: 'book' finds the textbooks", () => {
  assert.equal(relatedSearch("book"), "textbook");
  assert.equal(relatedSearch("Books"), "textbook");
});

test("any word of a group brings in the whole group, whatever its case", () => {
  assert.equal(relatedSearch("GPU"), GPU_WORDS);
  assert.equal(relatedSearch("cheap nvidia card"), GPU_WORDS);
  assert.equal(relatedSearch("memory"), "ram or memory or ddr4 or ddr5");
});

test("a phrase counts only as whole words side by side, and a plural 's' is ignored", () => {
  assert.equal(relatedSearch("graphics card"), GPU_WORDS);
  assert.equal(relatedSearch("Graphics Cards"), GPU_WORDS);
  assert.equal(relatedSearch("card graphics"), null);
});

test("a word inside another word does not count: 'program' is not 'ram'", () => {
  assert.equal(relatedSearch("program"), null);
  assert.equal(relatedSearch("textbooks"), "textbook");
});

test("an unrelated word, or no words, brings in nothing", () => {
  assert.equal(relatedSearch("lamp"), null);
  assert.equal(relatedSearch("  "), null);
});

test("a broad word brings in its group, but the group's words do not bring it in", () => {
  assert.equal(relatedSearch("laptop"), "macbook or chromebook or thinkpad");
  assert.equal(relatedSearch("macbook"), "macbook or chromebook or thinkpad");
});

test("a term can bring in more than one group", () => {
  assert.equal(relatedSearch("laptop ram"), "ram or memory or ddr4 or ddr5 or macbook or chromebook or thinkpad");
});
