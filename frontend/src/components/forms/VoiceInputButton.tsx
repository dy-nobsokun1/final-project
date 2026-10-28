"use client";

import { Loader2, Mic } from "lucide-react";
import { useRef, type CSSProperties } from "react";
import type { VoiceStatus } from "@/hooks/use-voice-input";
import { cn } from "@/lib/utils";

/** Held at least this long, a press is "hold to talk": letting go stops. Shorter is a tap: it keeps listening. */
const HOLD_MS = 300;
/** How much each of the four bars follows the voice level, so they do not move as one. */
const BAR_SCALE = [0.7, 1, 0.85, 0.6];

interface VoiceInputButtonProps {
  status: VoiceStatus;
  /** 0 to 1 from the recorder; null with live recognition, which has no level (the bars then wave by themselves). */
  level: number | null;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}

/**
 * The mic button next to a text box. Tap to start and tap to stop, or hold to talk and let go to stop.
 * While listening it shows sound-wave bars, and a spinner while the voice is turned into text.
 */
export function VoiceInputButton({ status, level, onStart, onStop, className }: VoiceInputButtonProps) {
  const pressedAt = useRef<number | null>(null);
  const isListening = status === "listening";
  const isBusy = status === "transcribing";
  const label = isBusy
    ? "Turning your voice into text"
    : isListening
      ? "Stop listening"
      : "Speak instead of typing (press, or hold to talk)";

  function endHold() {
    if (pressedAt.current === null) return;
    const wasHold = Date.now() - pressedAt.current >= HOLD_MS;
    pressedAt.current = null;
    if (wasHold) onStop();
  }

  return (
    <button
      type="button"
      disabled={isBusy}
      aria-label={label}
      aria-pressed={isListening}
      aria-busy={isBusy}
      title={label}
      // Keeps focus in the text box, so the search list does not close when the mic is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (isListening) return onStop();
        pressedAt.current = Date.now();
        onStart();
      }}
      onPointerUp={endHold}
      // Sliding off while holding, or the system taking over the touch, also stops.
      onPointerLeave={endHold}
      onPointerCancel={() => {
        pressedAt.current = null;
        onStop();
      }}
      // A mouse or touch press is handled above; only the keyboard (Enter, Space) clicks with detail 0.
      onClick={(event) => {
        if (event.detail === 0) (isListening ? onStop : onStart)();
      }}
      className={cn(
        "inline-flex shrink-0 touch-none select-none items-center justify-center rounded-full text-brand-ink transition-colors hover:bg-brand-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink",
        (isListening || isBusy) && "bg-brand-deep text-brand-50 hover:bg-brand-900",
        className,
      )}
    >
      {isBusy ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : isListening ? (
        <span aria-hidden="true" className="flex h-4 items-center gap-[3px]">
          {BAR_SCALE.map((scale, index) => (
            <span
              key={index}
              className="voice-bar"
              data-live={level === null ? "" : undefined}
              style={
                {
                  "--d": `${index * 120}ms`,
                  ...(level === null ? {} : { "--h": `${Math.round(Math.min(1, 0.2 + level * scale) * 100)}%` }),
                } as CSSProperties
              }
            />
          ))}
        </span>
      ) : (
        <Mic aria-hidden="true" className="size-4" />
      )}
      <span role="status" className="sr-only">
        {isBusy ? "Turning your voice into text." : isListening ? "Listening. Press again to stop." : ""}
      </span>
    </button>
  );
}
