"use client";

import { MessageSquarePlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { AssistantMessages } from "@/components/marketplace/AssistantMessages";
import { AssistantQuestionBox } from "@/components/marketplace/AssistantQuestionBox";
import { AssistantStarters } from "@/components/marketplace/AssistantStarters";
import { Button } from "@/components/ui/button";
import { useAssistantHistory } from "@/hooks/use-assistant-history";
import { askAssistant, type ActionResult } from "@/lib/api/actions";
import type { AssistantAnswer, AssistantMessage } from "@/types";

/**
 * Each question sends only the newest messages: itself and the two questions and answers before it.
 * That is enough for a follow-up like "yes, up to $80" after a draft offer, and it keeps long chats
 * within Groq's free token limit. An odd number, so the first one sent is always a question.
 */
const MESSAGES_SENT = 5;

/**
 * Ask UniSwap: a chat with the shopping assistant. The conversation is saved for this tab
 * (useAssistantHistory), so it is still there after leaving the page or reloading, until "New chat".
 */
export function AssistantChat({ userId }: { userId: string }) {
  const [messages, saveMessages] = useAssistantHistory(userId);
  // The question waiting for its answer. It is saved only with that answer, so a failed one never is.
  const [pending, setPending] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const isAsking = pending !== null;
  const shown: AssistantMessage[] | null =
    messages && pending !== null ? [...messages, { role: "user", text: pending }] : messages;

  async function ask(text: string) {
    if (!text.trim() || isAsking || !messages) return;
    const asked: AssistantMessage = { role: "user", text: text.trim() };
    setPending(asked.text);
    setQuestion("");
    setError(null);
    let result: ActionResult & { answer?: AssistantAnswer };
    try {
      result = await askAssistant([...messages, asked].slice(-MESSAGES_SENT));
    } catch {
      // The request never came back (the Wi-Fi dropped, say): shown like any other error below.
      result = { error: "Couldn't reach UniSwap. Check your connection and try again." };
    } finally {
      setPending(null);
    }
    if (result.answer) {
      saveMessages([...messages, asked, { role: "assistant", text: result.answer.reply, answer: result.answer }]);
      setAnnouncement(result.answer.reply);
    } else {
      // Put the question back in the box, so it can be sent again.
      setQuestion(text);
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  function startNewChat() {
    saveMessages([]);
    setError(null);
    setAnnouncement("");
    // The button disappears with the chat, so focus moves to the question box.
    document.getElementById("assistant-question")?.focus();
  }

  return (
    // Same height rules as a message thread (app/(main)/messages/[id]/page.tsx): the chat scrolls
    // inside the card and the question box stays at its bottom.
    <div className="light-surface flex h-[calc(100dvh-173px)] min-h-96 flex-col gap-3 rounded-xl bg-card p-4 max-md:-mb-14 md:h-[calc(100dvh-113px)]">
      <header className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="size-5" />
        <h1 className="font-heading text-2xl tracking-tight">Ask UniSwap</h1>
        {messages && messages.length > 0 ? (
          <Button variant="ghost" onClick={startNewChat} disabled={isAsking} className="ml-auto">
            <MessageSquarePlus aria-hidden="true" />
            New chat
          </Button>
        ) : null}
      </header>

      {/* flex-col-reverse starts the scroll at the bottom, so the newest answer is in view.
          Empty until the saved chat is read, so the starters never flash before it. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
        {shown?.length === 0 ? <AssistantStarters onPick={(text) => void ask(text)} /> : null}
        {shown && shown.length > 0 ? <AssistantMessages messages={shown} isAsking={isAsking} /> : null}
      </div>

      {/* Screen readers hear each new answer here (not a restored one), without the cards read out too. */}
      <p role="status" className="sr-only">
        {isAsking ? "Looking through the listings" : announcement}
      </p>

      <AssistantQuestionBox
        value={question}
        onChange={setQuestion}
        onAsk={() => void ask(question)}
        isAsking={isAsking}
        error={error}
      />
    </div>
  );
}
