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
npm run db:samples        # optional: 81 more realistic items (see "Sample listings" below)
npm run dev               # http://localhost:4000, restarts on file changes
npm test                  # unit tests (Node's built-in test runner)
npm run test:api          # API tests against a separate test database (see Testing below)
```

Check it works: `curl http://localhost:4000/api/health` → `{"status":"ok"}`

### Sample listings

`npm run db:samples` adds 81 realistic items to the database you already have (it wipes nothing and
skips items it added before), posted by 6 demo students whose emails end in `@demo.edu.kh` (password
`password123`). `npm run db:samples -- --remove` deletes those students and everything they posted.

The items come from two free public datasets, saved in `scripts/sample-listings.json` so loading
needs no internet: electronics, clothing, furniture, scooters, sports and kitchen items from
[DummyJSON](https://dummyjson.com) (a fake product API made for prototypes), and textbooks from
[Open Library](https://openlibrary.org) (public-domain book data). `scripts/fetch-sample-listings.js`
rebuilt that file: it maps them to our categories, prices them second-hand, varies the condition, and
makes a few giveaways, trades, wanted posts and 2 auctions. Photos stay on those two sites (the
listings store their URLs), so no third-party images are copied into this repository.

### Verification emails (optional)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS` in `.env` (see `.env.example`) to email
the verification link when someone registers. Until then, the link is printed in the server log.
Password-reset links use the same settings. Whenever SMTP is not configured, the reset link is
printed in the server log too, except when `NODE_ENV=production` (`render.yaml` sets it), where only
a warning is printed. Once email is configured it is never printed, not even when sending fails
(anyone who reads the log could otherwise take over the account).

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
│   ├── db/             schema.sql, connection pool, shared listing query, wanted-post matching, offer helpers
│   ├── middleware/     requireAuth (JWT), CORS, error handler
│   ├── routes/         auth, listings, bids, offers, reviews, saved, users, messages, payments, telegram, uploads, assistant
│   └── utils/          validation, password hashing, tokens, JSON serializers, email
└── test/               unit tests; test/api/ holds the API tests (see Testing)
```

## Database

### Upgrading an existing database to this version

A database made with `npm run db:setup` before this version does not update itself, and running
`db:setup` again would wipe it. To keep your data, run these upgrade blocks once (in `psql` or the
Supabase SQL editor) **before** starting the new API. They do not depend on each other, so any order
works, and each one is safe to re-run:

1. [Passwords](#passwords): `requireAuth` reads `users.password_changed_at`, so without it every
   signed-in request fails.
2. [Saved listings](#saved-listings): every listing query counts saves in `saved_listings`, so without
   it browsing and every listing page fail.
3. [Offers](#offers): every listing query also reads `offers` and `listings.reserved_for`, and
   `markPaid` reads `reserved_for`, so without it listing pages fail and no payment can be recorded.

Also recommended: [Photos](#photos), which adds the database's own limit of 6 photos per listing. The
API already enforces that limit, so the new API starts without it.

This assumes the database already has the earlier upgrades further down (search, auctions, payments
and Telegram, KHQR, `refund_due`); if not, run those first. **Claude Code cloud sessions** too:
`.claude/cloud-setup.sh` creates the tables only while the `uniswap` database has none, so a session
that kept an older `uniswap` database needs these blocks as well (its address is
`postgres://postgres:postgres@localhost:5432/uniswap`). Since it only holds demo data,
`npm run db:setup && npm run db:seed` works too.

### Tables

Tables follow the ER diagram in the proposal (Figure 2): `users`, `listings`, `messages`,
`reviews`. `saved_listings` was added for saved listings, and `offers` (with `listings.reserved_for`)
for price offers; neither is in the ER diagram (see Saved listings and Offers below). See
[`src/db/schema.sql`](src/db/schema.sql). Allowed values are enforced twice, in
the API (`utils/validation.js`) and in the database (`CHECK` constraints):

- **category:** textbooks, electronics, furniture, clothing, bikes, other
- **condition:** new, like_new, good, fair
- **listing type:** sale, buy_request, trade, giveaway, auction
- **status:** active, reserved, sold, traded

### Passwords

**Forgot password.** `POST /api/auth/forgot-password` emails a `/reset-password?token=...` link.
Forgot-password itself gives the same answer for every campus address, whether or not it has an
account. That alone does not hide who has one: registering an address that already has a verified
account answers 409.

- Only a SHA-256 hash of the link's token is stored (`users.password_reset_hash`), so a leaked
  database or backup holds no usable link.
- The link works once, for 1 hour. While it is unused, an account gets at most one email every 2
  minutes; a request in between sends nothing and the earlier link keeps working. Once the link has
  been used, a new one can be asked for straight away (e.g. after mistyping the new password). A
  newer email replaces the older link.
- Unverified accounts get a link too, and choosing a new password also verifies the email: opening a
  link sent to the address proves the inbox, which is what verification proves.

**Signing out other devices.** `users.password_changed_at` records the last change or reset.
`requireAuth` refuses a token issued (`iat`, whole seconds) before it, so a reset or a change signs
out every older session, stolen ones included. `POST /api/auth/change-password` asks for the current
password and returns a fresh token for the device that made the change. Both also cancel an unused
Telegram connect code (`users.telegram_link_code`), which a stolen session could have kept to
connect its own chat later. A Telegram chat already connected and the Bakong account stay as they
are, so the email about the change asks the owner to check them in Settings.

**Upgrading a database created before password reset?** Run this once **before** deploying the new
API (`requireAuth` reads `password_changed_at`, so without it every signed-in request fails). It keeps
your data, signs nobody out, and is safe to re-run:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_password_reset_hash_idx ON users (password_reset_hash);
```

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

### Wanted matches

A wanted post (`listingType: "buy_request"`) is matched with items for sale, trade, giveaway or auction
(see [`src/db/matches.js`](src/db/matches.js)). Its `price` is the student's budget. An item matches when:

1. **Searching for the wanted post's title would find it,** using search's full-text test and its typo
   test (`wordMatchSql` in `src/db/listings.js`) but not the part-of-a-word test, because a match can
   send an email. A leading "Looking for", "Searching for", "Anyone selling", "Want to buy", "Wanted",
   "Want", "WTB", "Needed", "Need" or "Buying" (with any `:`, `.`, `-` or spaces after it) is dropped
   first, then a leading "a", "an", "the" or "some", so "Looking for a TI-84" searches for "TI-84".
   (Kept, the "a" would let "Looking for a TV" match "Selling a TI-84 calculator" through the typo
   test.) A title with no real words left ("Wanted:" alone, or only words like "the") matches nothing.
   The typo test can still match inside a longer word when the term is short: a wanted "pen" matches
   an "Open-box" item (score 0.5).
2. **Same category,** unless either one is "Other".
3. **Within budget:** the item's price (an auction's starting bid) is at most the wanted post's price.
   A budget of 0 means any price.
4. **Both are active,** an auction has not ended, and they belong to different students. Only
   verified students' wanted posts are matched to an item, because those students get alerts.

- **Alerts:** when an item is **posted** (`POST /api/listings`), the students whose active wanted
  posts it matches get an email (and a Telegram message, if connected): one message per student, about
  their best-matching post, and at most 10 students per new listing, best matches first. Edits,
  relisting and type changes never alert, so fixing a typo or changing the price does not email
  anyone again. Alerts are sent in the background and never slow down or break posting. A student
  stops them by marking the wanted post sold or reserved, or deleting it.
- **On the listing page,** the owner sees up to 4 matches (`GET /api/listings/:id/matches`): items
  that match their wanted post, or, for an item, the students looking for something like it.

No schema change: existing databases need no upgrade.

### Photos

A listing has up to 6 photos (`imageUrls`); the first one is the cover.

- Each photo is uploaded on its own (`POST /api/uploads`, max 5 MB) as soon as it is picked on the
  form, because a Server Action may carry at most 6 MB (`frontend/next.config.ts`), and on Vercel any
  request over 4.5 MB is refused. So the form takes photos of up to 4 MB (`MAX_PHOTO_MB` in
  `frontend/src/lib/constants.ts`). Saving the listing only sends the URLs.
- `validateListing` refuses more than 6 photos, the same photo twice, and any new URL that is not one
  of our own uploads: it must start with `uploadedPhotoPrefix` (in `src/routes/uploads.js`: the
  Cloudinary folder once Cloudinary is set up, else this API's `/uploads/`), then a generated file
  name. An image on another site could track who views the listing.
- An edit may keep, reorder or remove the photos a listing already has, even ones that are not
  uploads (like the demo `/listings/...` pictures), but once removed they cannot come back.
- A `CHECK` in `schema.sql` refuses more than 6 photos too.
- Known limits: photos that are removed, or uploaded for a listing that is never saved, stay in
  storage. Without Cloudinary the prefix comes from the request's `Host` header, which a client
  calling the API directly can choose; deployments use Cloudinary.

**Upgrading a database created before several photos?** Run this once. It keeps your data (a listing
with more than 6 photos keeps its first 6) and is safe to re-run:

```sql
UPDATE listings SET image_urls = image_urls[1:6] WHERE cardinality(image_urls) > 6;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_image_urls_check;
ALTER TABLE listings ADD CONSTRAINT listings_image_urls_check CHECK (cardinality(image_urls) <= 6);
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

### Offers

A buyer can offer less than the asking price of an item for sale (`src/routes/offers.js`,
`src/db/offers.js`). The seller accepts it, which reserves the item for that buyer at that price, or
declines it.

- Only available (`active`) items for sale with a price take offers; auctions, trades, giveaways and
  wanted posts do not. The amount must be below the asking price, after rounding to cents.
- One pending offer per buyer per listing (a partial unique index). A new amount replaces the pending
  one (which becomes `withdrawn`), so the seller can never accept an amount that changed under them.
  The buyer can also withdraw a pending offer.
- **Accepting** locks the listing row (`SELECT ... FOR UPDATE`, the same lock a buyer takes to start
  paying) and, in one transaction, accepts the offer, declines every other pending offer and sets the
  listing to `reserved` with `listings.reserved_for` = the buyer. Two offers accepted at the same
  moment cannot both win (a unique index allows one accepted offer per listing, too). It is refused
  (409) while another buyer is paying (30 minutes, as for payments), and once the asking price is at
  or below the offer.
- **While reserved this way, only that buyer can pay online**, at the offer's price, or at the asking
  price if the seller has lowered it below that since (`amountToPay` in `src/utils/payments.js` reads
  the offer's price through `LISTING_SELECT`'s private `agreed_price`; it never appears in the API's
  listing JSON). Anyone else's payment that is confirmed late becomes `refund_due`, and their open QR
  reports `unavailable`. They can also meet and pay in person.
- **"Make available again"** clears `reserved_for` and cancels the accepted offer (`cancelled`); the
  item's price applies again. **"Mark as sold"** (the owner's page offers it on a reserved item too)
  keeps `reserved_for`, so that buyer and the owner can review each other. While an accepted offer
  reserves the item, its type is locked and it cannot be deleted (409).
- Pending offers are declined when the item is sold (also by an online payment), traded, reserved
  another way, or changed from a sale to another type (only items for sale take offers). Offers do
  not expire.
- Statuses: `pending` → `accepted` | `declined` | `withdrawn`; `accepted` → `cancelled`.

**Upgrading a database created before offers?** Run this once (psql or the Supabase SQL editor)
**before** starting the new API (every listing query now reads `offers` and `reserved_for`). It keeps
your data and is safe to re-run:

```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS reserved_for UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_reserved_for_not_active;
ALTER TABLE listings ADD CONSTRAINT listings_reserved_for_not_active CHECK (status <> 'active' OR reserved_for IS NULL);
CREATE TABLE IF NOT EXISTS offers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
               ('pending', 'accepted', 'declined', 'withdrawn', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offers_listing_idx ON offers (listing_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_pending_idx ON offers (listing_id, buyer_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_accepted_idx ON offers (listing_id) WHERE status = 'accepted';
```

### Reviews

Once a listing is marked `sold` or `traded`, its owner and a person they dealt with can rate each
other: 1 to 5 whole stars and an optional comment of up to 1000 characters.

- "Dealt with" means the person who bought it, as far as UniSwap knows: whoever **paid online**
  (card or KHQR), or else the **winner of an auction**, or else the buyer whose **offer the owner
  accepted**. Only for other deals settled in person, where UniSwap cannot know the buyer, it means
  both people wrote at least one message about that listing.
  So someone who only asked a question cannot review, and neither can a stranger.
- `GET /api/listings/:id/reviews/can-review?revieweeId=` gives the same answer, so the chat page only
  shows the review form when the review would be accepted.
- One review per person per listing (`UNIQUE (listing_id, reviewer_id)` in `schema.sql`).
- A profile lists every review the user received, with their average rounded to one decimal place.
- The `reviews` table was already in the ER diagram, so existing databases need no upgrade.

### Saved listings

The heart on a listing saves it to the student's Saved page (`src/routes/saved.js`).

- One row per student and listing in `saved_listings` (`PRIMARY KEY (user_id, listing_id)`), so
  saving twice keeps the first save and its time. Unsaving something that is not saved is fine too.
- Any listing can be saved except your own (400). A saved item stays on the Saved page when it is
  sold or traded, marked as such, so the student sees what happened to it.
- Deleting a listing removes its saves (`ON DELETE CASCADE`), so saves never block a delete.
- Every listing in API responses has `saveCount`: how many students saved it, never who.
- Pages ask `GET /api/users/me/saved/ids` which of their cards are saved, so the listing queries stay
  the same for every visitor and need no login.
- **Price drops:** when the owner lowers the price of an available (`active`) item for sale, everyone
  who saved it is told (`notifyPriceDrop`). Prices are compared as stored, to the cent, so saving the
  edit form unchanged, raising the price, or lowering it on other types or on reserved, sold or traded
  items sends nothing.

**Upgrading a database created before saved listings?** Run this once **before** starting the new API
(every listing query now counts saves). It keeps your data and is safe to re-run:

```sql
CREATE TABLE IF NOT EXISTS saved_listings (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS saved_listings_listing_idx ON saved_listings (listing_id);
```

### Email notifications

`src/utils/notify.js` emails people when something happens (using the same SMTP settings as the
verification email):

| Event | Who gets it | Link in the email |
|---|---|---|
| New chat message | The receiver. Only the first unread message in a thread emails; reading the thread re-arms it | The chat thread |
| Outbid | The person who just lost the highest bid | The auction |
| Auction ended with bids | The winner ("You won…") and the seller ("ended at $…") | Their chat with each other |
| Password changed or reset | The account owner | `/forgot-password`, in case it was not them |
| Price drop | Everyone who saved the item, when its owner lowers the price of an available item for sale | The listing |
| A new listing matches your wanted post | Students whose active wanted post it matches (one message per student, at most 10 students per new listing, verified accounts only). Only when the listing is posted, never when it is edited | The new listing |
| New or changed offer | The seller | The listing |
| Offer accepted | The buyer | The listing |
| Offer declined (by the seller, or because the item was sold or reserved another way, or is no longer for sale) | The buyer | The listing |
| Accepted offer cancelled ("Make available again") | The buyer | Their chat with the seller |

Notifications never block or break the request that caused them: if email is not configured they
are skipped with a log line, and send failures are logged, not returned to the user. User-written
text (messages, names, titles) is HTML-escaped in the email.

### Payments, photos, Telegram and the assistant (optional services)

Each one is switched off until its keys are in `.env` (see `.env.example`). Setup steps are in
[`../DEPLOY.md`](../DEPLOY.md). None of them needs an npm package: `src/services/` calls each
service's web API with `fetch`.

- **Stripe Checkout, test mode only** (`services/stripe.js`, `routes/payments.js`). An item for sale,
  or an auction you won, can be paid by card on Stripe's own page. The amount comes from
  `utils/payments.js`: the price, the agreed price of your accepted offer (or the price, if lower),
  or your winning bid.
  When the buyer returns, `/confirm` asks Stripe whether they paid. The webhook (with a verified
  signature) covers buyers who close the tab. Both call `markPaid`, which only acts once, marks the
  listing sold and notifies both people. While one buyer is checking out (30 minutes), others get
  409. Live keys are refused.
- **KHQR through Bakong, real money** (`utils/khqr.js`, `services/bakong.js`, `routes/khqr.js`).
  Sellers add their Bakong account ID (e.g. `name@aclb`) in Settings. A buyer then gets a one-time
  KHQR for the exact amount, scans it with any Cambodian banking app, and the money goes straight to
  the seller: UniSwap never holds it. `utils/khqr.js` writes the QR text itself (EMVCo fields plus a
  CRC-16 checksum, checked against the National Bank's own library in `test/khqr.test.js`). Bakong
  finds a payment by the MD5 of that text, so the QR screen asks `GET /api/payments/khqr/:id` every
  5 seconds, and `server.js` checks open QRs once a minute for buyers who close the page. If a
  confirmation is held up (Bakong down, an expired token, the API switched off), `server.js` keeps
  re-checking unconfirmed QRs for 24 hours, at start-up and every 15 minutes. Both call
  `markPaid`. A QR expires after 30 minutes, the same lock as Stripe. While it is open, the QR
  screen is told `unavailable` (and takes the QR away) once the item is sold, traded or reserved for
  someone else, the seller changes their Bakong account, or `amountToPay` would now ask this buyer
  for a different amount (their offer was accepted, the price changed, or the seller made the item
  available again after accepting their offer). Bakong only answers requests from Cambodian IP
  addresses, so this works when the API runs in Cambodia (see `DEPLOY.md`).
- **Cloudinary** (`services/cloudinary.js`): signed uploads. Without it, photos go to `backend/uploads/`.
- **Telegram** (`services/telegram.js`, `routes/telegram.js`, `utils/telegramBot.js`). Settings gives
  a one-time `t.me/<bot>?start=<code>` link. The bot (long polling, so no public URL is needed)
  links the chat. After that, every notification goes to Telegram as well as email.
- **Ask UniSwap, the shopping assistant** (`services/gemini.js`, `utils/assistant.js`, `routes/assistant.js`).
  A student asks in their own words ("a cheap calculator for my exam"). Gemini (`gemini-3.5-flash-lite`,
  free tier) answers by calling two tools: `search_listings`, our normal browse search (active items
  only, no wanted posts or ended auctions, 5 results), and `reply`, its answer plus the ids of up to 4 listings to show
  as cards. It must always call one of them (`mode: "ANY"`). A question gets at most 3 calls, and the
  last may only be `reply`, so there is always an answer: a typical question uses 2, a follow-up like
  "yes, draft it" uses 1.
  Cards can only be listings its searches returned in that question, so it cannot show a made-up
  item. When nothing fits, `reply` can carry a wanted-post draft, which the student checks and posts
  themselves: the assistant never writes to the database. Nothing is stored either: the frontend
  sends the conversation with each question. Gemini 3 signs its tool calls ("thought signatures"),
  so `askAssistant` sends its turns back exactly as they came. Gemini only sees the question and
  each listing's title, type, price, category, condition and the start of its description, never
  seller names or emails, because Google may read free-tier requests.
  **Free-tier limits** are per Google project, shared by every student, and shown at
  [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit). Measured on 26 Oct 2026:
  `gemini-3.5-flash-lite` allows 15 requests a minute (about 7 questions); `gemini-3.6-flash`
  (and `gemini-3.5-flash`, which counts as it) only 5 a minute and 20 a day; `gemini-3.8-flash` did
  not answer at all. Change the model with `GEMINI_MODEL`. A 429 from Gemini becomes our 429 with
  "try again in a minute", or "try again tomorrow" when the daily limit is used up (it resets at
  midnight Pacific time).

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

**Late payments.** A payment can be confirmed after the item is already gone: a KHQR paid just before
it expired but reported late, after someone else bought the item, the seller marked it sold, or the
seller accepted another buyer's offer (the item is then reserved for that buyer only). The money
really moved, so `markPaid` records it as `refund_due` instead of `paid`, leaves the listing alone,
and emails both people that the seller must refund it. The buyer's page says so too.
**Upgrading a database created before `refund_due`?** Run this once; it keeps your data and is safe to re-run:

```sql
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'refund_due'));
```

## API

Send JSON. Routes marked 🔒 need the header `Authorization: Bearer <token>` (the token comes from register or login).
A token issued before the account's last password change or reset is refused (401).

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | API + database health check |
| POST | `/api/auth/register` | `{ name, email, password, major?, graduationYear? }`. Only `.edu.kh` emails. Emails a verification link; nobody is signed in yet |
| POST | `/api/auth/login` | `{ email, password }` → `{ user, token }`. `403` until the email is verified |
| POST | `/api/auth/verify-email` | `{ token }` → verifies the email, which unlocks signing in |
| POST | `/api/auth/resend-verification` | `{ email, password }` → emails a new verification link (the old one stops working) |
| POST | `/api/auth/forgot-password` | `{ email }` → always `{ requested: true }`, whether or not the account exists. Emails a `/reset-password?token=` link that works once, for 1 hour; at most one email per account every 2 minutes while its link is unused. `400` if not a `.edu.kh` email |
| POST | `/api/auth/reset-password` | `{ token, password }` → `{ reset: true }`. 8+ characters. Signs out every session and verifies the email. `400` if the link is invalid, used or expired |
| POST 🔒 | `/api/auth/change-password` | `{ currentPassword, newPassword }` → `{ token }` for this device; every other session is signed out. `400` if the current password is wrong |
| GET 🔒 | `/api/auth/me` | The logged-in user |
| GET | `/api/listings` | Browse and search (ranked, typo tolerant; see Search above). Query: `query`, `category`, `condition`, `type`, `minPrice`, `maxPrice`, `status` (default `active`) |
| GET | `/api/listings/:id` | One listing, with seller info |
| POST 🔒 | `/api/listings` | `{ title, category, condition, description?, listingType?, price?, cashTopup?, imageUrls?, auctionEndsAt?, minIncrement? }`. `imageUrls`: up to 6 URLs from `POST /api/uploads`, the first is the cover (see Photos above). `auctionEndsAt` (ISO date) is required for an auction. For a wanted post, `price` is the budget (0 = any price). A new item alerts students whose wanted posts it matches (see Wanted matches above) |
| PATCH 🔒 | `/api/listings/:id` | Owner only. Any subset of fields, e.g. `{ "status": "sold" }`. `imageUrls` replaces the whole list; photos the listing already has may stay. `409` for `{ "status": "active" }` on an item someone paid for online (post it as a new listing instead). Lowering the price of an available item for sale alerts everyone who saved it. Making an item reserved by an accepted offer available again cancels that offer; `409` for changing `listingType` while it is. Changing an item for sale to another type declines its pending offers (see Offers above) |
| DELETE 🔒 | `/api/listings/:id` | Owner only. `409` if it is sold or traded, has reviews, someone paid for it, a payment for it is unconfirmed and less than 24 hours old (it may still be confirmed), or it is reserved by an accepted offer: deleting would also erase its payments, reviews and offers |
| GET | `/api/listings/:id/bids` | An auction's bids, highest first, with bidder name |
| POST 🔒 | `/api/listings/:id/bids` | `{ amount }`. Place a bid (see Auctions above) |
| GET | `/api/listings/:id/matches` | `{ listings }`, at most 4, best first: for a wanted post, active items that match it; for any other listing, active wanted posts it matches (see Wanted matches above). Empty when the listing is not active |
| POST 🔒 | `/api/listings/:id/offers` | `{ amount }` → `201 { offer }`. Below the asking price, on someone else's available item for sale; replaces your pending offer (see Offers above) |
| GET 🔒 | `/api/listings/:id/offers` | Owner only → `{ offers }`: pending ones highest first, plus the accepted one |
| GET 🔒 | `/api/listings/:id/offers/mine` | `{ offer }`: your latest offer on it, in any status, or `null` |
| POST 🔒 | `/api/offers/:id/accept` | Seller → `{ offer }`. Reserves the item for that buyer at that price and declines the others. `409` if the offer is no longer open, the item is not available, or another buyer is paying |
| POST 🔒 | `/api/offers/:id/decline` | Seller → `{ offer }`. The item stays available |
| POST 🔒 | `/api/offers/:id/withdraw` | The buyer, pending offers only → `{ offer }` |
| GET | `/api/listings/:id/reviews` | Reviews about this listing's deal (at most one per person) |
| GET 🔒 | `/api/listings/:id/reviews/can-review?revieweeId=` | `{ allowed, reason }`: whether you may review that person for this listing |
| POST 🔒 | `/api/listings/:id/reviews` | `{ revieweeId, rating, comment? }`. 1-5 stars, once the listing is sold or traded (see Reviews above) |
| POST 🔒 | `/api/listings/:id/save` | Save a listing (the heart) → `{ saved: true }`. Saving it again changes nothing. `400` for your own listing, `404` if it does not exist |
| DELETE 🔒 | `/api/listings/:id/save` | Unsave → `204`, also if it was not saved |
| GET | `/api/users/:id/reviews` | `{ reviews, averageRating, reviewCount }`: reviews the user received, newest first |
| GET | `/api/payments/config` | `{ enabled, khqr }`: whether card and KHQR payments are switched on |
| POST 🔒 | `/api/payments/checkout` | `{ listingId }` → `{ url }` of Stripe's payment page |
| POST 🔒 | `/api/payments/confirm` | `{ sessionId }` → `{ status: "paid" \| "pending" \| "refund_due" }`, checked with Stripe |
| POST | `/api/payments/webhook` | Called by Stripe only, with a signature check |
| POST 🔒 | `/api/payments/khqr` | `{ listingId }` → `{ paymentId, qr, amount, expiresAt }`. Asking again within 30 minutes returns the same QR, as long as it still pays the seller's current Bakong account. First records any earlier QR for the item that was paid but not yet confirmed: `409` if it was this buyer's. `400` if the seller has no Bakong account. `403` if the item is reserved for another buyer; for the buyer it is reserved for, the amount is the agreed price (or the asking price, if lower). `503` if Bakong cannot be reached right now (no QR is shown that could not be confirmed) |
| GET 🔒 | `/api/payments/khqr/:id` | Buyer only → `{ status: "paid" \| "pending" \| "expired" \| "refund_due" \| "unavailable" }`, checked with Bakong. `refund_due`: paid after the item was already sold or reserved for another buyer. `unavailable`: not paid, and the item has been sold or traded another way or reserved for another buyer, the seller changed the Bakong account this QR pays, or this buyer would now pay a different amount (see KHQR above), so the QR should not be paid |
| GET | `/api/telegram` | `{ enabled }`: whether Telegram alerts are switched on (no sign-in needed) |
| GET 🔒 | `/api/users/me/telegram` | `{ enabled, connected }` |
| POST 🔒 | `/api/users/me/telegram` | `{ link }`: one-time link that opens the bot |
| DELETE 🔒 | `/api/users/me/telegram` | Disconnect Telegram |
| GET 🔒 | `/api/users/me/saved` | `{ listings }`: my saved listings, most recently saved first, in any status (a sold one shows as sold) |
| GET 🔒 | `/api/users/me/saved/ids` | `{ listingIds }`: which listings I saved, so a page can fill in the hearts on its cards |
| GET | `/api/users/:id` | Public profile (email hidden) |
| GET | `/api/users/:id/listings` | All listings by a user |
| PATCH 🔒 | `/api/users/me` | `{ name?, major?, graduationYear?, bio?, avatarUrl?, bakongAccountId? }`. `bakongAccountId` is `name@bank`; `""` or `null` removes it |
| GET 🔒 | `/api/messages/conversations` | My chat threads, newest first: `{ listingId, partnerId, lastMessageAt, unreadCount, listingTitle, listingCategory, listingImageUrl, lastMessageBody, lastMessageIsMine }`. `listingImageUrl` is the cover photo, or `null` |
| GET 🔒 | `/api/messages?listingId=&withUserId=` | One thread, oldest first |
| POST 🔒 | `/api/messages` | `{ listingId, receiverId, body }` |
| PATCH 🔒 | `/api/messages/read` | `{ listingId, withUserId }` → mark a thread read |
| POST 🔒 | `/api/uploads` | One photo per request: raw image bytes with `Content-Type: image/jpeg`, `png`, `webp` or `gif` (max 5 MB) → `{ url }` |
| GET | `/api/assistant/config` | `{ enabled }`: whether the shopping assistant is switched on (`GEMINI_API_KEY` set) |
| POST 🔒 | `/api/assistant` | `{ messages: [{ role: "user" \| "assistant", text }] }`, oldest first, at most 20, each 1 to 1000 characters, the last one the student's → `{ reply, listings, wantedDraft }`. `listings`: up to 4 full listings to show as cards. `wantedDraft`: `null` or `{ title, description, category, budget }` to fill in the new-listing form. `503` while switched off, `429` while Gemini's free quota for the minute or the day is used up, `502` if Gemini fails (see Ask UniSwap above) |

Uploaded photos are saved in `backend/uploads/` (git-ignored) and served at `/uploads/<file>`.
Put the returned `url` in a listing's `imageUrls` (at most 6; only URLs from this route are accepted).

JSON field names match the frontend types in `frontend/src/types/index.ts` (camelCase).
Errors always look like `{ "error": "message", "details": { "field": "message" } }`.

## Testing

- `npm test` runs the unit tests in `test/*.test.js`: validation, the search query builder, the
  payment amount rules, the Stripe and Cloudinary helpers, the KHQR builder and Bakong answers, and
  the shopping assistant's tool loop (with a scripted fake Gemini). No database or network needed.
- `npm run test:api` runs the API tests in `test/api/`. Each file starts the real app on a free port
  and sends it real HTTP requests, so routes, SQL and database rules are tested together: sign-up and
  verification, password reset and change, owner-only changes, messaging, bidding (including five
  bids at the same moment), payments with Stripe switched off, KHQR payments (with Bakong replaced by
  a fake), reviews, saved listings (including who gets a price-drop alert), listing photo rules,
  wanted-post matching and alerts, offers (including two accepted at the same moment), and the
  shopping assistant (with Gemini replaced by a fake that also checks no seller details are sent).

The API tests need their own database, because `test/api/reset-db.js` wipes it before every run.
Create it once, then put its URL in `.env` as `TEST_DATABASE_URL` (see `.env.example`):

```bash
createdb uniswap_test                                      # local PostgreSQL
docker exec <container> createdb -U <user> uniswap_test    # PostgreSQL in Docker
```

The tests refuse to run if `TEST_DATABASE_URL` is the same database as `DATABASE_URL`. They switch
off email, Stripe, Bakong, Telegram, Cloudinary and Gemini, so a test run never sends anything.
While email is off the API prints verification and reset links in its log; `test/api/helpers.js`
hides those lines and keeps them (`loggedLinks`), so a test opens a reset link the way a person would.
It keeps the "email not configured, skipped" lines of notifications too (`skippedEmails`), so a test
can check who would have been emailed, waiting with `waitFor` because notifications are sent in the background.

## Security

- **SQL injection:** every query uses `$1, $2, ...` parameters, never string concatenation.
- **Passwords:** hashed with scrypt (Node's built-in `crypto`) plus a random salt; never returned by the API.
- **Verified members only:** an account cannot sign in until the link sent to its `.edu.kh` address is opened, so a
  made-up or borrowed email gets nowhere. An unverified sign-up is replaced if the email registers again, so a
  stranger cannot block the real owner. Every protected request re-checks that the account exists and is verified.
- **Auth:** signed JWTs expire after 7 days; changing or resetting the password signs out every session
  started before it; listings can only be changed or deleted by their owner.
- **Password reset:** the same answer for every campus email, only the token's hash is stored, the link
  works once for 1 hour, at most one email per account every 2 minutes while its link is unused, and
  it is never printed in the log in production or once email is set up.
- **Privacy:** emails and Bakong account IDs appear only on your own account, never on public
  profiles. (A buyer does see the seller's Bakong account inside the KHQR, as with any bank transfer.)
- **Shopping assistant:** it can only search; it never writes to the database, and a wanted-post draft
  is only filled into the form for the student to check. Its instructions say listing text is data,
  never instructions, and its cards can only be listings its own searches returned. Gemini never
  gets seller names or emails.
- **Secrets:** live in `.env` (git-ignored). Nothing secret is committed.

## Progress

What is built, tested and still to do is kept in one place: the Status section of the
[root README](../README.md).
