# UniSwap Backend

REST API for UniSwap, built with **Node.js + Express 5 + PostgreSQL**, as described in the
project proposal (Section 4, Methodology).

## Setup

Requires Node.js 20.6+ and PostgreSQL 13+ (local, or a free Supabase database).

```bash
cd backend
npm install
cp .env.example .env      # then edit DATABASE_URL and JWT_SECRET
npm run db:setup          # creates the tables (drops existing data!)
npm run db:seed           # optional demo data; every demo user's password is "password123"
npm run dev               # http://localhost:4000, restarts on file changes
npm test                  # unit tests (Node's built-in test runner)
npm run test:api          # API tests against a separate test database (see Testing below)
```

Check it works: `curl http://localhost:4000/api/health` → `{"status":"ok"}`

### Verification emails (optional)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS` in `.env` (see `.env.example`) to email
the verification link when someone registers. Until then, the link is printed in the server log.

- **School Outlook / Microsoft 365:** `smtp.office365.com`, port `587`, your normal password. Only
  works if the school allows "SMTP AUTH" for your mailbox; Microsoft is phasing it out.
- **Gmail:** `smtp.gmail.com`, port `465`, with a Google App Password (needs 2-Step Verification).

Check the settings with `npm run email:test -- you@university.edu.kh`. It logs in, sends one test
email, and prints the mail server's reply if something is refused.

## Folder layout

```
backend/
├── scripts/            db-setup.js (create tables), db-seed.js (demo data), check-email.js
├── src/
│   ├── server.js       starts the HTTP server
│   ├── app.js          Express app: middleware + routes
│   ├── config.js       reads environment variables
│   ├── db/             schema.sql, connection pool, shared listing query
│   ├── middleware/     requireAuth (JWT), CORS, error handler
│   ├── routes/         auth, listings, bids, reviews, users, messages, payments, telegram, uploads
│   └── utils/          validation, password hashing, tokens, JSON serializers, email
└── test/               unit tests; test/api/ holds the API tests (see Testing)
```

## Database

Tables follow the ER diagram in the proposal (Figure 2): `users`, `listings`, `messages`,
`reviews`. See [`src/db/schema.sql`](src/db/schema.sql). Allowed values are enforced twice, in
the API (`utils/validation.js`) and in the database (`CHECK` constraints):

- **category:** textbooks, electronics, furniture, clothing, bikes, other
- **condition:** new, like_new, good, fair
- **listing type:** sale, buy_request, trade, giveaway, auction
- **status:** active, reserved, sold, traded

### Search

`GET /api/listings?query=...` matches a listing when any of these is true (see `buildBrowseQuery`
in [`src/db/listings.js`](src/db/listings.js)):

1. **Full-text search** on title, description and category, ignoring word endings
   ("textbook" finds the textbooks category). Uses a `search_vector` column that PostgreSQL keeps up to date.
2. **Part of a word:** "mac" finds "MacBook".
3. **Typos in a title word**, using the `pg_trgm` extension: "frige" finds "fridge".

With a search term, results are sorted best match first, and title matches rank above description matches.
Without one, they are sorted newest first.

