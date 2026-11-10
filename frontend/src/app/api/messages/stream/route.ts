import type { NextRequest } from "next/server";
import { API_URL, TOKEN_COOKIE } from "@/lib/api/http";

/**
 * GET /api/messages/stream?listingId=&withUserId= -> the signed-in student's new chat messages,
 * live, as Server-Sent Events (the API's GET /api/messages/stream, passed through unchanged).
 * A Route Handler, because only the Next.js server may call the API and the browser's
 * EventSource cannot send the login token itself: this reads it from the httpOnly cookie.
 * Plain fetch, not apiFetch, which waits for a whole JSON body. Any failure answers an error
 * status with no stream, and the chat then works as before, without live messages.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return new Response(null, { status: 401 });

  const params = new URLSearchParams();
  for (const name of ["listingId", "withUserId"]) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) params.set(name, value);
  }

  let upstream: Response;
  try {
    // request.signal ends the API's stream too when the tab closes, so the API forgets it.
    upstream = await fetch(`${API_URL}/api/messages/stream?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  if (upstream.status !== 200 || !upstream.body) {
    await upstream.body?.cancel();
    return new Response(null, { status: upstream.status === 200 ? 502 : upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      // no-transform keeps `next start` from gzipping it, which would hold events back.
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
