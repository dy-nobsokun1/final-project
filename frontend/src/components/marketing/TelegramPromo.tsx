import { Send } from "lucide-react";
import Link from "next/link";
import { DismissibleTip } from "@/components/marketing/DismissibleTip";
import { getCurrentUser } from "@/lib/api";
import { getTelegramStatus } from "@/lib/api/actions";

/**
 * A slim strip on the home page telling students they can get alerts on Telegram, linking to the
 * Telegram card in Settings. Shown only to signed-in students whose account is not linked yet, and
 * only when the API has a bot set up. The API answers that for signed-in users only, so signed-out
 * visitors never see it. The X hides it for good (DismissibleTip).
 */
export async function TelegramPromo() {
  if (!(await shouldShow())) return null;

  return (
    <DismissibleTip
      storageKey="uniswap.hideTelegramTip"
      hideLabel="Hide Telegram tip"
      className="light-surface flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4"
    >
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
        <Send className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg leading-none tracking-wide sm:text-xl">Alerts on Telegram</p>
        {/* Hidden on phones to keep the strip one line tall there. */}
        <p className="hidden text-sm text-muted-foreground sm:block">
          Get new messages, outbids and price drops instantly.
        </p>
      </div>
      {/* Dark, like the hero's "Browse listings": #E6F2DD on #22312D is 11.72:1. On phones it shows
          just "Connect"; screen readers still hear "Connect Telegram". */}
      <Link
        href="/settings#telegram"
        className="shrink-0 rounded-lg bg-brand-deep px-3 py-2 text-sm font-semibold text-brand-50 transition-colors hover:bg-brand-900"
      >
        Connect<span className="max-sm:sr-only"> Telegram</span>
      </Link>
    </DismissibleTip>
  );
}

/**
 * Any error means no strip, so a slow or broken API can never take the home page down. (The page
 * also wraps this in its own Suspense, so the rest of the page never waits for it.)
 */
async function shouldShow(): Promise<boolean> {
  try {
    if (!(await getCurrentUser())) return false;
    const { enabled, connected } = await getTelegramStatus();
    return enabled && !connected;
  } catch (error) {
    console.error(error);
    return false;
  }
}
