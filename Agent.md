# UniSwap AI Development Rules

Instructions for AI coding agents working in this repository. Cline, VS Code agent mode, and most other tools read this file automatically. Students: read it too. These are the rules your AI partner is being held to, and they are the same rules you are graded against.

## Hard Rules

1. If a task seems to need a package, stop and say so instead of installing it.
2. Never write an API key, token, password, or other secret into any file. This repository is public.
3. Keep diffs scoped to what was asked. If completing the task honestly requires touching another file, say which file and why before editing it.
4. One component per file in `components/`, using React function components, roughly 80 lines or less. If a component consistently exceeds ~100 lines or handles multiple responsibilities, split it.
5. Do not split a component solely to satisfy the line limit if doing so makes the code harder to understand.
6. Do not use class components.
7. Do not introduce new libraries, frameworks, or dependencies without asking first.
8. Before creating a new component, check whether an existing component can be reused.
9. Do not create duplicate components with overlapping responsibilities.
10. Do not rewrite or refactor unrelated code while completing a task.

## Working Style

1. For anything beyond a one-file change, state a short plan before writing code.
2. Explain changes plainly. The student must be able to defend every line in a code review. Write code and explanations that make that possible.
3. The student reviews and approves every diff.
4. Expect rejections and make them easy: use small steps, clear boundaries, and focused changes.
5. Do not make additional improvements, refactors, or feature changes unless explicitly requested.
6. When uncertain about an architectural or product decision, stop and ask rather than making assumptions.
7. After completing a change, briefly explain:
   - What changed
   - Which files changed
   - Why they changed
   - Anything the student should test

## Frontend Stack

- React + TypeScript
- Tailwind CSS
- shadcn/ui

## UI Rules

1. Use Tailwind CSS for styling.
2. Use shadcn/ui for common UI primitives and components.
3. Prefer existing shadcn/ui components over building common UI primitives from scratch.
4. Customize shadcn/ui components with Tailwind when necessary.
5. Do not introduce another CSS framework or component library without approval.
6. Keep business-specific components separate from generic UI components.

## Component Rules

- Use React function components.
- Do not use class components.
- Keep components focused on one clear responsibility.
- Prefer composition over large monolithic components.
- Avoid unnecessary abstractions.
- Avoid creating custom abstractions unless they solve a recurring problem.
- Reuse existing components when appropriate.
- One component per file.
- Keep components roughly 80 lines or less.
- If a component consistently exceeds ~100 lines or handles multiple responsibilities, consider splitting it.

## Component Structure

components/
├── ui/                  # shadcn/ui primitives
├── layout/              # Navbar, Sidebar, Footer
├── listings/            # Listing-specific components
├── marketplace/         # Browse, search, and filter components
├── chat/                # Messaging components
├── profile/             # Profile components
└── forms/               # Complex reusable forms

## Component Philosophy

- shadcn/ui provides reusable UI primitives.
- UniSwap components provide application-specific behavior.
- Tailwind handles styling and layout.
- React handles component structure and behavior.
- TypeScript provides type safety.
- Prefer simple, readable implementations over clever abstractions.
- Code should be understandable to a student reviewing it line by line.

Everything else in the hard rules stands, especially rule 3: no keys, tokens, or passwords in any committed file, ever. Auth configuration lives in .env.local and in Vercel environment variables.