**Upgrading a database created before search was added?** Either re-run `npm run db:setup` (wipes data),
or keep your data by running this once in `psql` or the Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS search_vector TSVECTOR GENERATED ALWAYS AS (
  setweight(to_tsvector('english', title), 'A')
  || setweight(to_tsvector('english', description), 'B')
  || setweight(to_tsvector('english', category), 'C')
) STORED;
CREATE INDEX IF NOT EXISTS listings_search_idx ON listings USING GIN (search_vector);
```

### Auctions

A listing with `listingType: "auction"` takes bids until `auctionEndsAt` (at most 30 days away).
Its `price` is the starting bid.

- The first bid must be at least the starting price. Every later bid must beat the highest by
  `minIncrement` (default $1).
- The seller cannot bid. The current leader cannot bid again until someone outbids them.
- Bids lock the listing row (`SELECT ... FOR UPDATE` in a transaction), so two bids placed at the same
  moment are handled one after the other, never both "winning".
- After the first bid, the seller cannot change the type, price, end time or minimum raise.
- Once a minute, `closeEndedAuctions()` (`src/db/auctions.js`, run from `server.js`) marks each ended
  auction that has bids as `reserved`. The highest bidder wins, and on a tie the earlier bid wins.
  The buyer and seller then arrange the handover in chat. An auction with no bids stays `active`,
  so the seller can extend it or change its type.
- Every listing in API responses has an `auction` field: `null`, or
  `{ endsAt, ended, minIncrement, highestBid, leadingBidderId, bidCount }`.

**Upgrading a database created before auctions?** Run this once in `psql` or the Supabase SQL editor.
It keeps your data, and running it twice is safe:

```sql
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_listing_type_check;
ALTER TABLE listings ADD CONSTRAINT listings_listing_type_check
  CHECK (listing_type IN ('sale', 'buy_request', 'trade', 'giveaway', 'auction'));
ALTER TABLE listings ADD COLUMN IF NOT EXISTS auction_ends_at TIMESTAMPTZ;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS min_increment NUMERIC(10, 2) NOT NULL DEFAULT 1
  CHECK (min_increment > 0);
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_auction_needs_end;
ALTER TABLE listings ADD CONSTRAINT listings_auction_needs_end
  CHECK (listing_type <> 'auction' OR auction_ends_at IS NOT NULL);
