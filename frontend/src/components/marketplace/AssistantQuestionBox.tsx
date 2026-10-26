import { Send } from "lucide-react";
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

/** Ask UniSwap's question box, with the last error and a note on where questions go. */
export function AssistantQuestionBox({ value, onChange, onAsk, isAsking, error }: AssistantQuestionBoxProps) {
  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAsk();
        }}
        className="flex items-center gap-2"
      >
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
          className="h-10"
        />
        <Button type="submit" size="icon-lg" disabled={!value.trim() || isAsking} aria-label="Ask">
          <Send aria-hidden="true" />
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-foreground">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Answers come from Google Gemini, which can make mistakes: check the listing before you buy.
        Your questions are sent to Google, so leave out personal details.
      </p>
    </div>
  );
}
