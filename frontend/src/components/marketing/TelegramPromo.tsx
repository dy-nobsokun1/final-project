import { Send } from "lucide-react";
import Link from "next/link";
import { DismissibleTip } from "@/components/marketing/DismissibleTip";
import { getCurrentUser, isTelegramEnabled } from "@/lib/api";
import { getTelegramStatus } from "@/lib/api/actions";

/**
 * The strip's button for each case. On phones only `label` shows, to keep the strip one line tall;
 * screen readers still hear the whole text ("Sign in to connect", "Connect Telegram").
 */
const BUTTONS = {
  signedOut: { href: "/login", label: "Sign in", rest: " to connect" },
  notLinked: { href: "/settings#telegram", label: "Connect", rest: " Telegram" },
} as const;

/**
 * A slim strip on the home page telling students they can get alerts on Telegram. Shown only when
 * the API has a bot set up: signed-out visitors are asked to sign in, and signed-in students whose
 * account is not linked yet go to the Telegram card in Settings. Linked students see nothing.
 * The X hides it for good (DismissibleTip).
 */
export async function TelegramPromo() {
  const state = await promoState();
  if (!state) return null;
  const button = BUTTONS[state];

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
      {/* Dark, like the hero's "Browse listings": #E6F2DD on #22312D is 11.72:1. */}
      <Link
        href={button.href}
        className="shrink-0 rounded-lg bg-brand-deep px-3 py-2 text-sm font-semibold text-brand-50 transition-colors hover:bg-brand-900"
      >
        {button.label}
        <span className="max-sm:sr-only">{button.rest}</span>
      </Link>
    </DismissibleTip>
  );
}

/**
 * Which strip to show, or null for none. Any error means no strip, so a slow or broken API can
 * never take the home page down. (The page also wraps this in its own Suspense, so the rest of the
 * page never waits for it.)
 */
async function promoState(): Promise<keyof typeof BUTTONS | null> {
  try {
    if (!(await getCurrentUser())) return (await isTelegramEnabled()) ? "signedOut" : null;
    const { enabled, connected } = await getTelegramStatus();
    return enabled && !connected ? "notLinked" : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
