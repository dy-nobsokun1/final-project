-- UniSwap database schema (PostgreSQL 13+).
-- Follows the ER diagram in the proposal (Figure 2): users, listings, messages, reviews.
-- Extra user fields (major, bio, ...) match the frontend's User type in frontend/src/types.
-- WARNING: re-running this drops all data. Development only.

DROP TABLE IF EXISTS offers, saved_listings, payments, bids, reviews, messages, listings, users CASCADE;

-- pg_trgm ships with PostgreSQL (and is available on Supabase). Search uses it to tolerate typos.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  email              TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND email LIKE '%.edu.kh'),
  password_hash      TEXT NOT NULL,
  is_verified        BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT,
  avatar_url         TEXT,
  major              TEXT NOT NULL DEFAULT '',
  graduation_year    INTEGER,
  bio                TEXT NOT NULL DEFAULT '',
  -- Telegram notifications: the chat the bot messages, and a one-time code used to link it.
  telegram_chat_id   TEXT,
  telegram_link_code TEXT UNIQUE,
  -- KHQR: the seller's Bakong account (e.g. name@aclb) that buyers' payments go straight to.
  bakong_account_id  TEXT CHECK (length(bakong_account_id) <= 32),
  -- Forgot password: only a SHA-256 hash of the emailed token is kept, so someone who reads the
  -- database (e.g. a leaked backup) cannot use a pending link. It stops working at
  -- password_reset_expires_at (1 hour after it is sent).
  password_reset_hash       TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  -- When the last reset email went out, so an account gets at most one every 2 minutes.
  password_reset_sent_at    TIMESTAMPTZ,
  -- Login tokens issued before this moment are refused (middleware/auth.js), so changing or
  -- resetting the password signs out every older session. NULL: never changed.
  password_changed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reset-password looks an account up by the hash of its link's token.
CREATE UNIQUE INDEX users_password_reset_hash_idx ON users (password_reset_hash);

CREATE TABLE listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL CHECK (category IN
                 ('textbooks', 'electronics', 'furniture', 'clothing', 'bikes', 'other')),
  condition    TEXT NOT NULL CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  listing_type TEXT NOT NULL DEFAULT 'sale' CHECK (listing_type IN
                 ('sale', 'buy_request', 'trade', 'giveaway', 'auction')),
  price        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  -- Value-gap negotiation: extra cash offered on top of an uneven trade.
  cash_topup   NUMERIC(10, 2) CHECK (cash_topup >= 0),
  -- Photo URLs, at most 6 (MAX_PHOTOS in utils/validation.js). The first one is the cover.
  image_urls   TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(image_urls) <= 6),
  -- Auctions only: bidding closes at auction_ends_at; each bid must beat the highest by min_increment.
  -- For an auction, `price` is the starting bid.
  auction_ends_at TIMESTAMPTZ,
  min_increment   NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (min_increment > 0),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN
                 ('active', 'reserved', 'sold', 'traded')),
  -- Set while the item is reserved for one buyer whose offer the seller accepted (routes/offers.js):
  -- only they can pay for it online, at the offer's price. 'Mark as sold' keeps it (the item went to
  -- them in person); 'Make available again' clears it.
  reserved_for UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When it became sold or traded; cleared if it goes back to active or reserved. Every edit moves
  -- updated_at, so profile stats date a deal by this when nothing was paid online (db/stats.js).
  sold_at      TIMESTAMPTZ,
  -- Full-text search words, kept up to date by PostgreSQL itself. Title words weigh most ('A'),
  -- then description ('B'), then category ('C'), so title matches rank highest.
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', title), 'A')
    || setweight(to_tsvector('english', description), 'B')
    || setweight(to_tsvector('english', category), 'C')
  ) STORED,
  CONSTRAINT listings_auction_needs_end CHECK (listing_type <> 'auction' OR auction_ends_at IS NOT NULL),
  -- A reservation only means something while the item is not available to everyone.
  CONSTRAINT listings_reserved_for_not_active CHECK (status <> 'active' OR reserved_for IS NULL)
);

CREATE INDEX listings_browse_idx ON listings (status, created_at DESC);
CREATE INDEX listings_user_idx ON listings (user_id);
CREATE INDEX listings_search_idx ON listings USING GIN (search_vector);

-- One row per bid on an auction listing. The highest amount is the current (or winning) bid.
CREATE TABLE bids (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bidder_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bids_listing_idx ON bids (listing_id, amount DESC);

-- Price offers on items for sale (routes/offers.js). A buyer offers less than the asking price; the
-- seller accepts it (the item is reserved for that buyer at that price) or declines it.
--   pending  -> accepted | declined | withdrawn (by the buyer, or replaced by their newer offer)
--   accepted -> cancelled (the seller made the item available again)
CREATE TABLE offers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
               ('pending', 'accepted', 'declined', 'withdrawn', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()  -- when the status last changed
);

CREATE INDEX offers_listing_idx ON offers (listing_id, status);
-- The database itself guarantees one pending offer per buyer per listing, and one accepted offer per listing.
CREATE UNIQUE INDEX offers_one_pending_idx ON offers (listing_id, buyer_id) WHERE status = 'pending';
CREATE UNIQUE INDEX offers_one_accepted_idx ON offers (listing_id) WHERE status = 'accepted';

-- Online payments: by card through Stripe Checkout (test mode), or by KHQR straight to the seller's
-- Bakong account. A row is created when the buyer starts paying ("pending") and becomes "paid" once
-- Stripe or Bakong confirms it; the listing is then marked sold.
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  method            TEXT NOT NULL DEFAULT 'stripe' CHECK (method IN ('stripe', 'khqr')),
  stripe_session_id TEXT UNIQUE, -- Stripe only
  khqr              TEXT,        -- KHQR only: the exact QR text shown; Bakong finds the payment by its MD5
  -- refund_due: the money moved, but only after the item was already sold (or reserved for another
  -- buyer, see offers), so the seller must refund it.
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refund_due')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at           TIMESTAMPTZ,
  CHECK ((method = 'stripe') = (stripe_session_id IS NOT NULL)),
  CHECK ((method = 'khqr') = (khqr IS NOT NULL))
);

CREATE INDEX payments_listing_idx ON payments (listing_id, status);

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);

CREATE INDEX messages_thread_idx ON messages (listing_id, sender_id, receiver_id, created_at);

-- Stretch goal (reviews & ratings). Table exists now so the schema matches the ER diagram.
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reviewer_id),
  CHECK (reviewer_id <> reviewee_id)
);

-- Saved listings (the heart button): a private bookmark from one student to one listing.
-- Not in the proposal's ER diagram; added for the Saved page and price-drop alerts. Deleting the
-- listing or the student deletes the save too, so saves never block deleting a listing.
CREATE TABLE saved_listings (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)  -- saving twice keeps one row
);

-- The primary key finds one student's saves (it starts with user_id). This index finds everyone who
-- saved a listing: the save count, price-drop alerts, and the cascade when a listing is deleted.
CREATE INDEX saved_listings_listing_idx ON saved_listings (listing_id);
