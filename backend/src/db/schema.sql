-- UniSwap database schema (PostgreSQL 13+).
-- Follows the ER diagram in the proposal (Figure 2): users, listings, messages, reviews.
-- Extra user fields (major, bio, ...) match the frontend's User type in frontend/src/types.
-- WARNING: re-running this drops all data. Development only.

DROP TABLE IF EXISTS payments, bids, reviews, messages, listings, users CASCADE;

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
  image_urls   TEXT[] NOT NULL DEFAULT '{}',
  -- Auctions only: bidding closes at auction_ends_at; each bid must beat the highest by min_increment.
  -- For an auction, `price` is the starting bid.
  auction_ends_at TIMESTAMPTZ,
  min_increment   NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (min_increment > 0),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN
                 ('active', 'reserved', 'sold', 'traded')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Full-text search words, kept up to date by PostgreSQL itself. Title words weigh most ('A'),
  -- then description ('B'), then category ('C'), so title matches rank highest.
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', title), 'A')
    || setweight(to_tsvector('english', description), 'B')
    || setweight(to_tsvector('english', category), 'C')
  ) STORED,
  CONSTRAINT listings_auction_needs_end CHECK (listing_type <> 'auction' OR auction_ends_at IS NOT NULL)
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
  -- refund_due: the money moved, but only after the item was already sold, so the seller must refund it.
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
