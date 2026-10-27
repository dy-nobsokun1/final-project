import assert from "node:assert/strict";
import { test } from "node:test";

// These modules load config.js, which requires these. No network or database is used.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET ??= "unused";
const { createTunnelWatcher } = await import("../src/services/tunnel.js");
const { checkoutReturnOrigin, checkoutReturnOrigins } = await import("../src/utils/payments.js");

const FALLBACK = "http://localhost:3000";

/** A fetch that answers like cloudflared's /quicktunnel, or fails like a tunnel that is not running. */
function fakeFetch(answers) {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    const answer = answers.shift();
    if (answer instanceof Error) throw answer;
    return { ok: answer.ok ?? true, json: async () => answer.body };
  };
  return { fetchImpl, urls };
}

test("the tunnel watcher follows cloudflared's address, falls back when it stops answering, and logs only changes", async () => {
  const { fetchImpl, urls } = fakeFetch([
    { body: { hostname: "first-one.trycloudflare.com" } },
    { body: { hostname: "first-one.trycloudflare.com" } },
    new Error("connect ECONNREFUSED 127.0.0.1:20241"),
    { body: { hostname: "second-one.trycloudflare.com" } },
  ]);
  const lines = [];
  const watcher = createTunnelWatcher({
    metricsUrl: "http://127.0.0.1:20241", fallbackOrigin: FALLBACK, fetchImpl, log: (line) => lines.push(line),
  });

  assert.equal(watcher.origin(), FALLBACK); // before the first poll
  await watcher.poll();
  assert.equal(watcher.origin(), "https://first-one.trycloudflare.com");
  await watcher.poll(); // same address again: no new log line
  await watcher.poll();
  assert.equal(watcher.origin(), FALLBACK);
  await watcher.poll();
  assert.equal(watcher.origin(), "https://second-one.trycloudflare.com");

  assert.deepEqual(urls, Array(4).fill("http://127.0.0.1:20241/quicktunnel"));
  assert.deepEqual(lines, [
    "[tunnel] links now use https://first-one.trycloudflare.com",
    `[tunnel] cloudflared not answering; links use ${FALLBACK}`,
    "[tunnel] links now use https://second-one.trycloudflare.com",
  ]);
});

test("the tunnel watcher ignores an empty, odd or failing answer", async () => {
  const { fetchImpl } = fakeFetch([
    { body: { hostname: "" } },
    { body: { hostname: "evil.example/path?x=1" } },
    { body: {} },
    { ok: false, body: { hostname: "from-an-error.trycloudflare.com" } },
  ]);
  const watcher = createTunnelWatcher({ metricsUrl: "http://127.0.0.1:20241", fallbackOrigin: FALLBACK, fetchImpl, log: () => {} });
  for (let i = 0; i < 4; i += 1) {
    await watcher.poll();
    assert.equal(watcher.origin(), FALLBACK);
  }
});

test("card checkout returns the buyer only to an address the API knows", () => {
  const known = [FALLBACK, "https://abc.trycloudflare.com"];
  assert.equal(checkoutReturnOrigin("https://abc.trycloudflare.com", known, FALLBACK), "https://abc.trycloudflare.com");
  assert.equal(checkoutReturnOrigin(FALLBACK, known, FALLBACK), FALLBACK);
  // Anything else is not trusted: another host, a look-alike, a path, or nothing at all.
  for (const other of ["https://evil.example", "https://abc.trycloudflare.com.evil.example", `${FALLBACK}/x`, undefined, 42]) {
    assert.equal(checkoutReturnOrigin(other, known, FALLBACK), FALLBACK);
  }
});

test("with a fixed public FRONTEND_ORIGIN, a buyer on localhost still returns to localhost", () => {
  const funnel = "https://laptop.tail1234.ts.net";
  const known = checkoutReturnOrigins(funnel, funnel); // no quick tunnel: siteOrigin() is FRONTEND_ORIGIN
  assert.equal(checkoutReturnOrigin("http://localhost:3000", known, funnel), "http://localhost:3000");
  assert.equal(checkoutReturnOrigin(funnel, known, funnel), funnel);
  // Localhost on another port, or a look-alike, is still not trusted.
  for (const other of ["http://localhost:3001", "http://localhost.evil.example", "https://localhost:3000"]) {
    assert.equal(checkoutReturnOrigin(other, known, funnel), funnel);
  }
});
