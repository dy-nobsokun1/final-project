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
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            // Bubbles sit inside the thread's light-surface card, so both
            // resolve to black text via that scope.
            isOwn ? "text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </li>
  );
}

