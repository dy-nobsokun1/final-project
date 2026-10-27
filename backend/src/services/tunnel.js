import { config } from "../config.js";

// A free `cloudflared tunnel` gets a new trycloudflare.com address every time it starts. When it runs
// with `--metrics 127.0.0.1:20241`, it reports the current address on /quicktunnel, so the API can
// follow it instead of someone editing FRONTEND_ORIGIN by hand after every restart. Only used while
// TUNNEL_METRICS_URL is set; otherwise siteOrigin() is simply FRONTEND_ORIGIN.

const POLL_MS = 15 * 1000;
const TIMEOUT_MS = 2000;
// A plain host name (letters, digits, dots, dashes). Whatever else cloudflared might answer is ignored,
// so nothing odd can end up inside an emailed link.
const HOSTNAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

/**
 * Remembers the tunnel's address. `fetchImpl` and `log` are passed in so tests need no network.
 * origin() is synchronous: it answers with the last poll's result, so building a link never waits.
 */
export function createTunnelWatcher({ metricsUrl, fallbackOrigin, fetchImpl = fetch, log = console.log }) {
  let current = fallbackOrigin;
  let lastLogged = null;

  async function readHostname() {
    try {
      const response = await fetchImpl(new URL("/quicktunnel", metricsUrl), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) return null;
      const { hostname } = await response.json();
      return typeof hostname === "string" && HOSTNAME.test(hostname) ? hostname : null;
    } catch {
      return null; // cloudflared is not running yet, or is restarting
    }
  }

  /** Asks cloudflared once. Logs a line only when the address links use has changed. */
  async function poll() {
    const hostname = await readHostname();
    current = hostname ? `https://${hostname}` : fallbackOrigin;
    if (current !== lastLogged) {
      lastLogged = current;
      log(hostname ? `[tunnel] links now use ${current}` : `[tunnel] cloudflared not answering; links use ${current}`);
    }
  }

  return { poll, origin: () => current };
}

const watcher = config.tunnelMetricsUrl
  ? createTunnelWatcher({ metricsUrl: config.tunnelMetricsUrl, fallbackOrigin: config.frontendOrigin })
  : null;

/** The address to build links with: the tunnel's current one while cloudflared answers, else FRONTEND_ORIGIN. */
export function siteOrigin() {
  return watcher ? watcher.origin() : config.frontendOrigin;
}

/** One check now (the start-up call in server.js, and the one-off live check). Does nothing without TUNNEL_METRICS_URL. */
export async function pollTunnel() {
  await watcher?.poll();
}

/** Checks now and then every 15 seconds. Does nothing without TUNNEL_METRICS_URL. */
export function startTunnelWatch() {
  if (!watcher) return;
  void pollTunnel();
  setInterval(pollTunnel, POLL_MS);
}
