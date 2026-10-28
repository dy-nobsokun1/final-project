# Gemini Progress & Handover Log

Log of recent tasks, scripts, and bug fixes completed during Gemini sessions.

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
  - Current `backend/.env` was pointed at Gmail (`mrznak88k@gmail.com`), whose App Password was expired/revoked (`535-5.7.8 BadCredentials`). Provided steps for generating a fresh Google App Password via 2-Step Verification.

### 3. Telegram Payment Receipt Formatting & Wiring Fix
- **Files**: `backend/src/utils/notify.js`, `backend/src/services/telegram.js`
- **Changes**:
  - Formatted payment confirmation notifications (`notifyPaid`) with structured HTML invoice details (invoice number, item title, date, parties, amount) and inline action buttons (message button and view receipt button) for both buyer and seller.
  - Fixed `deliver()` and `telegramTo()` in `notify.js` to accept and forward the custom `telegram: { html, buttons }` payload instead of dropping it.
  - Updated `sendTelegramMessage()` in `telegram.js` to pass `options` (`parse_mode: 'HTML'`) and render inline action buttons.
  - Verified live delivery directly to Telegram test chat.

### 4. Hide Next.js Dev Indicator
- **File**: `frontend/next.config.ts`
- **Changes**: Added `devIndicators: false` to permanently hide the floating Next.js dev tools indicator icon from the browser window during development.

### 5. Telegram Invoice View & Download Feature
- **Problem**: The "📥 Download Invoice" button in Telegram notifications was not functioning:
  1. The link target (`/listings/:id?invoice=:invoiceNo`) had no corresponding component or invoice handling in the frontend.
  2. The link was attempting to open an expired trycloudflare address before being updated to Tailscale (`https://uniswap.tailcff82d.ts.net`).
- **Solution**:
  - Created `frontend/src/components/listings/InvoiceReceiptCard.tsx`: A dedicated official payment receipt card displaying invoice number, issuance date, seller, buyer, item title, verified payment badge, and a "Print / Save as PDF" button.
  - Wired `InvoiceReceiptCard` into `frontend/src/app/(main)/listings/[id]/page.tsx` when `invoice` searchParam is present.
  - Verified that tapping "Download Invoice" opens the official receipt and triggers the native PDF download/print dialog.

### 6. Direct Invoice Document Delivery via Telegram Bot
- **Problem**: Users wanting immediate access to invoice documents had to click a link out of Telegram to the web app.
- **Solution**:
  - Added `sendTelegramDocument(chatId, { filename, content, contentType, caption, buttons })` in `backend/src/services/telegram.js` using Node's native `fetch`, `FormData`, and `Blob` (zero new dependencies).
  - Implemented `buildInvoiceHtml()` in `backend/src/utils/notify.js`: A clean, responsive, self-contained HTML invoice matching UniSwap's branding with an embedded "Print / Save as PDF" trigger.
  - Updated `notifyPaid()` and `telegramTo()` to deliver the standalone invoice document file directly into the buyer's Telegram chat alongside the transaction message.
  - Configured 3-button inline keyboard for buyer receipts: `[ 📥 Download Invoice ]` (web receipt), `[ 🌐 Check in Website ]` (listing page), and `[ 💬 Message <Seller> ]` (direct chat thread).
  - Added unit test in `backend/test/services.test.js` for `sendTelegramDocument`. All 78 tests pass.
  - Verified live document delivery directly to Telegram chat (`@uniswap88k_bot`).

### 7. Telegram Payment Receipt Notification Refinement
- **File**: `backend/src/utils/notify.js`
- **Changes**:
  - In `notifyPaid`, removed the direct file attachment (`document: { ... }`) from the buyer's Telegram notification payload so that buyers receive only the clean, concise transaction summary message with inline action buttons.
  - Updated `buyerTelegramHtml` to remove the mention of the attached document while preserving the reminder to message the seller to arrange the campus handover.
  - Maintained the 3 inline action buttons for the buyer:
    1. `📥 Download Invoice` (link to `/listings/:id?invoice=:invoiceNo`)
    2. `🌐 Check in Website` (link to `/listings/:id`)
    3. `💬 Message <Seller>` (link to `/messages/:id_:sellerId`)
  - Verified all 78 backend unit tests pass (`npm test`).
  - Tested live delivery to Telegram chat `980224652` confirming successful receipt of the formatted message and 3 buttons without any file attachments.

