# UniSwap: project context for Claude Code

Campus-only marketplace for verified `.edu.kh` students: buy, sell, trade (with a cash top-up for
uneven trades), give away, or post a "wanted" request. FYP 401 final year project, Fall 2026
(Prof. Chandan Mukherjee). Final deadline: **10 Nov 2026**.

- **Long Vathanak** (GitHub `vnak-1`): backend, database, integration, testing, docs
- **Dy Nobsokun** (GitHub `dy-nobsokun1`): UI/UX and core frontend

## Team rules (must follow)

@Agent.md

In short: ask before adding any package; keep diffs small and scoped; never commit secrets (the repo
is public); state a plan before multi-file changes; explain every change so the student can defend it.

## Repos and branches

- Upstream: `dy-nobsokun1/final-project`. Its `main` is still the old frontend-only layout.
- Fork: `vnak-1/final-project-backend`. Work happens on branch **`implement_backend`**, which still
  needs a PR into upstream `main`.
- Write descriptive commit messages (not "update"). Never commit `.env`, `node_modules/` or `.DS_Store`.

## Layout

- `frontend/`: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui.
  **This Next.js has breaking changes**: read `frontend/AGENTS.md` and `node_modules/next/dist/docs/`
  before writing Next code.
  - Only the Next.js server calls the API (`src/lib/api/http.ts`, `actions.ts`, `index.ts`); `API_URL`
    defaults to `http://localhost:4000`. The login JWT lives in the httpOnly cookie `uniswap_token`.
  - Shared types: `src/types/index.ts`. Labels and options: `src/lib/constants.ts`.
- `backend/`: Node.js 20.6+, Express 5, PostgreSQL, ES modules, plain JavaScript.
  - `src/app.js` mounts routes in `src/routes/`: auth, listings, bids, reviews, saved, offers, users,
    telegram, messages, uploads, payments (Stripe) and khqr.
  - `src/db/schema.sql`: tables `users`, `listings`, `messages`, `reviews` (from the proposal's ER
    diagram), plus `bids`, `offers`, `payments` and `saved_listings`. Query helpers sit beside it:
    `listings.js` (`LISTING_SELECT`, `buildBrowseQuery()` for browse/search), `auctions.js`,
    `matches.js`, `offers.js`, `payments.js`.
  - `src/utils/`: validation, scrypt password hashing, JWT, email (nodemailer), serializers
    (database snake_case → API camelCase, matching the frontend types).
  - The full API table is in `backend/README.md`. Keep it updated when routes change.

## Commands

```bash
# backend/  (needs PostgreSQL; copy .env.example to .env first)
npm run dev          # API on http://localhost:4000
npm test             # unit tests (node --test)
npm run test:api     # API tests: real HTTP against TEST_DATABASE_URL (a separate DB they wipe)
npm run db:setup     # recreate tables: WIPES ALL DATA
npm run db:seed      # demo data
npm run db:samples   # +60 sample items: hand-written with Commons/Flickr photos (credits in the JSON), Open Library textbooks, and five $1–$5 items for trying payments (-- --remove to undo)
npm run db:demo-deals # 9 finished deals for chanrithorn, for the profile stats (-- --remove to undo)
npm run email:test -- someone@aupp.edu.kh

# frontend/
npm run dev          # http://localhost:3000
npm run lint
npx tsc --noEmit
```

Demo users (password `password123`): `sokunth@aupp.edu.kh` and `chanrithorn@aupp.edu.kh` are
verified. `dara@aupp.edu.kh` is **unverified**, so its login returns 403 (useful for testing that flow).

**Cloud sessions** (claude.ai/code, the Claude app): `.claude/settings.json` runs `.claude/cloud-setup.sh`
at start and resume (it does nothing locally). It installs npm packages, starts the VM's PostgreSQL
with throwaway `uniswap` + `uniswap_test` databases and demo data, and writes `backend/.env` from
`.env.example`. Email, Stripe, Cloudinary, Telegram and Bakong stay off there: never put real keys in
the cloud environment (anyone using it can read them), and Bakong only answers Cambodian IPs anyway.
Its log: `/tmp/uniswap-cloud-setup.log`. Use the `implement_backend` branch. It creates the tables only
when `uniswap` has none, so an older `uniswap` database needs the upgrade SQL (backend/README.md,
"Upgrading an existing database to this version").

## How things work (non-obvious)

