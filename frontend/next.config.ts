import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a phone open `npm run dev` through a Cloudflare quick tunnel
  // (cloudflared tunnel --url http://localhost:3000) or a Tailscale Funnel
  // (tailscale funnel --bg 3000, an address ending in .ts.net). Without it, `next dev` refuses
  // the dev resources for that host. Ignored in production.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ts.net"],
  experimental: {
    serverActions: {
      // Listing photos go through a Server Action. The API accepts up to 5 MB,
      // plus a little room for the form's multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
