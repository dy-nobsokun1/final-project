import { AssistantReply } from "@/components/marketplace/AssistantReply";
import type { AssistantMessage } from "@/types";

interface AssistantMessagesProps {
  messages: AssistantMessage[];
  isAsking: boolean;
}

/**
 * Ask UniSwap's conversation: the student's questions as bubbles, each answer with its cards.
 * Messages are only ever added at the end, so their index is a stable key.
 */
export function AssistantMessages({ messages, isAsking }: AssistantMessagesProps) {
  return (
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
  );
}
