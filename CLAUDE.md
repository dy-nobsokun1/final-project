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

- `origin` / upstream: `dy-nobsokun1/final-project`. Its `main` is still the old frontend-only layout.
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
  - `src/app.js` mounts routes in `src/routes/`: auth, listings, users, messages, uploads.
  - `src/db/schema.sql`: tables `users`, `listings`, `messages`, `reviews` (from the proposal's ER
    diagram). `src/db/listings.js`: `buildBrowseQuery()` for browse/search.
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
Its log: `/tmp/uniswap-cloud-setup.log`. Use the `implement_backend` branch.

## How things work (non-obvious)

- **Auth:** sign-up accepts only `.edu.kh` and returns `{ email, verificationRequired: true }` with
  no token: nobody is signed in until the emailed link is opened. Registering again with an
  unverified email replaces that account; a verified one gets 409. Login is blocked (403) until
  verified. `resend-verification` takes `{ email, password }`. `requireAuth` re-checks in the
  database that the account exists and is verified.
- **Email:** school Outlook / Microsoft 365 blocks password-based SMTP from apps. Send from Gmail
  (App Password, `smtp.gmail.com:465`) or Brevo; the recipients can still be `.edu.kh`. If sending
  fails, the verification link is printed in the API log.
- **Search:** full-text (`search_vector` generated column + GIN index), partial words (ILIKE with
  `%`/`_` escaped), and title typos (`pg_trgm`, `word_similarity >= 0.5`). Ranked best match first.
- **Auctions:** `listing_type = 'auction'` + `auction_ends_at` + `min_increment`; `price` is the
  starting bid. Bids go through `POST /api/listings/:id/bids` (`routes/bids.js`), which locks the
  listing row (`SELECT … FOR UPDATE` in `withTransaction`) so simultaneous bids cannot both win.
  `server.js` runs `closeEndedAuctions()` every minute: an ended auction with bids becomes
  `reserved` (highest bid wins; on a tie, the earlier bid). After the first bid, type, price,
  end time and raise are locked (409). Every listing in the API has `auction: null | {...}`.
- **Notifications:** `utils/notify.js` (fire-and-forget, never throws). New message (first unread
  per thread only), outbid, auction won/ended. Add new events there; Telegram can reuse it later.
- **Optional services** (`backend/src/services/`, plain `fetch`, no packages), each off until its env
  keys are set: Stripe Checkout **test mode only** (`routes/payments.js`; `markPaid` is idempotent and
  marks the item sold; the webhook needs the raw body, so it is mounted before `express.json` in
  `app.js`), Cloudinary uploads, and a Telegram bot (long polling, linked through a one-time `/start`
  code). `notify.js` sends to Telegram as well as email. Deploy guide: `DEPLOY.md`; Render blueprint: `render.yaml`.
- **KHQR (Bakong), real money:** the buyer pays the seller's own Bakong account (`users.bakong_account_id`,
  set in Settings); UniSwap never holds money. `utils/khqr.js` builds the QR text by hand (no package;
  matches NBC's `bakong-khqr` library exactly, see `test/khqr.test.js`). `services/bakong.js` checks
  `check_transaction_by_md5`; `routes/khqr.js` + a once-a-minute check in `server.js` call `markPaid`
  (now keyed by payment id). That check covers QRs up to `CONFIRM_MINUTES` (35) old; at start-up and
  every 15 minutes it also re-checks unconfirmed ones up to `RECHECK_HOURS` (24) old. Before showing
  a QR, `POST /api/payments/khqr` calls `checkBakongReachable()` and answers 503 if Bakong does not
  answer, so nobody can pay a QR that could not be confirmed. `payments.method` is `stripe` or `khqr`. A payment confirmed after the
  item was already sold becomes `refund_due` (not `paid`); the listing is untouched and both people
  are told the seller must refund (`notifyLatePayment`). Bakong only accepts Cambodian
  IPs, so it does not work from Render. Token in `BAKONG_TOKEN`, expires 13 Jan 2027.
- **Deleting listings:** payments and reviews are `ON DELETE CASCADE`, so `DELETE /api/listings/:id`
  refuses (409) when the listing is sold/traded, has reviews, has a paid or `refund_due` payment,
  or has a payment started within `CONFIRM_MINUTES` (35, `db/payments.js`) + 1 minute of slack. It
  locks the listing row like `lockListingForPayment`, so no payment can start between the check and
  the delete. The owner's Delete button is hidden on sold and traded listings.
- **Messaging:** there is no conversations table. A thread is all messages between two users about
  one listing (this follows the ER diagram).
- **Uploads:** `POST /api/uploads` with raw image bytes (max 5 MB), saved to `backend/uploads/`
  (git-ignored). Must move to Cloudinary before deploying, because Render wipes the disk on restart.
- **Schema changes:** existing databases do not update themselves. For each change, provide an
  idempotent SQL snippet in `backend/README.md` (see the "Search" section) as well as editing `schema.sql`.
- **SQL safety:** always use `$1, $2…` parameters. Only whitelisted column names may be built into SQL.

## Status and roadmap

Done (week 5): auth with email verification, listings CRUD with five types (incl. auction) and statuses,
ranked typo-tolerant search and filters, auctions/bidding, email + Telegram notifications, Stripe test payments, KHQR payments via Bakong, Cloudinary photos, profiles, per-listing messaging, photo
uploads; frontend fully wired to the API. Reviews and ratings once a listing is sold or traded,
between the owner and the buyer: whoever paid online, else the auction winner, else (in-person
deals) someone who chatted with the owner both ways (`reviewBlocker` in `routes/reviews.js`). API tests in `backend/test/api/`.

Built but needs the team's own accounts/keys (see `DEPLOY.md`): Supabase database, Render + Vercel
deployment, Cloudinary photos, Stripe test payments, Telegram bot.

Possible next steps: real-time chat, safe meetup spots, and per-user notification preferences.
