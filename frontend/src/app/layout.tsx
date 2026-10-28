import type { Metadata } from "next";
import { Bebas_Neue, Nunito } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { getCurrentUser } from "@/lib/api";
import "./globals.css";

/** Display face for the big, condensed headings. */
const display = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

/** Text face for body copy, labels and controls. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "UniSwap",
  description: "Buy and sell with students on your campus.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read the session cookie once on the server so the navbar knows who is signed in.
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${display.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders initialUser={user}>{children}</AppProviders>
      </body>
    </html>
  );
}
