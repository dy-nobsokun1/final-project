import express, { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AUDIO_EXTENSIONS, isWhisperConfigured, transcribe } from "../services/whisper.js";
import { HttpError } from "../utils/httpError.js";

// About 60 seconds of Opus. The audio is never saved, and the text is never logged.
const MAX_SIZE = "2mb";

export const voiceRouter = Router();

// POST /api/voice/transcribe  (logged in)  body: raw audio bytes, with Content-Type set to the audio type
// Only students can use it, to protect Groq's free limit of about 2,000 clips a day.
voiceRouter.post(
  "/transcribe",
  requireAuth,
  express.raw({ type: Object.keys(AUDIO_EXTENSIONS), limit: MAX_SIZE }),
  async (req, res) => {
    const type = req.get("content-type")?.split(";")[0].trim();
    if (!AUDIO_EXTENSIONS[type]) throw new HttpError(415, "Send audio as webm, ogg, mp4, mp3 or wav.");
    if (!isWhisperConfigured()) throw new HttpError(503, "Voice input is off.");
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "No audio was sent.");

    try {
      res.json({ text: await transcribe(req.body, type) });
    } catch (error) {
      if (error.status === 429) throw new HttpError(503, "Voice input is busy. Try again in a minute.");
      throw new HttpError(502, "Voice input failed. Try again.");
    }
  },
);
