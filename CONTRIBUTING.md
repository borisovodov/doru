# Contributing to Doru

Thanks for your interest in contributing! Doru is a local-first genealogy app
for the AI era. This guide covers how to set up the project and propose
changes.

## Before you start

- Read [AGENTS.md](AGENTS.md) — it defines the language policy, localization
  rules, and architecture conventions that all contributions must follow.
- The architecture and roadmap live in [docs/plan.md](docs/plan.md) (in
  Russian); the codebase and all permanent documents are in English.

## Getting started

Requirements: Node.js >= 22.13 (Doru uses the built-in `node:sqlite`) and npm.

```sh
npm install
npm run dev        # run the desktop app in dev mode
```

## Verification

Run all of these before opening a pull request:

```sh
npm test           # unit tests (vitest)
npm run typecheck  # strict TypeScript across all workspaces
npm run build      # production build (electron-vite)
npm run e2e        # Playwright smoke test against the built app
```

## Repository layout

- `apps/desktop` — Electron shell: main process, preload, renderer bootstrap
- `packages/platform` — base services: DI, commands, events, config, theming,
  localization (nls)
- `packages/core` — genealogy domain: GEDCOM, ops, SQLite tree store, project
  self-healing (no UI dependencies)
- `packages/workbench` — VS Code-style UI shell
- `packages/features` — domain UI
- `packages/ai` — agent layer: connectors, tools, permissions, audit log

## Making changes

- Open an issue first for anything non-trivial, or comment on an existing one.
- Keep pull requests focused and small; describe what and why.
- All user-facing strings go through the nls layer (see AGENTS.md); never
  hardcode UI text.
- Commit messages in English, concise, imperative mood (e.g. `fix: handle
  corrupted tree files gracefully`).
- Add or update tests for new behavior in `packages/*/tests`.

## Code of conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE.md).
