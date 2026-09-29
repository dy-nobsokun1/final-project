"use client";

import { Send } from "lucide-react";
import { useState } from "react";

/**
 * Chat input. The draft is validated and then cleared, but nothing is sent yet:
 * this becomes a POST to the conversation route once the backend exists.
 */
export function MessageComposer() {
  const [draft, setDraft] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    setDraft("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <label htmlFor="message" className="sr-only">
        Message
      </label>
      <textarea
        id="message"
        name="message"
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Write a message..."
        className="flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        aria-label="Send message"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50"
      >
        <Send aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
}