- **Auth:** sign-up accepts only `.edu.kh` and returns `{ email, verificationRequired: true }` with
  no token: nobody is signed in until the emailed link is opened. Registering again with an
  unverified email replaces that account; a verified one gets 409. Login is blocked (403) until
  verified. `resend-verification` takes `{ email, password }`. `requireAuth` re-checks in the
  database that the account exists and is verified.
- **Passwords:** `forgot-password` answers 200 `{ requested: true }` for every `.edu.kh` email and
  stores only a SHA-256 hash of the emailed token (`users.password_reset_hash`; 1 hour, single use,
  one email per account per 2 minutes while that link is unused). `reset-password` also verifies the
  email and returns no token. Reset and `change-password` also clear `users.telegram_link_code`. `requireAuth` refuses a JWT whose `iat` (whole seconds) is older than
  `users.password_changed_at`, or that has no `iat`, so a reset or a change signs out older sessions;
  `change-password` checks the current password and returns a fresh token. While email is off the
  reset link is printed in the API log (never once SMTP is set up, nor when `NODE_ENV=production`,
  which `render.yaml` sets); API tests read it with `loggedLinks` in `test/api/helpers.js`.
- **Email:** school Outlook / Microsoft 365 blocks password-based SMTP from apps. Send from Gmail
  (App Password, `smtp.gmail.com:465`) or Brevo; the recipients can still be `.edu.kh`. If sending
  fails, the verification link is printed in the API log.
- **Search:** full-text (`search_vector` generated column + GIN index), partial words (ILIKE with
  `%`/`_` escaped), and title typos (`pg_trgm`, `word_similarity >= 0.5`). Ranked title matches first
  (`inTitle` in `wordMatchSql`, plus title ILIKE or a related word on the title), then matches only in
  the description or category; within each, own words before related words only, then the score, then
  newest. So "laptop" lists the laptop RAM, then the ThinkPad and MacBook, then items that only mention
  a laptop. Wanted matching uses `matches`, never the title test.
  The typo test applies only to terms of 4+ characters (`TYPO_MIN_LENGTH`), so "ram" no longer finds
  "racket". Wanted matches share the rule. The two GPU samples' titles end in "graphics card" and their
  descriptions say "GPU", so "gpu" and "grafics card" find them.
  **Related words** (`db/relatedWords.js`, 14 hand-written groups): a term containing a group's word or
  phrase (whole words, plural "s" ignored) also searches the group's words, through full-text only, as
  one extra `$n` (`relatedSearch`). So "book" finds the textbooks, and "gpu", "nvidia" or "video card"
  the RTX and GTX cards. `broad` words ("book", "laptop") bring a group in but are not added for its other
  words. Only in `buildBrowseQuery` (browse, the
  suggestions and Ask UniSwap), never in wanted matches, which send alerts and stay strict.
  `GET /api/listings` also takes `limit` (1–100, default 100). The navbar's suggestions (`components/layout/SearchBox.tsx`,
  `SearchSuggestions.tsx`, `hooks/use-search-suggestions.ts`) call the Next Route Handler
  `app/api/search-suggestions`: 5 results, asked 250 ms after typing pauses, older requests aborted, and
  never any seller data. It is a Route Handler because Server Actions run one at a time and can't be cancelled.
- **Auctions:** `listing_type = 'auction'` + `auction_ends_at` + `min_increment`; `price` is the
  starting bid. Bids go through `POST /api/listings/:id/bids` (`routes/bids.js`), which locks the
  listing row (`SELECT … FOR UPDATE` in `withTransaction`) so simultaneous bids cannot both win.
  `server.js` runs `closeEndedAuctions()` every minute: an ended auction with bids becomes
  `reserved` (highest bid wins; on a tie, the earlier bid). After the first bid, type, price,
  end time and raise are locked (409). Every listing in the API has `auction: null | {...}`.
- **Notifications:** `utils/notify.js` (fire-and-forget, never throws). New message (first unread
  per thread only), outbid, auction won/ended, password changed, price drop on a saved listing
  (`notifyPriceDrop`, called from PATCH in `routes/listings.js`), new listing matching a wanted post
  (create only, not edits), offer made/accepted/declined/cancelled. Add new events there; Telegram
  can reuse it later.
