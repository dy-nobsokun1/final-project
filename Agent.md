# UniSwap Developer & AI Assistant Router

This repository centralizes all project standards, architectural rules, and assistant instructions inside the **[`memory/`](memory/index.md)** directory.

---

## 🧭 Model-to-Instruction Routing

- **Codex / Copilot**: Read **[`memory/rules.md`](memory/rules.md)** for component constraints, TypeScript standards, and backend safety.
- **Claude Code**: Read **[`memory/claude.md`](memory/claude.md)** (or auto-loaded via [`.claude/CLAUDE.md`](.claude/CLAUDE.md)) for CLI commands, testing workflows, and environment setup.
- **Gemini / Antigravity**: Read **[`memory/manager.md`](memory/manager.md)** and **[`memory/changelog.md`](memory/changelog.md)** for the engineering manager framework and recent task handovers.
- **Cline / Roo Code**: Follow the hard constraints in **[`memory/rules.md`](memory/rules.md)** and the master index in **[`memory/index.md`](memory/index.md)**.

---

## ⚡ Non-Negotiable Hard Invariants (All Models)
1. **Zero New Packages**: Never install new npm packages or external libraries without explicit user confirmation.
2. **Never Commit Secrets**: Do not write API keys, passwords, or tokens into any file. Secrets live in `.env` / `.env.local`.
3. **Component Sizing**: Keep React components in `frontend/src/components/` under ~80-100 lines. One component per file.
4. **Preserve Demo Deals**: Never delete or modify the 9 simulated demo deals for Chanrithorn Lim's profile stats.
5. **Strict Campus Boundary**: Cambodian university emails ending in `.edu.kh` are strictly enforced across DB check constraints and forms.
6. **Verification Required**:
   - `npm test --prefix backend` must pass 78+ unit tests.
   - `npm run build --prefix frontend` must compile with 0 errors.
