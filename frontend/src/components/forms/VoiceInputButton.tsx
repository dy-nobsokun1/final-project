import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputButtonProps {
  isListening: boolean;
  onClick: () => void;
  className?: string;
}

/** The mic button next to a text box. Pulses (and shows a crossed mic as "stop") while listening. */
export function VoiceInputButton({ isListening, onClick, className }: VoiceInputButtonProps) {
  const label = isListening ? "Stop listening" : "Speak instead of typing";
  const Icon = isListening ? MicOff : Mic;
  return (
    <button
      type="button"
      onClick={onClick}
      // Keeps focus in the text box, so the search list does not close when the mic is pressed.
      onMouseDown={(event) => event.preventDefault()}
      aria-label={label}
      aria-pressed={isListening}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-brand-ink transition-colors hover:bg-brand-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink",
        isListening && "animate-pulse bg-brand-deep text-brand-50 hover:bg-brand-900",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
