# UniSwap Engineering Progress & Handover Log

Log of completed tasks, architecture decisions, and bug fixes for the UniSwap team.

## 4 Nov 2026

### Two items visible in dark mode
- The inbox unread dot (`ConversationRow`) is pale in dark mode, 8.6:1 on the card (was 2.1:1), and the Telegram strip's icon (`TelegramPromo`) is black on its pale circle, 18.1:1 (was 1:1). Only `dark:` classes, so light mode is unchanged.

### Dark mode back to its 2 Nov design
- Dark mode is back to how it looked on 2 Nov (`8a0c841`). The two redesigns stay in history (`49b90a6` depth, `e79a4c3` colour mix); revert the revert commits to bring one back.

### "More from <seller>" readable in light mode
- On Recent purchases, the outline button filled with the dark page colour under black text (1.5:1). `PurchaseCard` now gives it a pale fill like `SaveButton`: black text 18.1:1, border 3.6:1 on the light card and 3.4:1 on the dark one.

### Enter sends a chat message
- In `MessageComposer`, Enter sends through the form's own `handleSubmit` (`requestSubmit()`); Shift+Enter adds a line. Enter is ignored while an IME is composing, while sending, and while voice input is not idle.

### Live chat (Server-Sent Events)
- New messages show at once on the other person's open thread and in their inbox, no reload, no package. `GET /api/messages/stream` (Express, in-memory hub `utils/liveHub.js`) behind the Next Route Handler `app/api/messages/stream`; the thread page merges live messages by id; the inbox refreshes on each one.
- No new-message email or Telegram while the receiver has that thread open. If the stream fails, chat works as before.
- Checked with two demo users through `next start`, also through the Tailscale address (the event arrived in about 0.2 s), and after an API restart. Tests: 86 unit, 142 API.

## 2 Nov 2026

### Cash top-up on trades
- The sell form now has a cash top-up box for trades, and the listing page shows it. The API and database already stored it, but students could not enter it before. Checked with a temporary trade on the live site, created through the form, edited and deleted.

### Sign-up is AUPP only
- `validateRegistration` and `RegisterForm` accept only `@aupp.edu.kh`. The database CHECK and `forgot-password` still take any `.edu.kh`, so the `@demo.edu.kh` sample sellers keep working. This narrows the proposal's `.edu.kh` rule, on purpose.

### KHQR upload removed
- We built an "Upload your KHQR" button in Settings to read an ABA payment ID from a picture. It did not work in the real test, so we removed it and the `jsqr` package. Sellers type their Bakong app ID, as before. The code is in git history (`a9bc2d9` to `656721a`).

### Notification messages
- Each event in `notify.js` now has one description, drawn by `utils/notificationEmail.js` and `utils/notificationTelegram.js`. Who gets notified, and when, is unchanged.
- `buildInvoiceHtml` is gone. `sendTelegramDocument` stays, unused. One real test email reached a school Outlook Inbox. Real Telegram display is not confirmed yet.

### Dark mode (opt-in)
- Navbar Sun/Moon button sets the `uniswap_theme` cookie and the `dark` class on `<html>`; the root layout renders it, so no flash. Default look unchanged; frontend only, no packages.
- Dark values live in `globals.css` tokens (`.dark .light-surface` for cards); a few components swapped hard-coded pale fills for tokens. Dark rules are screen-only, so receipts print light.

### Review fixes: receipt, Telegram, sell form, RLS
- **Receipt**: `GET /api/payments/receipt/:listingId` shows a receipt only to the buyer and seller of a paid listing; the listing page ignores the `?invoice=` value, so a made-up link shows nothing. Shows the amount really paid, dated in Phnom Penh time.
- **Telegram**: `/start <code>` sends one plain confirmation with no menu; unlinked chats are told how to connect; unknown commands show the menu instead of searching.
- **Sell form**: validates again; demo helpers only with `NEXT_PUBLIC_DEMO_PRESETS=true`. **RLS**: `schema.sql` keeps row level security on all tables.
- Tests: 78 unit, 134 API.

