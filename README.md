# UniSwap — Campus Marketplace

FYP 401 Final Year Project. A closed marketplace for verified `.edu.kh` campus members to
buy, sell, trade, or give away items.

| Folder | What it is | Owner |
|---|---|---|
| [`frontend/`](frontend/) | Next.js + React + TypeScript + Tailwind + shadcn/ui | Dy Nobsokun |
| [`backend/`](backend/) | Node.js + Express REST API + PostgreSQL | Long Vathanak |

Rules for AI coding agents working in this repo are in [`Agent.md`](Agent.md).
Putting it online (Supabase, Render, Vercel, Cloudinary, Stripe, Telegram): [`DEPLOY.md`](DEPLOY.md).

## Status (week 5)

### Built

- **Accounts:** sign-up with a `.edu.kh` email only, and nobody can sign in until the emailed
  verification link is opened. Profiles are public; email addresses never are. Forgot your
  password? A one-hour, single-use link is emailed to your campus address, and you can change your
  password in Settings. Either one signs out every other device.
- **Listings:** sell, ask for something ("wanted"), trade (with a cash top-up for uneven trades),
  give away, or auction. Up to 6 photos each (the first is the cover), shown as a gallery,
  owner-only editing and deleting, and the statuses active, reserved, sold and traded.
- **Saved listings:** the heart on another student's listing saves it to a Saved page, where sold
  items stay, marked sold. A listing shows how many students saved it, never who. When the owner
  lowers the price of an item for sale, everyone who saved it is told.
- **Offers:** offer less than the asking price on an item for sale. The seller accepts or declines;
  accepting reserves the item for that buyer, who can then pay the agreed price online or in person.
- **Wanted alerts:** when someone posts an item that matches your wanted post (same search rules,
  same category, within your budget), you get an email (and a Telegram message, if connected), and
  your wanted post's page lists matching items. Sellers see who is looking for something like theirs.
- **Search:** best matches first. It finds partial words and typos ("calculas" finds "Calculus"),
  with filters for category, condition, type and price.
- **Auctions:** a starting price, a minimum raise and an end time. Two bids placed at the same
  moment can never both win. When time runs out, the item is reserved for the highest bidder.
- **Messaging:** a private thread per listing between its owner and each interested student, with
  unread counts.
- **Reviews and ratings:** once a listing is sold or traded, its owner and the buyer (whoever paid
  online, won the auction or had their offer accepted; for other in-person deals, someone they
  chatted with) can rate each other (1 to 5 stars and a comment). Profiles show the average and
  every review.
- **Notifications:** by email, and by Telegram for students who connect it in Settings: new
  messages, being outbid, auction results, offers, payments, password changes, price drops on items
  you saved, and a new listing that matches your wanted post.
- **Card payments (Stripe test mode):** pay for an item for sale or an auction you won. Live keys
  are refused, so no real card can ever be charged.
- **KHQR payments (Bakong):** sellers add their Bakong account in Settings; buyers scan a QR with
  any Cambodian banking app and the money goes straight to the seller. UniSwap confirms the payment
  with the National Bank's Bakong API and marks the item sold.
- **Ask UniSwap (shopping assistant):** the Ask page lets a student describe what they need in their own
  words ("a bike under $50"). Gemini searches the listings and answers with the best matches as
  cards; when nothing fits, it drafts a wanted post that opens the sell form filled in, to check and
  post. It only reads listings, and it is switched off until `GEMINI_API_KEY` is set (free tier).
- **Security:** parameterized SQL everywhere, hashed passwords, verified accounts only, owner-only
  changes, a password change signs out stolen sessions, and no secrets in the repository.

### Tested

