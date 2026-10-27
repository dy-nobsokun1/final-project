"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The few parts of the browser's speech recognition we use (TypeScript has no built-in types).
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

const BROWSER_ERROR = "Voice input doesn't work in this browser. Try Chrome, Edge or Safari.";
const ERRORS: Record<string, string> = {
  "not-allowed": "Allow the microphone for this site to use voice input.",
  network: BROWSER_ERROR,
  "service-not-allowed": BROWSER_ERROR,
  "language-not-supported": BROWSER_ERROR,
  "audio-capture": "No microphone found.",
  "no-speech": "Didn't catch that. Press the mic and try again.",
};

function getConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const subscribeNothing = () => () => {};

interface VoiceInputOptions {
  /** Gets the whole text for the box: what was there, then the spoken words. */
  onText: (text: string) => void;
  /** Called when listening has ended, for any reason. */
  onEnd?: () => void;
}

/**
 * Speech to text with the browser's own recognition (no server, no package). start(baseText)
 * remembers what is already in the box, so speech is added to the end of it. isSupported is false
 * on the server and on the first render, then true in Chrome, Edge and Safari (never in Firefox).
 */
export function useVoiceInput({ onText, onEnd }: VoiceInputOptions) {
  const isSupported = useSyncExternalStore(
    subscribeNothing,
    () => getConstructor() !== undefined,
    () => false,
  );
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const callbacks = useRef({ onText, onEnd });

  useEffect(() => {
    callbacks.current = { onText, onEnd };
  });

  // Leaving the page while listening must not keep the microphone open.
  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback((baseText: string) => {
    const Ctor = getConstructor();
    if (!Ctor) return;
    setError(null);
    const instance = new Ctor();
    instance.lang = "en-US";
    instance.interimResults = true;
    instance.continuous = false;
    instance.maxAlternatives = 1;
    const prefix = baseText ? `${baseText} ` : "";
    instance.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      callbacks.current.onText(prefix + transcript.trim());
    };
    instance.onerror = (event) => {
      if (event.error !== "aborted") setError(ERRORS[event.error] ?? BROWSER_ERROR);
    };
    instance.onend = () => {
      recognition.current = null;
      setIsListening(false);
      callbacks.current.onEnd?.();
    };
    recognition.current = instance;
    try {
      instance.start();
      setIsListening(true);
    } catch {
      recognition.current = null;
      setError(BROWSER_ERROR);
    }
  }, []);

  const stop = useCallback(() => recognition.current?.stop(), []);
  const clearError = useCallback(() => setError(null), []);

  return { isSupported, isListening, error, start, stop, clearError };
}
