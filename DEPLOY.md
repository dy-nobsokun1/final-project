# Deploying UniSwap

Everything below uses free tiers. Do the steps in this order: each one gives you a value the next
one needs. **Never commit any of these keys.** They go into the Render and Vercel dashboards (and your
local `backend/.env`, which git ignores).

| Piece | Service | What you get |
|---|---|---|
| Database | Supabase | `DATABASE_URL` |
| Photos | Cloudinary | `CLOUDINARY_*` |
| API (`backend/`) | Render | `https://uniswap-api-xxxx.onrender.com` |
| Website (`frontend/`) | Vercel | `https://your-app.vercel.app` |
| Card payments (test mode) | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| KHQR payments (real money) | Bakong (National Bank of Cambodia) | `BAKONG_TOKEN` |
| Telegram alerts | @BotFather | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` |
| Shopping assistant | Google AI Studio (Gemini, free tier) | `GEMINI_API_KEY` |
| Email | Gmail App Password | `SMTP_USER`, `SMTP_PASS` |

Each optional service (Cloudinary, Stripe, Bakong, Telegram, Gemini, email) stays switched off until its keys
are set. When the API starts, its log shows which ones are on, e.g.
`email on · photos Cloudinary · card payments on · KHQR off · Telegram off · assistant on`.

## 1. Database: Supabase

1. Go to supabase.com → **New project**. Pick region **Southeast Asia (Singapore)** and save the
   database password somewhere safe.
2. Click **Connect** (top of the project page) → **Session pooler** → copy the URI. It looks like
   `postgresql://postgres.abcd:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`.
   Use the session pooler, not "Direct connection": Render cannot reach Supabase's direct address.
