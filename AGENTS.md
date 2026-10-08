# AGENTS.md

Instructions for AI agents and contributors working on this repository.

## Project

Doru — local-first genealogy for the AI era: Electron + TypeScript, monorepo,
SQLite-based tree documents (`tree.doru`), text-based config/themes, MCP
host+server, ACP agents, agent chat with audit trail.

Design rationale: [docs/architecture.md](docs/architecture.md). Deliberate
non-goals: [docs/decisions.md](docs/decisions.md).

## Language policy

- All documents (README.md, AGENTS.md, CONTRIBUTING.md, docs/, commit
  messages) are written in **English only**.
- All code — identifiers, comments, docstrings — is written in **English
  only**.
- Commit messages: English, concise, imperative mood.

## Localization rules (applies to all UI code)

- Never hardcode user-facing strings in the UI. All UI strings go through the
  nls layer with keys of the form `area.feature.message` (see
  docs/architecture.md, Localization section).
- The base language is English: the English source text doubles as the
  fallback value. Add the English bundle entry first, then translations.
- Locale bundles mirror the VS Code display language set: en, ru, fr, de, it,
  es, pt-br, cs, pl, hu, bg, el, tr, ja, ko, zh-cn, zh-tw.
- MCP tool names and other machine identifiers stay in English; only their
  human-readable descriptions are localized.
- MCP tool names must match `^[a-zA-Z0-9_-]+$` — use underscore separators
  (`tree_query`, `sources_add`, `charts_render`). Strict providers (e.g.
  DeepSeek) reject dots and colons.
- Breaking our own APIs — including MCP tool names — is fine before 1.0.0;
  do not add compatibility shims.
- The UI locale always follows the operating system; there is no in-app
  language setting (see docs/decisions.md).

## Architecture conventions

- Strict package boundaries: `packages/core` must not import `platform`,
  `workbench`, or anything UI-related. UI and agents access the domain model
  only through services.
- SQLite is only touched by the Electron main process; renderer and agents go
  through IPC/MCP tools.
- Every tree mutation goes through ops (command pattern with inverse) so that
  undo/redo and the audit log (history.jsonl) stay consistent.
- Keep the service layer free of Electron-specific APIs where feasible
  (allows future Capacitor/mobile reuse).

## Verification

- Unit tests: vitest (`npm test`). E2E: Playwright against Electron
  (`npm run build` first, then `npm run e2e`).
- Typecheck all workspaces: `npm run typecheck`.
- Build the desktop app: `npm run build`; run it in dev mode: `npm run dev`.
- Run tests before considering a change complete.