- **Optional services** (`backend/src/services/`, plain `fetch`, no packages), each off until its env
  keys are set: Stripe Checkout **test mode only** (`routes/payments.js`; `markPaid` is idempotent and
  marks the item sold; the webhook needs the raw body, so it is mounted before `express.json` in
  `app.js`; Checkout shows `custom_text.submit` "UniSwap demo: no real money is charged." by Stripe's
  Pay button; `/confirm` expands `payment_intent.payment_method` and answers "paid" with `card { brand,
  last4 }` (`paidCard`, buyer only, never stored) for the banner's "Paid with Mastercard •••• 4444";
  the presenter types 5555 5555 5555 4444, see the root README's "Demo payments"), Cloudinary uploads, and a Telegram bot (long polling, linked through a one-time `/start`
  code). `notify.js` sends to Telegram as well as email. The public `GET /api/telegram` answers
  `{ enabled, botUrl }` for the home page's strip (`TelegramPromo`): "Sign in to connect" when signed
  out, "Connect Telegram" when not linked, "Open Telegram" (the bot chat) when linked. It is in the first
  HTML, and its X hides it only until the next page load. Deploy guide: `DEPLOY.md`; Render blueprint: `render.yaml`.
- **KHQR (Bakong), real money:** the buyer pays the seller's own Bakong account (`users.bakong_account_id`,
  set in Settings); UniSwap never holds money. `utils/khqr.js` builds the QR text by hand (no package;
  matches NBC's `bakong-khqr` library exactly, see `test/khqr.test.js`). `services/bakong.js` checks
  `check_transaction_by_md5`; `routes/khqr.js` + a once-a-minute check in `server.js` call `markPaid`
  (now keyed by payment id). That check covers QRs up to `CONFIRM_MINUTES` (35) old; at start-up and
  every 15 minutes it also re-checks unconfirmed ones up to `RECHECK_HOURS` (24) old. Before showing
  a QR, `POST /api/payments/khqr` calls `checkBakongReachable()` and answers 503 if Bakong does not
  answer, so nobody can pay a QR that could not be confirmed. `confirmOpenKhqrPayments(listingId)`
  (`db/payments.js`) asks Bakong about a listing's unconfirmed QRs and records the paid ones; it
  runs before a new QR or card checkout and before the owner marks the item sold or traded. `payments.method` is `stripe` or `khqr`. A payment confirmed after the
  item was already sold (or reserved for another buyer by an accepted offer) becomes `refund_due` (not `paid`); the listing is untouched and both people
  are told the seller must refund (`notifyLatePayment`). Bakong only accepts Cambodian
  IPs, so it does not work from Render. Token in `BAKONG_TOKEN`, expires 13 Jan 2027.
- **Deleting listings:** payments, reviews and offers are `ON DELETE CASCADE`, so `DELETE /api/listings/:id`
  refuses (409) when the listing is sold/traded, has reviews, has a paid or `refund_due` payment,
  has an unconfirmed payment that may still be confirmed (`RECHECK_HOURS`, 24, in `db/payments.js`,
  + 1 minute of slack), or is reserved by an accepted offer. It locks the listing row like `lockListingForPayment`, so no payment can start
  between the check and the delete. The owner's Delete button is hidden on sold and traded listings.
  `PATCH` refuses (409) to make a listing `active` again once it has a `paid` payment (checked on the
  row it re-reads under the lock): that sale's payment and reviews point at its buyer, so selling it
  again means a new listing. The README's "Known limitations" lists the payment rules kept on purpose.
- **Saved listings:** `saved_listings` (PK `user_id` + `listing_id`, cascades), `routes/saved.js`. Pages get
  hearts via `GET /api/users/me/saved/ids` and pass `savedIds` to `ListingGrid` (leave it out for grids of
  your own listings). `save_count` is in `LISTING_SELECT`; test helpers `skippedEmails()` and `waitFor()`
  read notifications. `getSavedListingIds` answers `[]` on any API error, so a failed lookup only
  empties the hearts.
- **Wanted matches:** `db/matches.js` (`findItemsForWanted` / `findWantedForItem` share one rule built on
  `wordMatchSql` from `db/listings.js`: search's full-text and typo tests on the wanted title minus a
  leading "Looking for"/"Wanted:" and then a leading article, same category or Other, item price within
  the wanted post's price as budget (0 = any), both active, different owners, verified posters);
  `GET /api/listings/:id/matches` (the owner's listing page shows it in `ListingMatches`); alerts from
  POST only (`notifyWantedMatches`: one message per student, at most 10 students).
- **Offers:** `routes/offers.js` + `db/offers.js`, table `offers` (pending/accepted/declined/withdrawn/
  cancelled); sale listings only, below the asking price; one pending offer per buyer (a new one
  withdraws the old); every offer change locks the listing row. Accept sets `listings.reserved_for` +
  `reserved`, declines the others, and is refused (409) while another buyer is paying. `amountToPay`
  lets only `reserved_for` pay, at `agreed_price` (from the accepted offer via `LISTING_SELECT`, never
  serialized) or the asking price if lower (`payableAmount` in the frontend mirrors it); `markPaid`
  makes anyone else's payment `refund_due` and declines pending offers when it sells. KHQR status
  says `unavailable` for other buyers' QRs once it is reserved, and for any QR whose amount is no longer what
  `amountToPay` would charge its buyer (a manual "Mark reserved" leaves QRs alone).
  `updateOffersForStatus` (PATCH, in a transaction) cancels on Make available again and declines
  pending offers when the item leaves `active`; PATCH also declines them when the type stops being
  `sale`. Mark as sold (offered on reserved items too) keeps `reserved_for`, which `findDealPartner`
  uses. While it is set, the type is locked and DELETE is refused.
- **Shopping assistant ("Ask UniSwap"):** `routes/assistant.js`, `utils/assistant.js` (prompt, tools, loop;
  the model is passed in, so `test/assistant.test.js` scripts a fake), and one adapter per provider, both
  plain `fetch`: `services/groq.js` (OpenAI-style `tool_calls`) and `services/gemini.js` (signed turns go
  back unchanged). `services/assistantModel.js` picks Groq when `GROQ_API_KEY` is set, else Gemini when
  `GEMINI_API_KEY` is set, else off (503); `ASSISTANT_PROVIDER=gemini|groq` forces one (restart the API;
  a forced provider without its key means off). Keep provider differences in the adapters; the loop uses
  neutral turns. Stateless: the frontend sends the conversation (plain `{ role, text }`) with every
  question. The model must call a tool (Groq `tool_choice: "required"`, Gemini `mode: "ANY"`):
  `search_listings` (browse search, active, no wanted posts or ended auctions, 5 results), then
  `reply { text, listingIds, wantedDraft }`; cards only for ids found in that question; at most 3 calls,
  the last reply-only.
  - **Retries** (`callModel` in `utils/assistant.js`):
    - A per-minute 429 waits as long as Groq says, plus 0.5 s, and retries that call once. A question
      waits at most 20 s in all (`MAX_WAIT_MS`).
    - A broken tool call is retried once straight away: a 400 `tool_use_failed`, arguments that aren't
      JSON, an unknown tool, or no reply on the last round.
    - A question gets at most 2 retries (`MAX_RETRIES`), so at most 5 calls and about 25 s.
    - Daily 429s and Gemini's 429s are never retried.
    - When several students wait at once, one can still be told it is busy.
  - **Wanted drafts:**
    - When nothing fits, the reply only *offers* a draft.
    - `wantedDraft` is filled only after the student says yes or asks for one, and all four of its fields are required.
    - `toWantedDraft` keeps a budget only if the student typed that number, and empties a description
      that holds a number they never typed.

  Groq default `qwen/qwen3.8-27b` (`openai/gpt-oss-120b` often answered in plain
  text instead of calling `reply`, which Groq refuses with a 400 `tool_use_failed`). Free: 30 requests a
  minute, 1,000 a day, 200K tokens a day, and its 429s name 7,000 input tokens a minute. At about 2.5K
  tokens a question that is roughly 3 questions a minute and 80 a day for the whole app. Gemini default `gemini-3.5-flash-lite` (the free tier gave
  about 20 requests a day by Oct 2026). A 429 says "in a minute" or "tomorrow". Never send either
  provider seller names or emails. API tests fake Groq and never call a real provider.
  Frontend: `/assistant` (`components/marketplace/Assistant*.tsx`).
  - The conversation is saved per tab in sessionStorage (`hooks/use-assistant-history.ts`, key
    `uniswap-assistant:<userId>`, newest 20). "New chat" and signing out clear it.
  - Each question sends only the newest 5 messages (`MESSAGES_SENT`, an odd number so the window starts
    with a question). That keeps Groq's per-minute token limit for new questions.

  A draft opens `/listings/new?type=buy_request&title=…`, which fills in `NewListingForm`.
- **Profile stats:** `GET /api/users/me/stats` (`db/stats.js`), for your own profile only; `/profile/[id]`
  shows nothing new. A deal is a listing now sold or traded, never a wanted post.
  - Your own listing is a sale (or trade). Someone else's is a purchase if you paid online, won the
    auction or had your offer accepted: `findDealPartner` without the chat rule.
  - Amount: the paid amount, else the winning bid, else the agreed price (or the asking price if lower),
    else the asking price. A giveaway is $0; a trade counts only its cash top-up, for the owner.
  - Date: `paid_at`, else `listings.sold_at` (PATCH and `markPaid` set it; PATCH clears it when the item
    goes back to active or reserved; other edits keep it). Months are in Phnom Penh time, last 6.
  - Shows from the start. A side with no deals shows only its totals and "No sales yet" / "No purchases
    yet", without its bars and ring (`StatsSection`, when its category list is empty). Badges at 5
    deals ("Active trader") and 10 ("Top seller").
  - `ProfileDashboard` and the `Stats*` components draw bars and a conic-gradient ring, no chart package.
    The ring's six colours (three brand, three chart-only `--chart-*` tokens in `globals.css`, each
    ≥3:1 on the card) are ordered so touching slices differ, also for red-green colour blindness.
  - `npm run db:demo-deals` (`-- --remove` undoes it) gives chanrithorn 9 deals over Aug–Oct for the demo.
- **Messaging:** there is no conversations table. A thread is all messages between two users about
  one listing (this follows the ER diagram).
- **Uploads:** `POST /api/uploads` with raw image bytes (max 5 MB; the form takes 4 MB, `MAX_PHOTO_MB`,
  because Vercel refuses requests over 4.5 MB), saved to `backend/uploads/`
  (git-ignored). Must move to Cloudinary before deploying, because Render wipes the disk on restart.
  A listing has up to 6 photos; `imageUrls[0]` is the cover. `validateListing` enforces `MAX_PHOTOS`,
  no duplicates and own-upload URLs only (`uploadedPhotoPrefix` in `routes/uploads.js`), but keeps
  photos the listing already has; a DB `CHECK` limits it to 6 too. The form uploads each photo when it
  is picked (`uploadListingPhoto`, `useListingPhotos`, `PhotoPicker`) and submits only the URLs, as
  hidden `imageUrls` inputs. The listing page shows them with `ListingGallery`.
- **Schema changes:** existing databases do not update themselves. For each change, provide an
  idempotent SQL snippet in `backend/README.md` (see the "Search" section) as well as editing `schema.sql`,
  and list it under "Upgrading an existing database to this version" (say if the new API needs it to start).
- **SQL safety:** always use `$1, $2…` parameters. Only whitelisted column names may be built into SQL.

## Status and roadmap

Done (week 5): auth with email verification, forgot/change password, listings CRUD with five types (incl. auction) and statuses,
ranked typo-tolerant search and filters, auctions/bidding, saved listings with price-drop alerts, up to 6 photos per listing, wanted match alerts, offers that reserve an item for the buyer, email + Telegram notifications, Stripe test payments, KHQR payments via Bakong, Cloudinary photos, profiles, per-listing messaging, photo
uploads; frontend fully wired to the API. Reviews and ratings once a listing is sold or traded,
between the owner and the buyer: whoever paid online, else the auction winner, else the buyer whose
offer was accepted, else (in-person deals) someone who chatted with the owner both ways (`reviewBlocker` in `routes/reviews.js`). API tests in `backend/test/api/`.

Done (week 6, 26–27 Oct):
- **Ask UniSwap**, the shopping assistant (Groq, with Gemini as the backup), with its `/assistant` chat page, a pill in the navbar and a link in the hero.
  - It waits and retries when Groq is busy, and retries once on a broken answer.
  - It drafts a wanted post only after the student says yes, using only what they said.
  - It keeps the chat until the tab closes, and has a "New chat" button.
- **Search suggestions:** typing in the navbar search box lists up to 5 matching items, with photos and prices.
- **Price filter:** type any min and max (`PriceRangeFilter`, still the `minPrice` / `maxPrice` URL params).
  It applies on Enter or when focus leaves both boxes, swaps min and max if needed, and Max 0 shows only
  $0 listings.
- **Home page polish:**
  - The hero says who UniSwap is for and how paying works ("Made for AUPP students", plus three points in `HeroPoints`).
  - The Telegram strip shows for everyone.
  - Wanted posts get their own dark, dashed card (`WantedCard`), and `HeroPhotos` skips them. It shows
    a large category icon (`CATEGORIES[].icon`) where the photo would be, a rose WANTED tag
    (`--brand-wanted`, the only rose), "Budget: up to $X" / "Budget: any" (`formatListingPrice`, so
    everywhere), and an "I have this →" pill (a span inside the card's link, hidden on your own posts).
- **Card payment polish:** the pay button says "Secure checkout by Stripe. Demo mode: no real money is
  charged." (no test card numbers on screen), and a returning buyer sees which card they paid with.
- **Profile stats dashboard:** your own profile always shows what you earned and spent per month and
  by category (zeros until the first deal).
- **Realistic sample data:** PC parts and everyday student items, with real photos.
- **Inbox and listing pages:**
  - Chat rows show the listing's photo and the last message.
  - The listing page has a phone buy bar.
  - The sell form picks the type with tiles.

Built but needs the team's own accounts/keys (see `DEPLOY.md`): Supabase database, Render + Vercel
deployment, Cloudinary photos, Stripe test payments, Telegram bot.

### Picking up on another machine

Everything above is pushed to `implement_backend`. Last full check (27 Oct):
- `npm test` (60) and `npm run test:api` (111) pass.
- The frontend's lint and `tsc --noEmit` are clean.
- `next build` passes (run on 27 Oct, at 835bd15, with no warnings).
After `git pull origin implement_backend`:

- No packages were added, but run `npm install` in `backend/` and `frontend/` if they are stale.
- Upgrade your local `uniswap` database: run the blocks under "Upgrading an existing database to this
  version" in `backend/README.md`, or `npm run db:setup && npm run db:seed` if it only holds demo
  data. The test database needs nothing: `npm run test:api` rebuilds it from `schema.sql`.
  The 27 Oct block adds `listings.sold_at`; the API needs it before it starts.
- For the profile stats demo, run `npm run db:demo-deals` (after `db:seed` and `db:samples`).
- To add new sample items, run plain `npm run db:samples`: it skips items already there and keeps the
  sellers. `-- --remove` deletes the `@demo.edu.kh` sellers and everything hanging off them, including
  their Bakong IDs and the demo deals, so only use it to start the samples over (then set the Bakong
  IDs and run `db:demo-deals` again).

### Next steps

1. **Try KHQR with real money, in Cambodia.** Put the team's `BAKONG_TOKEN` in `backend/.env` only
   (never in a committed file or a cloud environment). Add a Bakong account in Settings, pay a small
   amount from a second account, and check the item becomes sold.
   - On Long's machine the six `@demo.edu.kh` sample sellers have Long's own Bakong ID, set by SQL in
     the local database only (never in the repo), so their items show "Pay with KHQR". Paying one sends
     real money to Long and marks it sold: demo it with a cheap item.
2. **Open the PR** from `implement_backend` into `dy-nobsokun1/final-project` `main` (only when asked).
3. **Deploy** by following `DEPLOY.md`. Set up Cloudinary before Render, because Render wipes uploaded
   photos. A new Supabase database is built from `schema.sql`, so it needs no upgrade blocks.
   An Ask UniSwap question can take about 25 s when Groq makes it wait, so check that Vercel's function
   time limit allows that (Fluid compute allows far more; Hobby without it stops at 10 s).
4. **Demo: desktop first.** The demo is shown from a laptop on a projector whose size is unknown.
   - Check pages at 1280×800 and 1024×768 (older projectors, or 1280 zoomed to 125%).
   - Phone-only work is paused until after the demo.
   - Before the demo, try the room: the screen size macOS picks, the HDMI adapter, and how the pale greens look on the projector.
5. **Frontend follow-ups for Dy** (found in browser testing, not fixed yet):
   - a heart tapped while signed out should return to the listing after login;
   - `PhotoPicker` does not clear its error, and focus is lost after "Make cover";
   - `forms/NewListingForm.tsx` is 155 lines, over the ~100-line rule;
   - the offer panels still show the agreed amount after the seller cuts the price below it. The
     buyer pays the lower price, so only the text is wrong.
   - Phone sizes, paused until after the demo:
     - the navbar is too wide at about 768 px;
     - the hero fills the first screen, so no items show without scrolling;
     - the redesigned Wanted card (27 Oct) has not been checked at 375 px.
6. Later ideas (after the demo):
   - real-time chat;
   - safe meetup spots;
   - per-user notification preferences;
   - **dark mode.** The page is already the dark green field, so this means dark cards, forms and chat
     bubbles. `globals.css` has a `.dark` block that nothing turns on yet. A switch needs every
     light surface re-checked for contrast. Not before the demo: projectors show dark colours
     poorly, and the pale cards keep it readable.