CREATE TABLE IF NOT EXISTS bids (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bidder_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bids_listing_idx ON bids (listing_id, amount DESC);
```

### Reviews

Once a listing is marked `sold` or `traded`, its owner and a person they dealt with can rate each
other: 1 to 5 whole stars and an optional comment of up to 1000 characters.

- "Dealt with" means both people wrote at least one message about that listing. Someone who asked
  a question but got no reply cannot review, and neither can a stranger.
- One review per person per listing (`UNIQUE (listing_id, reviewer_id)` in `schema.sql`).
- A profile lists every review the user received, with their average rounded to one decimal place.
- The `reviews` table was already in the ER diagram, so existing databases need no upgrade.

### Email notifications

`src/utils/notify.js` emails people when something happens (using the same SMTP settings as the
verification email):

| Event | Who gets it | Link in the email |
|---|---|---|
| New chat message | The receiver. Only the first unread message in a thread emails; reading the thread re-arms it | The chat thread |
| Outbid | The person who just lost the highest bid | The auction |
| Auction ended with bids | The winner ("You won…") and the seller ("ended at $…") | Their chat with each other |

Notifications never block or break the request that caused them: if email is not configured they
are skipped with a log line, and send failures are logged, not returned to the user. User-written
text (messages, names, titles) is HTML-escaped in the email.

### Payments, photos and Telegram (optional services)

Each one is switched off until its keys are in `.env` (see `.env.example`). Setup steps are in
[`../DEPLOY.md`](../DEPLOY.md). None of them needs an npm package: `src/services/` calls each
service's web API with `fetch`.

- **Stripe Checkout, test mode only** (`services/stripe.js`, `routes/payments.js`). An item for sale,
  or an auction you won, can be paid by card on Stripe's own page. The amount comes from
  `utils/payments.js`. When the buyer returns, `/confirm` asks Stripe whether they paid. The
  webhook (with a verified signature) covers buyers who close the tab. Both call `markPaid`, which
  only acts once, marks the listing sold and notifies both people. While one buyer is checking out
  (30 minutes), others get 409. Live keys are refused.
- **KHQR through Bakong, real money** (`utils/khqr.js`, `services/bakong.js`, `routes/khqr.js`).
  Sellers add their Bakong account ID (e.g. `name@aclb`) in Settings. A buyer then gets a one-time
  KHQR for the exact amount, scans it with any Cambodian banking app, and the money goes straight to
  the seller: UniSwap never holds it. `utils/khqr.js` writes the QR text itself (EMVCo fields plus a
  CRC-16 checksum, checked against the National Bank's own library in `test/khqr.test.js`). Bakong
  finds a payment by the MD5 of that text, so the QR screen asks `GET /api/payments/khqr/:id` every
  5 seconds, and `server.js` checks open QRs once a minute for buyers who close the page. Both call
  `markPaid`. A QR expires after 30 minutes, the same lock as Stripe. Bakong only answers requests
  from Cambodian IP addresses, so this works when the API runs in Cambodia (see `DEPLOY.md`).
- **Cloudinary** (`services/cloudinary.js`): signed uploads. Without it, photos go to `backend/uploads/`.
- **Telegram** (`services/telegram.js`, `routes/telegram.js`, `utils/telegramBot.js`). Settings gives
  a one-time `t.me/<bot>?start=<code>` link. The bot (long polling, so no public URL is needed)
  links the chat. After that, every notification goes to Telegram as well as email.

**Upgrading a database created before payments and Telegram?** Run this once. It keeps your data and is safe to re-run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code TEXT UNIQUE;
CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  stripe_session_id TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payments_listing_idx ON payments (listing_id, status);
```

**Upgrading a database created before KHQR?** Run this once (after the block above). It keeps your data and is safe to re-run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS bakong_account_id TEXT CHECK (length(bakong_account_id) <= 32);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'stripe' CHECK (method IN ('stripe', 'khqr'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS khqr TEXT;
ALTER TABLE payments ALTER COLUMN stripe_session_id DROP NOT NULL;
```

## API

Send JSON. Routes marked 🔒 need the header `Authorization: Bearer <token>` (the token comes from register or login).

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | API + database health check |
| POST | `/api/auth/register` | `{ name, email, password, major?, graduationYear? }`. Only `.edu.kh` emails. Emails a verification link; nobody is signed in yet |
| POST | `/api/auth/login` | `{ email, password }` → `{ user, token }`. `403` until the email is verified |
| POST | `/api/auth/verify-email` | `{ token }` → verifies the email, which unlocks signing in |
| POST | `/api/auth/resend-verification` | `{ email, password }` → emails a new verification link (the old one stops working) |
| GET 🔒 | `/api/auth/me` | The logged-in user |
| GET | `/api/listings` | Browse and search (ranked, typo tolerant; see Search above). Query: `query`, `category`, `condition`, `type`, `minPrice`, `maxPrice`, `status` (default `active`) |
| GET | `/api/listings/:id` | One listing, with seller info |
| POST 🔒 | `/api/listings` | `{ title, category, condition, description?, listingType?, price?, cashTopup?, imageUrls?, auctionEndsAt?, minIncrement? }`. `auctionEndsAt` (ISO date) is required for an auction |
| PATCH 🔒 | `/api/listings/:id` | Owner only. Any subset of fields, e.g. `{ "status": "sold" }` |
| DELETE 🔒 | `/api/listings/:id` | Owner only |
| GET | `/api/listings/:id/bids` | An auction's bids, highest first, with bidder name |
| POST 🔒 | `/api/listings/:id/bids` | `{ amount }`. Place a bid (see Auctions above) |
| GET | `/api/listings/:id/reviews` | Reviews about this listing's deal (at most one per person) |
| POST 🔒 | `/api/listings/:id/reviews` | `{ revieweeId, rating, comment? }`. 1-5 stars, once the listing is sold or traded (see Reviews above) |
| GET | `/api/users/:id/reviews` | `{ reviews, averageRating, reviewCount }`: reviews the user received, newest first |
| GET | `/api/payments/config` | `{ enabled, khqr }`: whether card and KHQR payments are switched on |
| POST 🔒 | `/api/payments/checkout` | `{ listingId }` → `{ url }` of Stripe's payment page |
| POST 🔒 | `/api/payments/confirm` | `{ sessionId }` → `{ status: "paid" \| "pending" }`, checked with Stripe |
| POST | `/api/payments/webhook` | Called by Stripe only, with a signature check |
| POST 🔒 | `/api/payments/khqr` | `{ listingId }` → `{ paymentId, qr, amount, expiresAt }`. Asking again within 30 minutes returns the same QR. `400` if the seller has no Bakong account |
| GET 🔒 | `/api/payments/khqr/:id` | Buyer only → `{ status: "paid" \| "pending" \| "expired" }`, checked with Bakong |
| GET 🔒 | `/api/users/me/telegram` | `{ enabled, connected }` |
| POST 🔒 | `/api/users/me/telegram` | `{ link }`: one-time link that opens the bot |
| DELETE 🔒 | `/api/users/me/telegram` | Disconnect Telegram |
| GET | `/api/users/:id` | Public profile (email hidden) |
| GET | `/api/users/:id/listings` | All listings by a user |
| PATCH 🔒 | `/api/users/me` | `{ name?, major?, graduationYear?, bio?, avatarUrl?, bakongAccountId? }`. `bakongAccountId` is `name@bank`; `""` or `null` removes it |
| GET 🔒 | `/api/messages/conversations` | My chat threads with unread counts |
| GET 🔒 | `/api/messages?listingId=&withUserId=` | One thread, oldest first |
| POST 🔒 | `/api/messages` | `{ listingId, receiverId, body }` |
| PATCH 🔒 | `/api/messages/read` | `{ listingId, withUserId }` → mark a thread read |
| POST 🔒 | `/api/uploads` | Raw image bytes with `Content-Type: image/jpeg`, `png`, `webp` or `gif` (max 5 MB) → `{ url }` |

Uploaded photos are saved in `backend/uploads/` (git-ignored) and served at `/uploads/<file>`.
Put the returned `url` in a listing's `imageUrls`.

JSON field names match the frontend types in `frontend/src/types/index.ts` (camelCase).
Errors always look like `{ "error": "message", "details": { "field": "message" } }`.

## Testing

- `npm test` runs the unit tests in `test/*.test.js`: validation, the search query builder, the
  Stripe and Cloudinary helpers, and the KHQR builder and Bakong answers. No database or network needed.
- `npm run test:api` runs the API tests in `test/api/`. Each file starts the real app on a free port
  and sends it real HTTP requests, so routes, SQL and database rules are tested together: sign-up and
  verification, owner-only changes, messaging, bidding (including five bids at the same moment),
  payments with Stripe switched off, KHQR payments (with Bakong replaced by a fake), and reviews.

The API tests need their own database, because `test/api/reset-db.js` wipes it before every run.
Create it once, then put its URL in `.env` as `TEST_DATABASE_URL` (see `.env.example`):

```bash
createdb uniswap_test                                      # local PostgreSQL
docker exec <container> createdb -U <user> uniswap_test    # PostgreSQL in Docker
```

The tests refuse to run if `TEST_DATABASE_URL` is the same database as `DATABASE_URL`. They switch
off email, Stripe, Bakong, Telegram and Cloudinary, so a test run never sends anything.

## Security

- **SQL injection:** every query uses `$1, $2, ...` parameters, never string concatenation.
- **Passwords:** hashed with scrypt (Node's built-in `crypto`) plus a random salt; never returned by the API.
- **Verified members only:** an account cannot sign in until the link sent to its `.edu.kh` address is opened, so a
  made-up or borrowed email gets nowhere. An unverified sign-up is replaced if the email registers again, so a
  stranger cannot block the real owner. Every protected request re-checks that the account exists and is verified.
- **Auth:** signed JWTs expire after 7 days; listings can only be changed or deleted by their owner.
- **Privacy:** emails and Bakong account IDs appear only on your own account, never on public
  profiles. (A buyer does see the seller's Bakong account inside the KHQR, as with any bank transfer.)
- **Secrets:** live in `.env` (git-ignored). Nothing secret is committed.

## Progress

What is built, tested and still to do is kept in one place: the Status section of the
[root README](../README.md).
