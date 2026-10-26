import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The API takes messages of at most 1000 characters (backend/src/utils/assistant.js). */
const MAX_LENGTH = 1000;

interface AssistantQuestionBoxProps {
  value: string;
  onChange: (value: string) => void;
  onAsk: () => void;
  isAsking: boolean;
  error: string | null;
}

/** Ask UniSwap's question box, with the last error under it. */
export function AssistantQuestionBox({ value, onChange, onAsk, isAsking, error }: AssistantQuestionBoxProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* One pill, like the hero's "Ask UniSwap" box: the form is the bar, so the input inside
          has no border or ring of its own. The bar gets the focus outline while the input is
          focused (the send button keeps its own ring). Black at 70% on #B1D3B9 outlines it. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAsk();
        }}
        className="flex h-12 items-center gap-2 rounded-full border-2 border-brand-ink/70 bg-brand-50 pr-1 pl-4 shadow-md has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-ink"
      >
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-brand-ink" />
        <label htmlFor="assistant-question" className="sr-only">
          Your question
        </label>
        <Input
          id="assistant-question"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={MAX_LENGTH}
          placeholder="e.g. a desk lamp under $10"
          autoComplete="off"
          className="h-full border-0 bg-transparent px-0 focus-visible:ring-0 dark:bg-transparent"
        />
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
