import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Completely hides the Next.js dev tools indicator icon on the webpage
  devIndicators: false,

  // Dev only: lets a phone open `npm run dev` through a Cloudflare quick tunnel
  // (cloudflared tunnel --url http://localhost:3000) or a Tailscale Funnel
  // (tailscale funnel --bg 3000, an address like uniswap.tail1234.ts.net). Without it, `next dev`
  // refuses the dev resources for that host. "*" matches one part of the name and "**" any number,
  // so the two-part Tailscale name needs "**". Ignored in production.
  allowedDevOrigins: ["*.trycloudflare.com", "**.ts.net"],
  experimental: {
    serverActions: {
      // Listing photos go through a Server Action. The API accepts up to 5 MB,
      // plus a little room for the form's multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