- `npm test` (in `backend/`): 38 unit tests for validation (including the photo rules), the search
  query and wanted-post matching, the payment amount rules, the Stripe and Cloudinary helpers, the
  KHQR builder (checked against the National Bank's own library), and the shopping assistant's tool loop.
- `npm run test:api` (in `backend/`): 100 tests that send real requests to the running API, covering
  sign-up and verification, password reset and change, owner-only changes, messaging, simultaneous
  bids, card and KHQR payments, reviews, saved listings, listing photos, wanted-post matching and
  alerts, offers (including two accepted at the same moment), and refusing to delete a listing whose
  payments or reviews must stay, and the shopping assistant (with a fake Gemini).
  They use a separate test database (see [Testing](backend/README.md#testing)).

### Not done yet

- **Needs our own accounts and keys** (steps in [`DEPLOY.md`](DEPLOY.md)): the Supabase database,
  Render and Vercel hosting, Cloudinary, Stripe test keys and the Telegram bot. Until their keys are
  set, photos are saved on the server's disk, and payments and Telegram stay switched off.
- **KHQR on Render:** Bakong only answers Cambodian IP addresses, so KHQR works when the API runs
  in Cambodia (e.g. a laptop for the demo), not on Render.
- **Ask UniSwap's free tier:** Gemini's free limits are shared by every student (on
  `gemini-3.5-flash-lite`, 15 requests a minute, about 7 questions), so it suits a demo, not heavy use.
- **Possible next steps:** real-time chat, safe meetup spots, and notification settings.

### Known limitations (by design)

- **One buyer pays at a time.** While someone has a card checkout or KHQR open for an item (up to
  30 minutes), other buyers are told someone is paying. This is what stops two people paying for
  the same item, but it also means any signed-in student can hold an item for 30 minutes without
  paying. Every account is a verified `.edu.kh` student, and the item can still be sold in person.
- **A manual "Mark reserved" does not cancel a payment already in progress:** whoever pays first
  buys the item, and both people are told (it does not record who the item is reserved for, so
  cancelling could refund the very buyer the seller meant). An accepted offer does record the buyer:
  then only they can pay, and anyone else's late payment is recorded as a refund the seller owes.
- **Offers do not expire.** A pending offer stays until the buyer withdraws or changes it, the seller
  answers it, or the item is sold, reserved another way or no longer for sale. An accepted offer
  keeps the item reserved until it is sold or the seller makes it available again.
- **A withdrawn QR can still be paid if it was already scanned.** When the amount a buyer would pay
  changes while their KHQR is open (the seller changed the price, accepted their offer, or made the
  item available again after accepting it), the QR leaves their screen. A banking app that already
  read it can still pay it until it expires (30 minutes): that completes the sale at the QR's amount,
  the same as whoever pays first, and the two settle any difference.
- **An item paid for online cannot be made available again.** Its payment and reviews belong to
  that sale. If the deal falls through, the seller refunds the buyer and posts the item as a new
  listing.
- **A listing with an unconfirmed payment cannot be deleted for 24 hours.** UniSwap keeps checking
  such a payment with Bakong for 24 hours, and deleting the listing would erase it. Meanwhile the
  seller can mark the item reserved to take it off the browse page.
- **A KHQR payment confirmed more than 24 hours late is not recorded automatically.** That only
  happens if Bakong cannot be reached for a whole day. The money still reached the seller's account,
  so the buyer and seller settle it between them.
- **No limit on password guesses.** Sign-in and change-password do not slow down repeated wrong
  passwords; that would need a package or extra state. Every account is a verified campus student,
  and passwords need at least 8 characters.
- **"Forgot your password?" has no per-IP limit.** Anyone who knows a student's email can ask for
  a reset link for it every 2 minutes (the per-account limit), from any computer, and each new link
  replaces the one before. So someone could flood a student with reset emails and keep cancelling
  the link they are about to use. It never gives anyone else access to the account.
- **Signing out other devices works to the second.** Login tokens record their time in whole
  seconds, so a session that signed in during the same second as a password change or reset, or a
  sign-in with the old password that was already being checked when the reset was saved, stays
  signed in (up to the token's 7 days).
- **Offer, price-drop and wanted-match emails are not throttled.** Every new offer amount emails the
  seller, every price decrease emails everyone who saved the item (even back down to a price they
  already saw), and every new listing can alert up to 10 students. A student repeating these on
  purpose could use up the shared email account's daily limit (about 500 a day on Gmail), which
  would delay verification and reset emails for everyone.
- **Wanted matching is strict, so it misses some matches.** Every word left in a wanted post's title
  must be found in the item (or the title must be close to part of the item's title, allowing
  typos), and only "Looking for", "Wanted", "WTB" and similar openings are dropped. So "Looking to
  buy a mini fridge", or a long title that describes the item, may never match an item it should.
  A short title that names the item works best.

## Run locally

```bash
# API on http://localhost:4000  (needs PostgreSQL; see backend/README.md)
cd backend && npm install && cp .env.example .env && npm run db:setup && npm run db:seed && npm run dev

# Web app on http://localhost:3000 (talks to the API above)
cd frontend && npm install && npm run dev
```

The web app calls the API from the Next.js server, at `http://localhost:4000` by default. To use a
different address, set `API_URL` in `frontend/.env.local`.

Demo accounts (created by `npm run db:seed`, password `password123` for all):
`sokunth@aupp.edu.kh`, `chanrithorn@aupp.edu.kh`, and `dara@aupp.edu.kh` (unverified on purpose, to
show that sign-in is refused). New accounts need a `.edu.kh` email and cannot sign in until its
verification link is opened; the link is printed in the API's log until email sending is set up.
The same goes for the link that "Forgot your password?" sends, except in production
(`NODE_ENV=production`), where a reset link is never printed.
