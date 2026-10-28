import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { API_URL, TOKEN_COOKIE } from "@/lib/api/http";

/**
 * POST /api/voice: a recorded clip (raw bytes) -> { text }, for browsers without live speech
 * recognition. It hands the clip to the API's POST /api/voice/transcribe with the login cookie as
 * the bearer token, and returns the API's status and JSON. A Route Handler, not a Server Action:
 * Server Actions take no raw bytes and run one at a time. Nothing is stored here.
 */
export async function POST(request: NextRequest) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ error: "Sign in to use voice input." }, { status: 401 });

  try {
    const response = await fetch(`${API_URL}/api/voice/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": request.headers.get("content-type") ?? "audio/webm",
      },
      body: await request.arrayBuffer(),
      cache: "no-store",
    });
    return Response.json(await response.json().catch(() => ({})), { status: response.status });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Voice input failed. Try again." }, { status: 502 });
  }
}
