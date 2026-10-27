"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { canUseLiveRecognition, startLiveRecognition } from "@/lib/voice/live-recognition";
import { canRecord, startRecorder, transcribeClip, VoiceError } from "@/lib/voice/recorder";

export type VoiceStatus = "idle" | "listening" | "transcribing";

const BROWSER_ERROR = "Voice input doesn't work in this browser.";
const NO_SPEECH = "Didn't catch that. Press the mic and try again.";
const LIVE_ERRORS: Record<string, string> = {
  "not-allowed": "Allow the microphone for this site to use voice input.",
  "audio-capture": "No microphone found.",
  "no-speech": NO_SPEECH,
};
/** Errors that mean live recognition cannot work here, so the recorder takes over. */
const LIVE_UNUSABLE = ["network", "service-not-allowed", "language-not-supported"];

/** Set once live recognition fails in this browser (e.g. Vivaldi), so later presses go straight to the recorder. */
let liveBroken = false;

const subscribeNothing = () => () => {};
const canListen = () => (canUseLiveRecognition() && !liveBroken) || canRecord();

interface VoiceInputOptions {
  /** Gets the whole text for the box: what was there, then the spoken words. */
  onText: (text: string) => void;
  /** Called when listening and transcribing have ended, for any reason. */
  onEnd?: () => void;
}

/**
 * Speech to text. Chrome, Edge and Safari use the browser's own recognition (words appear live);
 * Firefox, Opera, Brave, and any browser where that fails, record the voice and have it transcribed
 * after stopping. start(baseText) remembers what is in the box, so speech is added to its end.
 * isSupported is false on the server and on the first render, so there is no hydration mismatch.
 */
export function useVoiceInput({ onText, onEnd }: VoiceInputOptions) {
  const isSupported = useSyncExternalStore(subscribeNothing, canListen, () => false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [level, setLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const callbacks = useRef({ onText, onEnd });

  useEffect(() => {
    callbacks.current = { onText, onEnd };
  });

  // Leaving the page while listening must not keep the microphone open.
  useEffect(() => () => active.current?.abort(), []);

  const finish = useCallback(() => {
    active.current = null;
    setStatus("idle");
    setLevel(null);
    callbacks.current.onEnd?.();
  }, []);

  const record = useCallback(
    (prefix: string) => {
      setStatus("listening");
      setLevel(0);
      active.current = startRecorder({
        onLevel: setLevel,
        onError: (failure) => {
          setError(failure.message);
          finish();
        },
        onClip: async (clip) => {
          if (!clip) {
            setError(NO_SPEECH);
            return finish();
          }
          active.current = null;
          setStatus("transcribing");
          setLevel(null);
          try {
            const text = await transcribeClip(clip);
            if (text) callbacks.current.onText(prefix + text);
            else setError(NO_SPEECH);
          } catch (failure) {
            setError(failure instanceof VoiceError ? failure.message : BROWSER_ERROR);
          }
          finish();
        },
      });
    },
    [finish],
  );

  const start = useCallback(
    (baseText: string) => {
      setError(null);
      const trimmed = baseText.trimEnd();
      const prefix = trimmed ? `${trimmed} ` : "";
      if (canUseLiveRecognition() && !liveBroken) {
        try {
          setStatus("listening");
          setLevel(null);
          active.current = startLiveRecognition({
            onTranscript: (transcript) => callbacks.current.onText(prefix + transcript),
            onError: (code) => {
              if (LIVE_UNUSABLE.includes(code) && canRecord()) {
                liveBroken = true;
                record(prefix);
              } else {
                setError(LIVE_ERRORS[code] ?? BROWSER_ERROR);
              }
            },
            onEnd: () => {
              // After a fallback the recorder owns the state; this end belongs to the old recognition.
              if (!liveBroken) finish();
            },
          });
          return;
        } catch {
          liveBroken = true;
        }
      }
      if (canRecord()) record(prefix);
      else setError(BROWSER_ERROR);
    },
    [finish, record],
  );

  const stop = useCallback(() => active.current?.stop(), []);
  const clearError = useCallback(() => setError(null), []);

  return { isSupported, status, level, error, start, stop, clearError };
}