## 28 Oct 2026

### 1. Reset Sold Items (`db:reset-sold`)
- **Problem**: Testing real payments/checkout with actual money marked items as `"sold"`, preventing repeat checkout testing. Manually setting `status = 'active'` directly in SQL was blocked or reverted by check constraints (`listings_reserved_for_not_active`), DB port differences (port 5433 vs 5432), and lingering payment rows.
- **Solution**:
  - Created `backend/scripts/db-reset-sold.js`.
  - Added script to `backend/package.json`: `"db:reset-sold": "node --env-file=.env scripts/db-reset-sold.js"`.
- **Behavior**:
  - Reverts test-bought items back to `'active'`, clearing `sold_at = NULL` and `reserved_for = NULL`.
  - Deletes linked payments, test reviews, and test offers.
  - Automatically preserves the 9 simulated demo deals created by `db:demo-deals.js` for Chanrithorn's profile stats dashboard.
  - Supports `--all` flag (`npm run db:reset-sold -- --all`) if the developer wants to reset all sold listings including the 9 demo deals.

### 2. Outlook Authentication & SMTP Investigation
- **Findings**:
  - Microsoft 365 / Exchange Online blocks basic password-based SMTP authentication by default (`535 5.7.139 Authentication unsuccessful`). Modern OAuth2 is required, so standard school Outlook accounts cannot send automated system emails from Nodemailer without OAuth2 configuration.
  - Registration strictly enforces Cambodian university emails ending in `.edu.kh` via frontend regex, backend `isCampusEmail()`, and database check constraint `email LIKE '%.edu.kh'`. Personal `@outlook.com` accounts cannot register.
  - Configured Gmail App Password fallback for development testing.

### 3. Telegram Payment Receipt Formatting & Wiring Fix
- **Files**: `backend/src/utils/notify.js`, `backend/src/services/telegram.js`
- **Changes**:
  - Formatted payment confirmation notifications (`notifyPaid`) with structured HTML invoice details (invoice number, item title, date, parties, amount) and inline action buttons (message button and view receipt button) for both buyer and seller.
  - Fixed `deliver()` and `telegramTo()` in `notify.js` to accept and forward custom `telegram: { html, buttons }` payloads instead of dropping them.
  - Updated `sendTelegramMessage()` in `telegram.js` to pass `options` (`parse_mode: 'HTML'`) and render inline action buttons.
  - Verified live delivery directly to Telegram test chat.

### 4. Hide Next.js Dev Indicator
- **File**: `frontend/next.config.ts`
- **Changes**: Added `devIndicators: false` to hide the floating Next.js dev tools indicator icon from the browser window during development and presentations.

### 5. Telegram Invoice View & Download Feature
- **Problem**: The "📥 Download Invoice" button in Telegram notifications was not functioning because target route had no receipt card.
- **Solution**:
  - Created `frontend/src/components/listings/InvoiceReceiptCard.tsx`: Dedicated official payment receipt card displaying invoice number, issuance date, seller, buyer, item title, verified payment badge, and a "Print / Save as PDF" button.
  - Wired `InvoiceReceiptCard` into `frontend/src/app/(main)/listings/[id]/page.tsx` when `invoice` searchParam is present.
  - Verified that tapping "Download Invoice" opens the official receipt and triggers the native PDF download/print dialog.

### 6. Direct Invoice Document Delivery via Telegram Bot
- **Files**: `backend/src/services/telegram.js`, `backend/src/utils/notify.js`
- **Solution**:
  - Added `sendTelegramDocument(chatId, { filename, content, contentType, caption, buttons })` in `backend/src/services/telegram.js` using Node's native `fetch`, `FormData`, and `Blob`.
  - Implemented `buildInvoiceHtml()` in `backend/src/utils/notify.js`.
  - Added unit test in `backend/test/services.test.js` for `sendTelegramDocument`. All tests pass.

