import { cn, formatRelativeTime } from "@/lib/utils";
import type { Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

/** One chat bubble, aligned right for the signed-in user. */
export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <li className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
          isOwn ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            isOwn ? "text-zinc-400" : "text-zinc-500",
          )}
        >
          {formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </li>
  );
}

