import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { API_URL, TOKEN_COOKIE } from "@/lib/api/http";

/**
 * GET /api/listing-draft -> { enabled }: whether the sell form shows "Fill in from photo" (signed in,
 * and the API has a vision model). Any error answers false, so the button just stays hidden.
 */
export async function GET() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ enabled: false });
  try {
    const response = await fetch(`${API_URL}/api/assistant/listing-draft`, { cache: "no-store" });
    const body = await response.json();
    return Response.json({ enabled: response.ok && body.enabled === true });
  } catch {
    return Response.json({ enabled: false });
  }
}

/**
 * POST /api/listing-draft: a shrunk photo (raw JPEG bytes) -> { draft, priceHint } from the API's
 * POST /api/assistant/listing-draft, with the login cookie as the bearer token. Like app/api/voice:
 * a Route Handler, because Server Actions take no raw bytes. Nothing is stored or logged here.
 */
export async function POST(request: NextRequest) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ error: "Sign in to fill in from a photo." }, { status: 401 });

  try {
    const response = await fetch(`${API_URL}/api/assistant/listing-draft`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": request.headers.get("content-type") ?? "image/jpeg",
      },
      body: await request.arrayBuffer(),
      cache: "no-store",
    });
    return Response.json(await response.json().catch(() => ({})), { status: response.status });
  } catch {
    return Response.json({ error: "Could not read the photo right now. Please fill in the form yourself." }, { status: 502 });
  }
}
