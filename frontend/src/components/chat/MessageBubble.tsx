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
          // Not bg-muted for replies: inside the light-surface card --muted is the
          // card's own colour, so the bubble vanished and replies read as loose text.
          isOwn
            ? "bg-primary text-primary-foreground"
            : "border border-brand-600/40 bg-brand-50 text-foreground",
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

