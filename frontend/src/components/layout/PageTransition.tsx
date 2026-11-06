"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

/**
 * A quick crossfade between pages (experimental, 6 Nov). Next.js runs every page change as a React
 * transition, so React can animate it with the browser's View Transitions API: the old page fades
 * out where it was while the new one fades in (`page-out` / `page-in` in globals.css).
 * - The key is the path, so only a change of page counts as an exit and an enter. A search or
 *   filter (same path, new `?q=`), router.refresh() and live updates are plain updates, and
 *   `default="none"` keeps those still.
 * - React's `ViewTransition` comes from the React 19.3 canary that Next.js 16 bundles for the App
 *   Router, not from the react 19.2.8 package. Browsers without View Transitions just swap pages.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
