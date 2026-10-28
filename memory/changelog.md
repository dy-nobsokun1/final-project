# UniSwap Engineering Progress & Handover Log

Log of completed tasks, architecture decisions, and bug fixes for the UniSwap team.

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
