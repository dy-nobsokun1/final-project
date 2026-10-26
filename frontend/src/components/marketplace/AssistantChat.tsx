"use client";

import { Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { AssistantReply } from "@/components/marketplace/AssistantReply";
import { AssistantStarters } from "@/components/marketplace/AssistantStarters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/api/actions";
import type { AssistantMessage } from "@/types";

/** The API takes at most 20 messages of 1000 characters each (backend/src/utils/assistant.js). */
const MAX_HISTORY = 20;
const MAX_LENGTH = 1000;

/**
 * Ask UniSwap: a chat with the shopping assistant. The conversation lives only in this page's state
 * (leaving the page clears it), and each question sends its newest messages to the API.
 * Messages are only ever added at the end, so their index is a stable key.
 */
export function AssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    if (!text.trim() || isAsking) return;
    const conversation: AssistantMessage[] = [...messages, { role: "user", text: text.trim() }];
    setMessages(conversation);
    setQuestion("");
    setError(null);
    setIsAsking(true);
    const result = await askAssistant(conversation.slice(-MAX_HISTORY));
    setIsAsking(false);
    if (result.answer) {
      setMessages([...conversation, { role: "assistant", text: result.answer.reply, answer: result.answer }]);
    } else {
      // Take the question off the chat and put it back in the box, so it can be sent again.
      setMessages(messages);
      setQuestion(text);
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    // Same height rules as a message thread (app/(main)/messages/[id]/page.tsx): the chat scrolls
    // inside the card and the question box stays at its bottom.
    <div className="light-surface flex h-[calc(100dvh-173px)] min-h-96 flex-col gap-3 rounded-xl bg-card p-4 max-md:-mb-14 md:h-[calc(100dvh-113px)]">
      <header className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="size-5" />
        <h1 className="font-heading text-2xl tracking-tight">Ask UniSwap</h1>
      </header>

      {/* flex-col-reverse starts the scroll at the bottom, so the newest answer is in view. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
        {messages.length === 0 ? (
          <AssistantStarters onPick={(text) => void ask(text)} />
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((message, index) => message.answer ? (
              <AssistantReply key={index} answer={message.answer} />
            ) : (
              <li key={index} className="flex justify-end">
                <p className="max-w-[75%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  {message.text}
                </p>
              </li>
            ))}
            {isAsking ? (
              <li className="animate-pulse text-sm text-muted-foreground motion-reduce:animate-none">
                Looking through the listings...
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* Screen readers hear each new answer here, without the cards read out too. */}
      <p role="status" className="sr-only">
        {isAsking ? "Looking through the listings" : messages.at(-1)?.answer?.reply}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor="assistant-question" className="sr-only">
          Your question
        </label>
        <Input
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={MAX_LENGTH}
          placeholder="e.g. a desk lamp under $10"
          autoComplete="off"
          className="h-10"
        />
        <Button type="submit" size="icon-lg" disabled={!question.trim() || isAsking} aria-label="Ask">
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
