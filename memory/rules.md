# UniSwap AI Development Rules & Standards

Instructions for AI coding agents (Codex, Claude, Gemini, Cline) working on UniSwap. Both human developers and AI assistants must follow these rules.

## Hard Rules

1. **No Unsolicited Packages**: If a task seems to need a package, stop and discuss with the user instead of installing it. Zero new external dependencies.
2. **Never Commit Secrets**: Never write an API key, token, password, or secret into any file. This repository is public. All secrets live in `.env` or `.env.local`.
3. **Scoped Diffs**: Keep diffs scoped to what was requested. If completing the task requires touching another file, explain why first.
4. **Component Sizing**: One component per file in `components/`, using React function components, roughly 80 lines or less. If a component consistently exceeds ~100 lines or handles multiple responsibilities, split it.
5. **Legibility Over Arbitrary Splitting**: Do not split a component solely to satisfy the line limit if doing so makes the code harder to understand.
6. **No Class Components**: Use functional React components and hooks only.
7. **Reuse Existing Primitives**: Before creating a new component, check whether an existing component in `components/ui/` or `components/` can be reused.
8. **No Duplicate Components**: Do not create duplicate components with overlapping responsibilities.
9. **No Unrequested Refactors**: Do not rewrite or refactor unrelated code while completing a task.
10. **Preserve Demo Deals**: Never delete or overwrite the 9 simulated demo deals created for Chanrithorn Lim's profile stats (`DEMO_DEAL_TITLES` in `backend/scripts/db-reset-sold.js`).
11. **Strict Campus Boundary**: Cambodian university emails ending in `.edu.kh` are strictly enforced across DB constraints, backend regex, and frontend forms.
12. **Defensible Code**: Write code and explanations that the students can defend line-by-line during academic and peer review.

---

## Frontend Stack & Architecture

- **Framework**: Next.js 15 (App Router) + TypeScript + Turbopack
- **Styling**: Tailwind CSS
- **Primitives**: shadcn/ui
- **Structure**:
  ```
  frontend/src/
  ├── components/
  │   ├── ui/                  # shadcn/ui primitives
  │   ├── layout/              # Navbar, Sidebar, Footer
  │   ├── listings/            # Listing cards, invoice receipts, pay buttons
  │   ├── marketplace/         # Browse, search, filter, and assistant box
  │   ├── chat/                # Messaging threads
  │   ├── profile/             # Profile & reputation stats
  │   └── forms/               # Reusable forms (NewListingForm, AuctionFields)
  ├── hooks/                   # Custom hooks (listing photos, voice input)
  └── lib/                     # Demo presets, utilities, API fetchers
  ```

---

## Backend Stack & Architecture

- **Runtime**: Node.js 24 + Express + Native ES Modules (`type: "module"`)
- **Database**: PostgreSQL with `pg` pool (Supabase Cloud + local Postgres on port 5433 fallback)
- **Integrations**: Stripe Checkout (card), Bakong KHQR (mobile banking), Telegram Bot API (`notify.js`, `telegram.js`)
- **Safety**: Always use parameterized queries (`$1`, `$2`), never string interpolation. Protect transactions with `withTransaction()`.

---

## Verification Gates Before Every Commit
- **Backend**: `npm test` in `backend/` must pass 78+ unit tests.
- **Frontend**: `npm run build` in `frontend/` must complete with zero errors.