3. Put your password in, and add `?sslmode=no-verify` at the end. (The connection is still
   encrypted; this only skips checking Supabase's certificate, which Node does not ship with.)
4. Create the tables and demo data from your laptop:
   ```bash
   cd backend
   export DATABASE_URL='postgresql://postgres.abcd:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=no-verify'
   npm run db:setup && npm run db:seed
   unset DATABASE_URL
   ```
   A variable set in the terminal overrides the one in `.env`, so this only affects these commands.
   After this, Supabase's **Table Editor** shows the tables and lets you edit rows by hand.

**Already have a database from an earlier version?** Do not run `npm run db:setup` again, because it
wipes everything. First run the SQL listed in [`backend/README.md`, "Upgrading an existing database to
this version"](backend/README.md#upgrading-an-existing-database-to-this-version) in Supabase's
**SQL Editor**, then deploy the new API.

## 2. Photos: Cloudinary

Sign up at cloudinary.com. The dashboard's **API Keys** page shows your **Cloud name**, **API key**
and **API secret**. Without Cloudinary, photos are saved on the server's disk, and Render wipes that
disk on every restart.

## 3. API: Render

1. Push your branch to GitHub first (Render deploys from GitHub).
2. render.com → **New** → **Blueprint** → connect GitHub → pick the repository and branch. Render
   reads `render.yaml` and creates the `uniswap-api` service.
3. Fill in the values it asks for. Leave `FRONTEND_ORIGIN` as `http://localhost:3000` for now (you
   get the real value in step 4). Leave Stripe and Telegram empty if you have not set them up yet.
4. When the deploy finishes, open `https://<your-service>.onrender.com/api/health`. It should show
   `{"status":"ok"}`.

The free plan sleeps after 15 minutes without visitors, and the first request after that takes
about a minute. While it sleeps, ended auctions are closed and Telegram messages are picked up as
soon as it wakes. Bids are always refused after the end time.

## 4. Website: Vercel

1. vercel.com → **Add New** → **Project** → import the same repository.
2. Set **Root Directory** to `frontend`. This is important, because the repo has two apps.
3. Under **Environment Variables** add `API_URL` = your Render URL (no trailing slash).
4. Deploy. Copy the site's URL, then go back to Render → **Environment** → set `FRONTEND_ORIGIN`
   to it. Render redeploys. Links in emails and Telegram now point to the live site.

Vercel refuses any request over 4.5 MB, and listing photos are uploaded through the website, so the
listing form only takes photos of up to 4 MB (`MAX_PHOTO_MB`), although the API itself accepts 5 MB.

## 5. Card payments: Stripe (test mode)

1. Create a Stripe account. Test mode works straight away, and you never need to activate live payments.
2. **Developers → API keys** → copy the **Secret key** (`sk_test_...`) into Render as
   `STRIPE_SECRET_KEY`. The API refuses live keys (`sk_live_...`), so a real card can never be charged.
3. **Developers → Webhooks → Add endpoint**: URL `https://<your-render-url>/api/payments/webhook`,
   event `checkout.session.completed`. Copy its **Signing secret** (`whsec_...`) into Render as
   `STRIPE_WEBHOOK_SECRET`. The webhook catches buyers who pay and then close the tab before
   returning to UniSwap.
4. To try it: buy an item for sale, or win an auction. Click **Pay with card**, then use card
   `4242 4242 4242 4242`, any future expiry date and any CVC. Afterwards the item shows as sold.

Locally, only `STRIPE_SECRET_KEY` is needed: the listing page confirms the payment when Stripe
sends the buyer back.

## 6. KHQR payments: Bakong (real money)

KHQR moves **real money**, straight from the buyer's bank to the seller's Bakong account. UniSwap
never holds it; it only asks Bakong whether the QR was paid, then marks the item sold.

1. Register at **https://api-bakong.nbc.gov.kh**, verify your email, and copy the token into
   `BAKONG_TOKEN`. It expires after 90 days, so renew it there before a demo.
2. **Bakong only answers requests from Cambodian IP addresses.** Render's servers are outside
   Cambodia, so on Render the payment check fails (the log shows `[bakong] ... Cambodian IP`). For
   the demo, run the API on a laptop in Cambodia (`npm run dev`), or leave `BAKONG_TOKEN` empty on
   Render so the KHQR button stays hidden there.
3. Each seller adds their Bakong account ID (`name@bank`, from their banking app's KHQR profile) in
   **Settings → Payments**. Only their listings show **Pay with KHQR**.
4. To try it with little money: list a test item for `$0.01` from one account, then pay it from
   another account's banking app. Within a few seconds the QR screen turns into "Payment received"
   and the item shows as sold.

## 7. Telegram alerts

1. In Telegram, message **@BotFather** → `/newbot` → choose a name and a username ending in `bot`.
2. Put the token in `TELEGRAM_BOT_TOKEN` and the username (without `@`) in `TELEGRAM_BOT_USERNAME`.
3. Users connect in **Settings → Notifications → Connect Telegram**, then press **Start** in the bot.

Only one running copy of the API can listen to a bot. If you test locally with the same token
while Render is running, one of them will log polling errors, so use a second bot for local testing.

## 8. Email: Gmail

School Outlook accounts cannot send email from apps. Use a Gmail account:

1. Turn on 2-Step Verification.
2. Go to Google Account → Security → **App passwords** and create one.
3. Set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the 16-character app password.
   Recipients can still be `.edu.kh`.

Until email is set up, verification links only appear in the Render log, and "Forgot your password?"
sends nothing at all: `render.yaml` sets `NODE_ENV=production`, so reset links are never printed.

## Checklist

- [ ] `https://<render-url>/api/health` → `{"status":"ok"}`
- [ ] The Render log shows the services you expect switched on
- [ ] The Vercel site lists the demo listings (so the database and `API_URL` are right)
- [ ] Register with a `.edu.kh` email, receive the verification email, and log in
- [ ] Post a listing with two photos: both image URLs start with `https://res.cloudinary.com/`
- [ ] Pay for an item with the test card: it becomes sold, and the seller and buyer get emails
- [ ] (API running in Cambodia) Pay a $0.01 item by KHQR: it becomes sold within a few seconds