### 8. Presentation Demo Helpers (Chatbot UX Tab-to-Fill & Fresh Web Photography)
- **Problem**: Live presentation requires the presenter to quickly demonstrate creating listings across all 5 types (`sale`, `auction`, `trade`, `giveaway`, `buy_request`) without slow manual typing or empty form friction, while maintaining authentic campus realism and eliminating visual flickering.
- **Solution**:
  1. **Demo Presets (`frontend/src/lib/demo-presets.ts`)**:
     - Fresh, authentic, non-AI real camera photography URLs from Unsplash for all 5 listing types:
       - `sale`: "Calculus: Early Transcendentals, 9th ed." ($45, `textbooks`, `like_new`, user's authentic physical textbook photo `/listings/demo-calculus.png`)
       - `auction`: "City Bike (Single-speed, 26-inch)" (Starting bid $50, min increment $5, ends in 3 days, `bikes`, `good`, Unsplash bicycle)
       - `trade`: "RGB Mechanical Keyboard (TKL)" ($0, `electronics`, `good`, Unsplash mechanical keyboard)
       - `giveaway`: "Metal Desk Lamp (Adjustable)" ($0, `other`, `good`, Unsplash desk lamp)
       - `buy_request`: "Compact Dorm Mini-Fridge" ($30 budget, `other`, `good`, Unsplash mini-fridge)
  2. **Faded Text that Turns Darker on Tab (Chatbot UX)**:
     - In `frontend/src/components/forms/NewListingForm.tsx`, fields start empty `""`, displaying the demo preset in a faded grey placeholder (`placeholder:text-foreground/45`).
     - Pressing <kbd>Tab</kbd> in an empty field fills the field with the preset text (turning it into dark, solid text) and advances focus naturally to the next field (<kbd>Title</kbd> -> <kbd>Description</kbd> -> <kbd>Price</kbd> -> <kbd>Submit</kbd>).
     - In `handleSubmit`, any un-tabbed empty field automatically falls back to the preset value so validation always passes during the live demo.
  3. **Zero Flickering & Smooth Photo Previews (`use-listing-photos.ts`)**:
     - Tracked `lastLoadedType.current` via `useRef` to eliminate redundant fetches on renders.
     - Implemented `presetUploadCache` to cache uploaded URLs by source image URL for instant, zero-latency preset switching.
     - Provided instant object-URL previews so the photo thumbnail never flashes "Uploading..." or unmounts.
  4. **Persistent Photo Dismissal (`photoDismissedRef`)**:
     - When the user clicks the close/remove button on the dummy photo, `photoDismissedRef.current` is set to `true`.
     - The dummy photo stays closed and is never automatically re-populated when changing listing types or editing fields during that session. It only reappears when the user reloads the page.
- **Verification**:
  - `npm run build` in `frontend/` succeeds with zero errors (Turbopack, TypeScript).
  - `npm test` in `backend/` passes all 78 tests.

### 9. Supabase Database Migration & Local Fallback Configuration
- **Objective**: Migrate project schema and all live database rows (users, listings, bids, offers, payments, messages, saved listings) from local PostgreSQL to Supabase cloud while keeping local Postgres on port 5433 as an active fallback.
- **Connection Details**:
  - Supabase Project: `fhuugsgczcgtxeywiati` (AWS Singapore, `ap-southeast-1`).
  - Connection Pooler: `aws-0-ap-southeast-1.pooler.supabase.com:5432` with username `postgres.fhuugsgczcgtxeywiati`.
  - Password URL Encoding: Any special characters (such as `@`) in database passwords must be percent-encoded (`%40`) to prevent connection URI host parsing breaks.
- **Migration Script (`backend/scripts/migrate-to-supabase.js`)**:
  - Added npm command: `"db:to-supabase": "node --env-file=.env scripts/migrate-to-supabase.js"`.
  - Applies `backend/src/db/schema.sql` to initialize extensions (`pg_trgm`) and clean tables.
  - Automatically queries `information_schema.columns` to exclude PostgreSQL generated columns (`search_vector GENERATED ALWAYS`) during insert operations.
  - Sequentially migrates all tables with parameterized queries and `ON CONFLICT DO NOTHING`.
- **Active Environment Configuration**:
  - `LOCAL_DATABASE_URL=postgres://uniswap:uniswap@localhost:5433/uniswap`
  - `SUPABASE_DATABASE_URL=postgresql://postgres.fhuugsgczcgtxeywiati:[REDACTED_PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
  - Active `DATABASE_URL` configured in `backend/.env`.
- **Verification**:
  - Migration copied: 10 users, 75 listings, 6 bids, 3 offers, 7 payments, 2 messages, 3 saved listings.
  - Full-text search vector (`search_vector @@ plainto_tsquery('english', 'calculus')`) verified and operational in Supabase.
  - Backend running on Supabase (`/api/health` returns `status: ok`, `/api/listings` serves live data).
  - All 78 backend unit tests pass.

### 10. Telegram Outbid Notifications & IPv4 Socket Autoselection Fix
- **Problem**:
  1. The user placed a bid ($460) on an auction and was outbid ($470), but received no outbid notification on Telegram.
  2. Because the account (`2023229long@aupp.edu.kh`) was freshly registered on Supabase via web UI at 10:42 AM, its `telegram_chat_id` was initially `NULL` (unlinked).
  3. Node 24 on macOS was failing Telegram API fetches with `fetch failed` / `ETIMEDOUT` because Node's network family autoselection (Happy Eyeballs) hung trying `api.telegram.org`'s IPv6 address on an IPv4-only network.
  4. Remote idle client disconnections on Supabase pooler crashed Node due to missing `pool.on('error')` handler.
- **Solution**:
  - Added `dns.setDefaultResultOrder('ipv4first')` to `backend/src/server.js`.
  - Added `--no-network-family-autoselection` flag to Node startup in `backend/package.json` (`dev`, `start`) and `backend/scripts/start-detached.js`.
  - Attached `pool.on('error', ...)` handler in `backend/src/db/pool.js` to absorb idle remote client resets without crashing the process.
  - Linked Telegram chat ID `980224652` directly to the active user account in Supabase.
  - Verified live Telegram delivery of outbid alerts directly to `@longvathanak88k` (message ID 52).
  - Silenced `/start` command in `backend/src/utils/telegramBot.js` so linking connects quietly without sending automatic greetings or pop-up menus.
  - All 78 tests pass.

### 11. Presentation Demo Card Helper & Reversion in PayButton
- **Problem**: Earlier, an interactive Demo Test Card helper box was added to `PayButton.tsx`. The user requested to remove this helper box and restore the clean UI for `PayButton.tsx`.
- **Solution**:
  - Reverted `frontend/src/components/listings/PayButton.tsx` to its clean original UI with `Pay [price] with card` button, original text note (`Secure checkout by Stripe. Demo mode: no real money is charged.`), and clean error handling.
  - Removed all unused icons (`Check`, `Copy`, `Sparkles`), unused state (`copiedField`), copy handler (`copyText`), and `DEMO_CARD_PRESET` import.
  - Verified `npm run build` in `frontend/` succeeds with 0 errors (Turbopack, TypeScript).

### 13. Manager Persona Adoption & Work Delegation Framework
- **Role**: Established the Engineering Manager & Technical Lead persona documented in `MANAGER.md`.
- **Workflow**:
  1. Deconstruct incoming high-level user goals into structured sub-tasks across Frontend, Backend, Database, and QA.
  2. Plan execution respecting project rules (`Agent.md`, `.edu.kh` email constraints, shadcn/Tailwind, zero-dependency policy, 9 demo deal preservation).
  3. Delegate tasks systematically to specialized agents or execution streams.
  4. Enforce quality gates (`npm test` in backend, `npm run build` in frontend) before delivery.

### 14. Continuous Git Commit Policy & Remote Push Reminders
- **Rule**: Per user instruction on 28 Oct 2026, all completed tasks and updates must be committed to the repository upon completion.
- **Push Reminders**: The manager persona will periodically track commits ahead of `origin/implement_backend` and remind the user to push to `implement_backend` branch.









