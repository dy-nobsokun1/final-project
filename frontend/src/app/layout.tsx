import type { Metadata } from "next";
import { Bebas_Neue, Nunito } from "next/font/google";
import { cookies } from "next/headers";
import { AppProviders } from "@/components/providers/AppProviders";
import { getCurrentUser } from "@/lib/api";
import { THEME_COOKIE } from "@/lib/theme";
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
  // Dark mode is opt-in: only the cookie the navbar switch sets turns it on, so there is no flash on load.
  const isDark = (await cookies()).get(THEME_COOKIE)?.value === "dark";

  return (
    <html
      lang="en"
      className={`${display.variable} ${nunito.variable} h-full antialiased${isDark ? " dark" : ""}`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders initialUser={user}>{children}</AppProviders>
      </body>
    </html>
  );
}
