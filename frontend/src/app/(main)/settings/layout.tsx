import type { Metadata } from "next";

// The settings page is a Client Component ("use client"), and only Server Components may export
// metadata. This layout is a Server Component around it, so it gives the browser tab its title.
export const metadata: Metadata = { title: "Settings | UniSwap" };

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return children;
}
