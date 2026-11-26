# UniSwap mobile app

The UniSwap phone app, built with Expo (React Native + TypeScript, SDK 58).
It talks to the same Express API (`backend/`) as the website. It sends the login token as
`Authorization: Bearer <token>`.

Phase 1 (12 Nov 2026) has:

- Log in, and sign up with the 6-digit code from the email (AUPP emails only).
- Browse with search and category chips, and pull to refresh.
- The item page: photos you can swipe, price, status, facts, seller with stars, and auction details (read only).
- Saved items: the heart on the item page and the Saved tab.
- Account: name, email and Sign out.

Phase 2 (13 Nov 2026) adds:

- **Inbox** tab: one row per chat (photo, item, the other student, last message, time, unread dot).
  The tab shows a red badge with the unread count.
- **Chat:** open a chat from the Inbox, or with **Message seller** on the item page (signed in, not your own
  item, not sold or traded). New messages show at once, without a reload (see "Live chat" below).
- **Sell** tab: up to 6 photos (camera or library), title, category, condition, and the type: for sale,
  giveaway, for trade (with an optional cash top-up) or wanted (with a budget). Publish opens the new item.
  Auctions stay on the website: they need a date picker, which is another package.
- **Account** becomes your profile: deals, earned and spent (no charts), My listings with a status pill
  (Available, Reserved, Sold, Traded), and Recent purchases.

There are no payments, bids, offers or meetups in the app. Those stay on the website.

## Live chat

- The chat screen opens `GET /api/messages/stream?listingId=&withUserId=` with `expo/fetch` (part of
  `expo`, no extra package), which can read a response bit by bit on iOS (`src/hooks/use-message-stream.ts`,
  `src/lib/sse.ts`).
- The stream is open only while the chat is on screen AND the app is in front. It closes when you leave
  the chat or the app goes to the background (`AppState`).
- **Why:** the API skips the email and Telegram alert while a stream is open on that chat. A stream left
  open in the background would hide alerts from the student.
- If the stream breaks (for example, the API restarts), the app waits 3 s, opens it again (5 tries at
  most) and reloads the chat, so no message is lost.

## Photos

- Each photo uploads as soon as you pick it (`POST /api/uploads`, JPEG at quality 0.6, at most 5 MB:
  the API's own limit; the website uses 4 MB only because Vercel sits in its path).
  Only the addresses are sent with the listing.
- Seed photos such as `/listings/calculus-book.jpg` are files of the website, so the app cannot load them.
  It shows the category icon instead (`canShowPhoto` in `src/lib/format.ts`).

## Run it

You need the API running first (`npm run dev` in `backend/`, on http://localhost:4000).

```bash
cd mobile
npm install
cp .env.example .env
npx expo start
```

Then press `i` to open the app in the iPhone simulator (Xcode must be installed).
The first time, Expo installs the Expo Go app in the simulator.

### On a real phone

1. Install Expo Go from the App Store.
2. Put the phone and the laptop on the same Wi-Fi.
3. In `mobile/.env`, set `EXPO_PUBLIC_API_URL=http://<laptop-ip>:4000` (find the IP with `ipconfig getifaddr en0`).
4. Run `npx expo start` again and scan the QR code with the phone camera.

## Where things are

- `src/app/`: one file is one screen (Expo Router, like the Next.js App Router).
  - `(tabs)/`: the five tabs, Browse (`index.tsx`), Sell, Inbox, Saved and Account.
  - `listings/[id].tsx`: the item page.
  - `chat/[listingId]/[userId].tsx`: one chat (about one item, with one student).
  - `login.tsx`, `register.tsx`, `verify.tsx`: log in, sign up, and the 6-digit code.
- `src/lib/api.ts`: one `fetch` wrapper (API address, JSON, Bearer token, error message from `{ error }`).
- `src/lib/auth.tsx`: who is signed in. The token is kept in `expo-secure-store` only.
- `src/lib/format.ts`, `src/types.ts`, `src/theme.ts`: labels, prices, types and colours, copied from `frontend/`.
- `src/components/`: small parts (cards, search box, heart, photo pager, seller card...).
- `src/hooks/`: loading data (`use-listings`, `use-conversations`, `use-thread`, `use-profile`), the live
  stream (`use-message-stream`), the Sell form (`use-sell-form`, `use-sell-photos`) and app state
  (`use-app-active`, `use-screen-focused`).

## Rules

- The login token goes only in `expo-secure-store` (key `uniswap_token`). Never in AsyncStorage or a file.
- `EXPO_PUBLIC_*` values are built into the app, so anyone can read them. `mobile/.env` holds only
  `EXPO_PUBLIC_API_URL`. Never put a secret there. `.env` is git-ignored.
- Add packages only after the team agrees, and only with `npx expo install <name>`.
- Check the code with `npx tsc --noEmit`. Do not run `npx expo lint` (it would install ESLint).
- One component per file, about 80 lines at most. Each file starts with a short comment.
- No Android SDK on the team laptop: test in the iPhone simulator.
