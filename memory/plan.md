# UniSwap Project Roadmap & 2-Phase Repository Plan

This document records the master operational plan agreed upon for the final year project development and evaluation handover.

---

## 📌 The 2-Phase Handover Plan

### Phase 1: Active Team Co-Development (Current Phase)
- **Goal**: Rapid feature delivery, testing, and seamless collaboration between team members (**Long Vathanak** & **Dy Nobsokun**).
- **Tools**: Gemini / Antigravity, Claude Code, and partner's OpenAI Codex / VS Code.
- **Repository Strategy**:
  - Keep `memory/` and root `Agent.md` tracked on GitHub branch `implement_backend`.
  - Enables Codex and Claude to automatically sync the exact same database constraints, 80-line component rules, and test verification standards on both machines.
  - Write clean, professional commit messages (e.g. `refactor: ...`, `docs: ...`, `feat: ...`) avoiding conversational chatter.
  - Automatically commit updates upon completion with periodic push reminders.

---

### Phase 2: Pre-Evaluation Stealth & Presentation Cleanup (Before Final Presentation)
- **Goal**: Prepare a 100% clean, professional, human-crafted repository for professors, grading committees (Prof. Chandan Mukherjee), and public viewers.
- **Handover Checklist**:
  1. **Convert Rules to `CONTRIBUTING.md`**:
     - Transform `memory/rules.md` into a formal `CONTRIBUTING.md` in the root (showcasing high-discipline software engineering practices like component size limits and university email restrictions).
  2. **Untrack AI Files from Git**:
     - Run `git rm --cached -r memory/ Agent.md` so Git stops tracking them on GitHub, but preserves them intact on your local laptop.
  3. **Activate `.git/info/exclude`**:
     - Add `memory/` and `Agent.md` to `.git/info/exclude` (local secret ignore file).
     - Keeps the public `.gitignore` completely clean (no mention of AI files).
  4. **Commit & History Polish**:
     - Commit the clean state.
     - The public GitHub repository will display only standard production directories: `backend/`, `frontend/`, `README.md`, `DEPLOY.md`, and `CONTRIBUTING.md`.

---

## 🎯 Current Feature Milestones & Backlog

1. **Auction & Bidding Pipeline**:
   - Reset test bids and verify clean auction state on `Gigabyte RTX 3090`.
   - Test outbid notifications delivery via Telegram bot (`@uniswap88k_bot`).
2. **Payment Checkout Flow**:
   - Stripe card checkout verification.
   - Invoice receipt generation and Telegram receipt message actions.
3. **Demo Presentation Mode**:
   - Live presentation presets with <kbd>Tab</kbd>-to-fill UX for the 5 listing types (`sale`, `auction`, `trade`, `giveaway`, `buy_request`).
   - Verified zero-flicker cached image uploads.
