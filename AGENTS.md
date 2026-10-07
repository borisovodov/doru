# AGENTS.md

Instructions for AI agents and contributors working on this repository.

## Project

Doru — local-first genealogy for the AI era ("Obsidian of genealogy"): Electron
+ TypeScript, monorepo, SQLite-based tree documents (`tree.doru`), text-based
config/themes, MCP host+server, agent chat with audit trail.

Full architecture and roadmap: [docs/plan.md](docs/plan.md) (Russian).

## Language policy

- All permanent documents (README.md, AGENTS.md, CONTRIBUTING.md, etc.) are
  written in **English only**.
- All code — identifiers, comments, docstrings, commit messages — is written
  in **English only**.
- Intermediate working documents (e.g. notes under `docs/` marked as drafts,
  design explorations) may be written in Russian.
- Commit messages: English, concise, imperative mood.

## Localization rules (applies to all UI code)

- Never hardcode user-facing strings in the UI. All UI strings go through the
  nls layer with keys of the form `area.feature.message` (see
  docs/plan.md section 9).
- The base language is English: the English source text doubles as the
  fallback value. Add the English bundle entry first, then translations.
- MCP tool names and other machine identifiers stay in English; only their
  human-readable descriptions are localized.
- Locale is configurable via `settings.json` (`locale` key), auto-detected
  from the OS on first run, fallback chain to `en`, hot-switchable at runtime.

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

- Unit tests: vitest. E2E: Playwright (against Electron).
- Run tests before considering a change complete.
- Build/typecheck commands will be documented here once v0 scaffolding lands.
