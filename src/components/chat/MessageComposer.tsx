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
        className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        aria-label="Send message"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        <Send aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
}

