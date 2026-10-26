import type { KeyboardEvent } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The API takes messages of at most 1000 characters (backend/src/utils/assistant.js). */
const MAX_LENGTH = 1000;
/** The grey example in the empty box, which Tab fills in. */
const EXAMPLE = "a desk lamp under $10";
const HINT_ID = "assistant-question-hint";

interface AssistantQuestionBoxProps {
  value: string;
  onChange: (value: string) => void;
  onAsk: () => void;
  isAsking: boolean;
  error: string | null;
}

/** Ask UniSwap's question box, with the last error under it. */
export function AssistantQuestionBox({ value, onChange, onAsk, isAsking, error }: AssistantQuestionBoxProps) {
  const isEmpty = value === "";

  // Tab in the empty box fills in the example instead of moving on. Once there is text, Tab and
  // Shift+Tab move focus as usual, so nobody gets stuck in the box.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Tab" || event.shiftKey || !isEmpty) return;
    event.preventDefault();
    onChange(EXAMPLE);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* One pill, like the hero's "Ask UniSwap" box: the form is the bar, so the input inside
          has no border or ring of its own. Black at 70% on #B1D3B9 outlines it. While the input is
          focused, a 2px black ring hugs that border, so the one outline turns solid and thicker
          (a ring takes no space, so nothing moves). The send button keeps its own ring. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAsk();
        }}
        className="flex h-12 items-center gap-2 rounded-full border-2 border-brand-ink/70 bg-brand-50 pr-1 pl-4 shadow-md has-[input:focus-visible]:border-brand-ink has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand-ink"
      >
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-brand-ink" />
        <label htmlFor="assistant-question" className="sr-only">
          Your question
        </label>
        <Input
          id="assistant-question"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_LENGTH}
          placeholder={`e.g. ${EXAMPLE}`}
          autoComplete="off"
          aria-describedby={isEmpty ? HINT_ID : undefined}
          className="peer h-full border-0 bg-transparent px-0 focus-visible:ring-0 dark:bg-transparent"
        />
        {/* The Tab key hint, only while the box is empty and focused, which is when Tab fills it in
            (peer-focus: the input is the peer). Screen readers hear the sentence instead
            (black on #B1D3B9 is 12.9:1). */}
        {isEmpty ? (
          <>
            <kbd aria-hidden="true" className="hidden shrink-0 rounded-md border border-brand-ink/40 bg-brand-200 px-1.5 py-0.5 font-sans text-xs font-medium text-brand-ink peer-focus:block">
              Tab
            </kbd>
            <span id={HINT_ID} className="sr-only">Press Tab to use the example</span>
          </>
        ) : null}
        {/* Dark like the hero's "Browse listings" (#E6F2DD on #22312D is 11.72:1). Dimmed to 60%
            when disabled, its circle is still 3.7:1 on the bar. The ripple turns light to show. */}
        <Button
          type="submit"
          size="icon-lg"
          disabled={!value.trim() || isAsking}
          aria-label="Ask"
          className="rounded-full bg-brand-deep text-brand-50 [--ripple-button-ripple-color:var(--brand-50)] hover:bg-brand-900 disabled:opacity-60"
        >
          <Send aria-hidden="true" />
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
