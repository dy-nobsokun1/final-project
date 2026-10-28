// The browser's own speech recognition (Chrome, Edge, Safari): words arrive live while the student
// speaks. TypeScript has no built-in types for it, so the few parts we use are declared here.
interface ResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

/** Stops by itself after this long, so a forgotten mic does not listen for ever. */
const MAX_MS = 60 * 1000;

function getConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Opera and Brave offer the API but cannot reach its speech service, so they record instead. */
function isOperaOrBrave(): boolean {
  const brands = (navigator as unknown as { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return "brave" in navigator || navigator.userAgent.includes("OPR/") || Boolean(brands?.some((b) => b.brand.includes("Opera")));
}

export const canUseLiveRecognition = () => getConstructor() !== undefined && !isOperaOrBrave();

export interface LiveHandlers {
  /** Everything said since start, so far. */
  onTranscript: (transcript: string) => void;
  /** The recognition's own error code, e.g. "not-allowed" or "network". Not called for "aborted". */
  onError: (code: string) => void;
  onEnd: () => void;
}

/** Starts listening. Returns stop() (keeps what was said) and abort() (drops it). Throws if it cannot start. */
export function startLiveRecognition({ onTranscript, onError, onEnd }: LiveHandlers) {
  const Ctor = getConstructor();
  if (!Ctor) throw new Error("No speech recognition");
  const instance = new Ctor();
  instance.lang = "en-US";
  instance.interimResults = true;
  instance.continuous = true; // keeps listening through pauses, until the student stops it
  instance.maxAlternatives = 1;
  instance.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    onTranscript(transcript.trim());
  };
  instance.onerror = (event) => {
    if (event.error !== "aborted") onError(event.error);
  };
  const timer = setTimeout(() => instance.stop(), MAX_MS);
  instance.onend = () => {
    clearTimeout(timer);
    onEnd();
  };
  instance.start();
  return { stop: () => instance.stop(), abort: () => instance.abort() };
}
