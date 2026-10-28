# UniSwap AI Development Guide & Memory Beacon

Universal instructions for AI coding assistants (Codex, Claude, Gemini, Cline, Copilot) working in this repository.

All detailed project standards, architecture docs, and technical logs are centralized in the **[`memory/`](memory/index.md)** directory.

---

## 🧭 Navigation Map
- **[memory/rules.md](memory/rules.md)**: Hard development rules, component line limits, and stack specifications.
- **[memory/manager.md](memory/manager.md)**: Engineering Manager workflow, quality gates, and delegation guidelines.
- **[memory/changelog.md](memory/changelog.md)**: Technical handover log and recent implementations.

---

## ⚡ Non-Negotiable Hard Rules
1. **Zero New Packages**: Never install new npm packages or external libraries without explicit user confirmation.
2. **Never Commit Secrets**: Do not write API keys, passwords, or tokens into any file. All secrets live in `.env` or `.env.local`.
3. **Component Sizing**: Keep React components in `frontend/src/components/` under ~80-100 lines. One component per file.
4. **Preserve Demo Deals**: Never delete or modify the 9 simulated demo deals for Chanrithorn Lim's profile stats.
5. **Strict Campus Boundary**: Cambodian university emails ending in `.edu.kh` are strictly enforced across DB check constraints and forms.
6. **Verification Required**:
   - `npm test` in `backend/` must pass 78+ unit tests.
   - `npm run build` in `frontend/` must compile with 0 errors.
