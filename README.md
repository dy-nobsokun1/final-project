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
  verification link is opened. Profiles are public; email addresses never are.
- **Listings:** sell, ask for something ("wanted"), trade (with a cash top-up for uneven trades),
  give away, or auction. Photos, owner-only editing and deleting, and the statuses active,
  reserved, sold and traded.
- **Search:** best matches first. It finds partial words and typos ("calculas" finds "Calculus"),
  with filters for category, condition, type and price.
- **Auctions:** a starting price, a minimum raise and an end time. Two bids placed at the same
  moment can never both win. When time runs out, the item is reserved for the highest bidder.
- **Messaging:** a private thread per listing between its owner and each interested student, with
  unread counts.
- **Reviews and ratings:** once a listing is sold or traded, its owner and the person they chatted
  with can rate each other (1 to 5 stars and a comment). Profiles show the average and every review.
- **Notifications:** by email, and by Telegram for students who connect it in Settings: new
  messages, being outbid, auction results and payments.
- **Card payments (Stripe test mode):** pay for an item for sale or an auction you won. Live keys
  are refused, so no real card can ever be charged.
- **KHQR payments (Bakong):** sellers add their Bakong account in Settings; buyers scan a QR with
  any Cambodian banking app and the money goes straight to the seller. UniSwap confirms the payment
  with the National Bank's Bakong API and marks the item sold.
- **Security:** parameterized SQL everywhere, hashed passwords, verified accounts only, owner-only
  changes, and no secrets in the repository.

### Tested

- `npm test` (in `backend/`): 22 unit tests for validation, the search query, the Stripe and
  Cloudinary helpers, and the KHQR builder (checked against the National Bank's own library).
- `npm run test:api` (in `backend/`): 40 tests that send real requests to the running API, covering
  sign-up and verification, owner-only changes, messaging, simultaneous bids, card and KHQR
  payments, reviews, and refusing to delete a listing whose payments or reviews must stay.
  They use a separate test database (see [Testing](backend/README.md#testing)).

### Not done yet

- **Needs our own accounts and keys** (steps in [`DEPLOY.md`](DEPLOY.md)): the Supabase database,
  Render and Vercel hosting, Cloudinary, Stripe test keys and the Telegram bot. Until their keys are
  set, photos are saved on the server's disk, and payments and Telegram stay switched off.
- **KHQR on Render:** Bakong only answers Cambodian IP addresses, so KHQR works when the API runs
  in Cambodia (e.g. a laptop for the demo), not on Render.
- **Possible next steps:** real-time chat, safe meetup spots, and notification settings.

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
