# UniSwap Developer & AI Assistant Router

This repository centralizes all project standards, architectural rules, and assistant instructions inside the **[`memory/`](memory/index.md)** directory.

---

## 🧭 Model-to-Instruction Routing

- **Codex / Copilot**: Read **[`memory/rules.md`](memory/rules.md)** for component constraints, TypeScript standards, and backend safety.
- **Claude Code**: Read **[`memory/claude.md`](memory/claude.md)** (or auto-loaded via [`.claude/CLAUDE.md`](.claude/CLAUDE.md)) for CLI commands, testing workflows, and environment setup.
- **Gemini / Antigravity**: Read **[`memory/manager.md`](memory/manager.md)** and **[`memory/changelog.md`](memory/changelog.md)** for the engineering manager framework and recent task handovers.
- **Cline / Roo Code**: Follow the hard constraints in **[`memory/rules.md`](memory/rules.md)** and the master index in **[`memory/index.md`](memory/index.md)**.
- **Project Roadmap**: See **[`memory/plan.md`](memory/plan.md)** for the 2-phase collaboration and evaluation plan.


---

## ⚡ Non-Negotiable Hard Invariants (All Models)
1. **Zero New Packages**: Never install new npm packages or external libraries without explicit user confirmation.
2. **Never Commit Secrets**: Do not write API keys, passwords, or tokens into any file. Secrets live in `.env` / `.env.local`.
3. **Component Sizing**: Keep React components in `frontend/src/components/` under ~80-100 lines. One component per file.
4. **Preserve Demo Deals**: Never delete or modify the 9 simulated demo deals for Chanrithorn Lim's profile stats.
5. **Strict Campus Boundary**: New sign-ups are AUPP only (`@aupp.edu.kh`, in the API and the register form). The DB check constraint and password reset still take any `.edu.kh`, for the `@demo.edu.kh` sample sellers.
6. **Verification Required**:
   - `npm test --prefix backend` must pass every unit test (99 on 4 Nov 2026).
   - `npm run build --prefix frontend` must compile with 0 errors.

---

## 📚 Study Mode (Codex, for Dy)

When Dy asks to learn or study the project, act as a tutor: read only, never change a file. Codex reads files named `AGENTS.md` by itself, not this `Agent.md`, so paste this prompt into Codex from the repository folder:

```
You are my tutor for this repository, UniSwap. Do not change any file; only read and explain. First read memory/claude.md, memory/rules.md and frontend/AGENTS.md. Then teach me the FRONTEND (the frontend/ folder) in plain, simple English, one topic at a time, and wait for me after each one: 1) the folders and how pages and routing work (src/app, the (auth) and (main) groups, [id] pages); 2) how a page gets its data (src/lib/api/http.ts and index.ts; only the Next.js server calls the API; the login cookie); 3) forms and Server Actions (src/lib/api/actions.ts); 4) live chat in the browser (src/hooks/use-live-messages.ts); 5) the look: Tailwind, shadcn/ui, dark mode and the animations in src/app/globals.css. For each topic, show me 3 to 5 real lines from the code with the file name and line number, and say what each line does. After each topic, ask me 2 questions like an examiner would and tell me if my answer is right. At the end, give me a 1-minute summary of the frontend that I can say out loud.
```
