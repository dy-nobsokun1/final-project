import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { app } from "./app.js";
import { config } from "./config.js";
import { closeEndedAuctions } from "./db/auctions.js";
import { findOpenKhqrPayments, markPaid } from "./db/payments.js";
import { assistantModel } from "./services/assistantModel.js";
import { isBakongConfigured, isKhqrPaid } from "./services/bakong.js";
import { isCloudinaryConfigured } from "./services/cloudinary.js";
import { isStripeConfigured } from "./services/stripe.js";
import { isTelegramConfigured, startTelegramPolling } from "./services/telegram.js";
import { startTunnelWatch } from "./services/tunnel.js";
import { isEmailConfigured } from "./utils/email.js";
import { notifyAuctionClosed } from "./utils/notify.js";
import { handleBotUpdate, setUpBotCommands } from "./utils/telegramBot.js";

app.listen(config.port, () => {
  console.log(`UniSwap API running on http://localhost:${config.port}`);
  // Which optional services are switched on (each needs its keys in .env).
  const onOff = (enabled) => (enabled ? "on" : "off");
  console.log(`  email ${onOff(isEmailConfigured)} · photos ${isCloudinaryConfigured ? "Cloudinary" : "local disk"}`
    + ` · card payments ${onOff(isStripeConfigured)} · KHQR ${onOff(isBakongConfigured)}`
    + ` · Telegram ${onOff(isTelegramConfigured)} · assistant ${assistantModel?.name ?? "off"}`);
});

// With TUNNEL_METRICS_URL set, follow the cloudflared tunnel's current address for emailed and Telegram links.
startTunnelWatch();

// Telegram: the bot's menu (utils/telegramBot.js), and "/start <code>" messages that link accounts.
// Only one running copy of the API may poll per bot token, so do not run it locally and on Render
// with the same token.
if (isTelegramConfigured) {
  void setUpBotCommands();
  void startTelegramPolling(handleBotUpdate);
}

// Once a minute, hand each ended auction to its highest bidder. Bids are already refused the
// moment an auction ends; this only flips the listing's status to "reserved".
const AUCTION_CHECK_MS = 60 * 1000;

async function runAuctionCheck() {
  try {
    for (const closed of await closeEndedAuctions()) {
      console.log(`[auction] "${closed.title}" won by ${closed.winner_id} for $${closed.amount}`);
      notifyAuctionClosed(closed);
    }
  } catch (error) {
    console.error("[auction] could not close ended auctions:", error.message);
  }
}

void runAuctionCheck();
setInterval(runAuctionCheck, AUCTION_CHECK_MS);

// Also once a minute, ask Bakong about KHQR payments still waiting. The QR screen already checks
// every few seconds; this covers a buyer who pays and then closes the page. The first run and every
// 15th one also re-check older unconfirmed QRs (up to RECHECK_HOURS), so a payment whose confirmation
// was held up (e.g. the token expired, or the API was off) is still recorded once checks work again.
const KHQR_CHECK_MS = 60 * 1000;
const OLDER_KHQR_EVERY = 15;
let khqrRuns = 0;
let isKhqrCheckRunning = false;
let didLastKhqrCheckFail = false; // then the next run re-checks older QRs too, once Bakong is back

async function runKhqrCheck() {
  if (isKhqrCheckRunning) return; // the previous run is still waiting for Bakong
  isKhqrCheckRunning = true;
  try {
    const includeOlder = didLastKhqrCheckFail || khqrRuns % OLDER_KHQR_EVERY === 0;
    khqrRuns += 1;
    didLastKhqrCheckFail = false;
    for (const payment of await findOpenKhqrPayments({ includeOlder })) {
      try {
        if (await isKhqrPaid(payment.khqr)) await markPaid(payment.id);
      } catch (error) {
        didLastKhqrCheckFail = true;
        console.error(`[bakong] could not check payment ${payment.id}:`, error.message);
      }
    }
  } finally {
    isKhqrCheckRunning = false;
  }
}

if (isBakongConfigured) {
  const runSafely = () => runKhqrCheck().catch((error) => console.error("[bakong]", error.message));
  void runSafely();
  setInterval(runSafely, KHQR_CHECK_MS);
}
