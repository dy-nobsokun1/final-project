// Records the microphone and sends the clip to our API, which turns it into text with Whisper.
// For browsers without working live recognition (Firefox, Opera, Brave). Words appear after stopping.

const TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
/** Stops by itself after this long (the API takes about 60 s of audio). */
const MAX_MS = 60 * 1000;
/** A clip that never got louder than this is silence: not sent, since Whisper invents words from silence. */
const SILENCE_LEVEL = 0.05;
/** The level is reported about this often, so the page is not redrawn on every frame. */
const LEVEL_EVERY_MS = 70;

export const canRecord = () =>
  typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export class VoiceError extends Error {}

export interface RecorderHandlers {
  /** 0 to 1, how loud the voice is right now. */
  onLevel: (level: number) => void;
  /** The finished clip, or null if it was silent. */
  onClip: (clip: Blob | null) => void;
  onError: (error: VoiceError) => void;
}

/** Starts recording. Returns stop() (sends the clip on) and abort() (drops it). Always frees the microphone. */
export function startRecorder({ onLevel, onClip, onError }: RecorderHandlers) {
  let stopRequested = false;
  let aborted = false;
  let finish: (() => void) | null = null;

  (async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = (error as DOMException).name;
      onError(new VoiceError(name === "NotFoundError" ? "No microphone found." : "Allow the microphone for this site to use voice input."));
      return;
    }

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const type = TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    let peak = 0;
    let lastReport = 0;
    let frame = 0;

    const measure = (now: number) => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) sum += ((value - 128) / 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
      peak = Math.max(peak, level);
      if (now - lastReport >= LEVEL_EVERY_MS) {
        lastReport = now;
        onLevel(level);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      if (aborted) return;
      onClip(peak < SILENCE_LEVEL ? null : new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" }));
    };
    finish = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
    const timer = setTimeout(finish, MAX_MS);
    recorder.start();
    // stop() or abort() pressed while the microphone was still opening.
    if (stopRequested) finish();
  })();

  return {
    stop: () => {
      stopRequested = true;
      finish?.();
    },
    abort: () => {
      aborted = true;
      stopRequested = true;
      finish?.();
    },
  };
}

/** Sends a clip to our API and returns the text. Throws a VoiceError with a message for the student. */
export async function transcribeClip(clip: Blob): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": clip.type }, body: clip });
  } catch {
    throw new VoiceError("Couldn't turn that into text. Try again.");
  }
  if (response.status === 401) throw new VoiceError("Sign in to use voice input in this browser.");
  const body = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (response.status === 503 && body?.error) throw new VoiceError(body.error);
  if (!response.ok) throw new VoiceError("Couldn't turn that into text. Try again.");
  return body?.text ?? "";
}
