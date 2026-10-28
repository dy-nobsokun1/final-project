# UniSwap Knowledge & Memory Bank

Welcome to the **UniSwap Memory Bank**. This folder contains central architectural rules, delegation workflows, and progress logs shared across developers and their AI assistants (Codex, Claude, Gemini, Cline).

## Documentation Map

1. **[rules.md](rules.md)**:
   - **Core Rules**: Hard constraints, 80-line component limit, no new npm packages, `.edu.kh` university email validation, and preservation of the 9 simulated demo deals.
   - **Architecture**: Next.js 15 App Router conventions and Node.js 24 + Express + Supabase backend standards.

2. **[manager.md](manager.md)**:
   - **Engineering Manager Persona**: The 4-stage management loop (Deconstruct, Plan, Delegate, Verify).
   - **Quality Gates**: Pre-commit automated test commands and Turbopack build checks.

3. **[changelog.md](changelog.md)**:
   - **Technical Handover Log**: Detailed history of recent features, database migrations, Telegram bot integrations, and bug fixes.

---

## Quick Reference for AI Agents
- Before modifying or generating code, check **[rules.md](rules.md)**.
- Before committing any code, run:
  - `npm test --prefix backend`
  - `npm run build --prefix frontend`