### 7. Telegram Payment Receipt Notification Refinement
- **File**: `backend/src/utils/notify.js`
- **Changes**: Buyer Telegram notifications streamlined to clean transaction summary message with 3 inline buttons (`📥 Download Invoice`, `🌐 Check in Website`, `💬 Message <Seller>`).

### 8. Presentation Demo Helpers (Chatbot UX Tab-to-Fill & Photography)
- **Files**: `frontend/src/lib/demo-presets.ts`, `frontend/src/components/forms/NewListingForm.tsx`, `frontend/src/hooks/use-listing-photos.ts`
- **Solution**:
  - Preloaded realistic demo presets for all 5 listing types (`sale`, `auction`, `trade`, `giveaway`, `buy_request`).
  - Chatbot-style faded placeholder text with <kbd>Tab</kbd>-to-fill UX.
  - Instant zero-flicker photo upload cache via `presetUploadCache`.

### 9. Supabase Database Migration & Local Fallback Configuration
- **Connection**:
  - Supabase Project: `fhuugsgczcgtxeywiati` (AWS Singapore, `ap-southeast-1`).
  - Pooler: `aws-0-ap-southeast-1.pooler.supabase.com:5432` with username `postgres.fhuugsgczcgtxeywiati`.
- **Migration Script (`backend/scripts/migrate-to-supabase.js`)**:
  - Added npm command: `"db:to-supabase": "node --env-file=.env scripts/migrate-to-supabase.js"`.
  - Applies `backend/src/db/schema.sql` and copies all data tables.
- **Verification**: All 10 users, 75 listings, bids, offers, and payments active on Supabase.

### 10. Telegram Outbid Notifications & IPv4 Socket Autoselection Fix
- **Solution**:
  - Added `dns.setDefaultResultOrder('ipv4first')` to `backend/src/server.js`.
  - Added `--no-network-family-autoselection` flag to Node startup scripts.
  - Attached `pool.on('error', ...)` handler in `backend/src/db/pool.js`.
  - Verified live Telegram delivery of outbid alerts directly to active user account.

### 11. Presentation Demo Card Helper & Reversion in PayButton
- **Solution**: Reverted `frontend/src/components/listings/PayButton.tsx` to clean original UI with `Pay [price] with card` button.

### 12. Manager Persona & Memory Organization
- **Solution**:
  - Centralized project memory into `memory/` directory (`rules.md`, `manager.md`, `changelog.md`, `index.md`).
  - Updated root `Agent.md` to act as universal beacon for Codex, Claude, Gemini, and Cline.

## 2 Nov 2026

### 1. Re-open Demo Auctions (RTX 3090, City Bike, Calculus)
- **Problem**: In UniSwap, auctions automatically close when `auction_ends_at <= now()`. Because the original test dates were in late October (e.g., Oct 30 for the RTX 3090), the countdown naturally expired, causing the UI to show "bidding closed" and the API to block new bids.
- **Solution**:
  - Re-opened `Gigabyte RTX 3090 Eagle OC 24GB graphics card` (`9ff9e789-bb59-4b9e-bd91-936bd2e824b7`) with starting price `$450`, `$10` minimum raise, `status = 'active'`, and `auction_ends_at` extended by 7 days to `2026-11-09`.
  - Cleared lingering test bids so the RTX 3090 is completely clean for demo bidding.
  - Also extended active demo auctions (`Teal city bike` at $40, `Calculus: Early Transcendentals` at $10) by 7 days.
  - Preserved the 9 simulated demo deals for Chanrithorn Lim.
  - Applied updates to both live Supabase pooler and local PostgreSQL fallback.

### 2. Make Listing Description Optional in NewListingForm
- **Problem**: When creating or editing a listing in `NewListingForm.tsx`, the form required `description.length >= 20` characters, blocking users from creating quick listings with short or empty descriptions.
- **Solution**:
  - Removed the 20-character minimum constraint in `frontend/src/components/forms/NewListingForm.tsx`.
  - Updated field label to `Description (optional)`.
  - Confirmed backend and database schema already support optional descriptions (`description TEXT NOT NULL DEFAULT ''`).
  - Verified frontend Turbopack build and backend test suite.


