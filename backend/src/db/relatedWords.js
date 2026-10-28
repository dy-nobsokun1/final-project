// Groups of words that name the same kind of item, so a general word finds the specific items:
// "book" finds the textbooks, "gpu" the RTX and GTX cards, "memory" the RAM sticks.
// A search term containing any word or phrase of a group also searches for the group's `words`,
// with full-text only (see buildBrowseQuery in db/listings.js). Used by the browse search only
// (browse, the navbar suggestions and Ask UniSwap), never by wanted-post matching (db/matches.js),
// which sends alerts and so stays strict.
//
// `broad` words bring in the group but are never added for the other words. "laptop" finds the
// MacBook and the ThinkPad, but "macbook" does not bring in everything that mentions a laptop
// (laptop RAM, a backpack that fits one); "book" finds the textbooks, but "textbook" does not bring
// in a backpack "for books".
//
// Keep it tight: every word must find items a student would call the same thing. Never a word with
// other meanings, such as "card" (an SD card), "case", "pro" or "keyboard" (also a piano).
export const RELATED_WORD_GROUPS = [
  { broad: ["book"], words: ["textbook"] },
  { words: ["gpu", "graphics card", "video card", "nvidia", "geforce", "radeon", "rtx", "gtx"] },
  { words: ["ram", "memory", "ddr4", "ddr5"] },
  { broad: ["laptop"], words: ["macbook", "chromebook", "thinkpad"] },
  { words: ["phone", "smartphone"] },
  { words: ["tablet", "ipad"] },
  { words: ["headphones", "earphones", "earbuds", "airpods"] },
  { words: ["cpu", "processor"] },
  { words: ["ssd", "hdd", "hard drive", "nvme"] },
  { words: ["power supply", "psu"] },
  { words: ["bike", "bicycle"] },
  { words: ["shoes", "sneakers", "trainers"] },
  { words: ["fridge", "refrigerator"] },
  { words: ["desk", "table"] },
];

/** A word without a simple plural "s" ("books" -> "book", "gpus" -> "gpu"), but "ram" and "glass" stay. */
function singular(word) {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/** The lower-case whole words of a text, each made singular: "Graphics Cards!" -> ["graphic", "card"]. */
function wordsOf(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(singular);
}

/** Whether `phrase` (one or more words) appears in `termWords` as whole words, in order. */
function containsPhrase(termWords, phrase) {
  const phraseWords = wordsOf(phrase);
  return termWords.some((_, start) => phraseWords.every((word, i) => termWords[start + i] === word));
}

/**
 * The related words to search for alongside `term`, as one websearch_to_tsquery string
 * (`rtx or gtx or "graphics card"`), or null when no group matches. Matching is case-insensitive,
 * on whole words or phrases only ("ram" is not found inside "program"), and ignores a plural "s".
 */
export function relatedSearch(term) {
  const termWords = wordsOf(term);
  const related = new Set();
  for (const group of RELATED_WORD_GROUPS) {
    const triggers = [...(group.broad ?? []), ...group.words];
    if (triggers.some((phrase) => containsPhrase(termWords, phrase))) {
      for (const word of group.words) related.add(word);
    }
  }
  if (related.size === 0) return null;
  // A phrase goes in quotes, so websearch_to_tsquery looks for its words side by side.
  return [...related].map((word) => (word.includes(" ") ? `"${word}"` : word)).join(" or ");
}
