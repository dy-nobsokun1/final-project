"use client";

import { useLinkStatus } from "next/link";

/**
 * Goes inside a `<Link>`. While that link's page is loading it adds the hidden
 * `data-browse-pending` marker, which makes the browse page dim its results (see `app/(main)/page.tsx`).
 */
export function LinkPendingMarker() {
  const { pending } = useLinkStatus();
  return pending ? <span data-browse-pending hidden /> : null;
}
