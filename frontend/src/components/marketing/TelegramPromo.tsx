import { Send } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { DismissibleTip } from "@/components/marketing/DismissibleTip";
import { getCurrentUser, getTelegramBotUrl } from "@/lib/api";
import { getTelegramStatus } from "@/lib/api/actions";

/** Set by the strip's X (DismissibleTip). Once it is there, the strip is left out of the page. */
const HIDE_COOKIE = "uniswap_hide_telegram_tip";

const ALERTS_TEXT = "Get new messages, outbids and price drops instantly.";

/**
 * What the strip says in each case. On phones the button shows only `label`, to keep the strip one
 * line tall; screen readers still hear `label` + `rest` ("Sign in to connect", "Open Telegram").
 */
interface Promo {
  text: string;
  href: string;
  label: string;
  rest: string;
}

/**
 * A slim strip on the home page about Telegram alerts, shown only when the API has a bot set up.
 * Signed-out visitors are asked to sign in, signed-in students not linked yet go to the Telegram
 * card in Settings, and linked students get a quick way to open the bot's chat. The X hides it for
 * good (DismissibleTip).
 */
export async function TelegramPromo() {
  const promo = await choosePromo();
  if (!promo) return null;
  // Only the linked case leaves the site (t.me), so only that one opens in a new tab.
  const external = promo.href.startsWith("https://");

  return (
    <DismissibleTip
      cookieName={HIDE_COOKIE}
      hideLabel="Hide Telegram tip"
      className="light-surface flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 sm:px-4"
    >
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
        <Send className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg leading-none tracking-wide sm:text-xl">Alerts on Telegram</p>
        {/* Hidden on phones to keep the strip one line tall there. */}
        <p className="hidden text-sm text-muted-foreground sm:block">{promo.text}</p>
      </div>
      {/* Dark, like the hero's "Browse listings": #E6F2DD on #22312D is 11.72:1. */}
      <Link
        href={promo.href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener" : undefined}
        className="shrink-0 rounded-lg bg-brand-deep px-3 py-2 text-sm font-semibold text-brand-50 transition-colors hover:bg-brand-900"
      >
        {promo.label}
        <span className="max-sm:sr-only">{promo.rest}</span>
      </Link>
    </DismissibleTip>
  );
}

/**
 * Which strip to show, or null for none. Any error means no strip, so a slow or broken API can
 * never take the home page down. (The page also wraps this in its own Suspense, so the rest of the
 * page never waits for it.)
 */
async function choosePromo(): Promise<Promo | null> {
  try {
    if ((await cookies()).has(HIDE_COOKIE)) return null;
    const [botUrl, user] = await Promise.all([getTelegramBotUrl(), getCurrentUser()]);
    if (!botUrl) return null;
    if (!user) return { text: ALERTS_TEXT, href: "/login", label: "Sign in", rest: " to connect" };

    // getTelegramStatus answers { enabled: false } on any error.
    const { enabled, connected } = await getTelegramStatus();
    if (!enabled) return null;
    if (connected) {
      return { text: "Your Telegram alerts are on.", href: botUrl, label: "Open", rest: " Telegram" };
    }
    return { text: ALERTS_TEXT, href: "/settings#telegram", label: "Connect", rest: " Telegram" };
  } catch (error) {
    console.error(error);
    return null;
  }
}
