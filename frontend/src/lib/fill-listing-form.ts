/** What "Fill in from photo" suggests (POST /api/listing-draft). Each field is "" when the AI gave nothing usable. */
export interface PhotoDraft {
  title: string;
  category: string;
  condition: string;
  description: string;
}

/** A price range from similar UniSwap listings, never from the AI. `sold`: what sold items went for. */
export interface PriceHint {
  low: number;
  high: number;
  count: number;
  sold: boolean;
}

export const DRAFT_TEXT_FIELDS = ["title", "description"] as const;
export const DRAFT_SELECTS = ["category", "condition"] as const;

/**
 * Sets a category or condition select. The sell form's selects are Radix Selects, which keep a hidden
 * native <select> and update themselves when it fires "change" (the way browser autofill fills them).
 * So the native value is set the same way React and Radix do, then the event is sent.
 */
function setSelect(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Fills the sell form from a draft, but only fields the student left empty: a text field that is
 * blank, or a select whose name is in `freeSelects` (still on its starting value and never picked).
 * The price is filled with the middle of the hint's range only when its box is empty.
 * Never submits. Returns how many fields changed and the price it filled in, if any.
 */
export function fillListingForm(form: HTMLFormElement, draft: PhotoDraft, hint: PriceHint | null, freeSelects: string[]) {
  let filled = 0;
  for (const name of DRAFT_TEXT_FIELDS) {
    const field = form.elements.namedItem(name);
    if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && !field.value.trim() && draft[name]) {
      field.value = draft[name];
      filled++;
    }
  }
  for (const name of DRAFT_SELECTS) {
    const select = form.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
    if (select && freeSelects.includes(name) && draft[name] && select.value !== draft[name]) {
      setSelect(select, draft[name]);
      filled++;
    }
  }
  const price = form.elements.namedItem("price");
  let filledPrice: number | null = null;
  if (hint && price instanceof HTMLInputElement && !price.disabled && price.value === "") {
    filledPrice = Math.round((hint.low + hint.high) / 2);
    price.value = String(filledPrice);
    filled++;
  }
  return { filled, filledPrice };
}
