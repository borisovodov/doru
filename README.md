# Doru

> **Local-first genealogy for the AI era.**

The name comes from Proto-Indo-European _\*dóru_ — "tree".

A cross-platform desktop app for working with family trees: your data stays in
plain folders on your disk, works fully offline, and is designed to be driven
by AI agents through MCP and chat.

**Status:** design phase. The codebase has not been scaffolded yet. See
[docs/plan.md](docs/plan.md) (in Russian) for the full architecture and roadmap.

## Highlights

- **Local-first.** A project is a plain folder containing a `tree.doru` SQLite
  database, text-based `settings.json` and `theme.css`, and a `history.jsonl`
  audit log. Nothing is hidden; everything is editable by hand or by agents.
- **AI-native.** Doru is both an MCP host (connect FamilySearch, Gramps Web,
  Ollama, web search) and an MCP server (any MCP client can query and edit your
  tree). An in-app chat panel lets you edit and research your tree through
  conversation. ACP support planned once the protocol matures.
- **Auditable.** Every mutation is recorded with its actor — user or agent
  (provider, model, prompt hash). AI edits are always reviewable.
- **VS Code look and feel.** Workbench-style layout (activity bar, sidebar,
  editor area, panel, command palette), themes as text files, text-based
  configuration, Monaco editor, codicons.

## Tech stack

TypeScript (strict, ESM) on Electron, monorepo with npm workspaces:
`platform` (base services, i18n, theming, config), `core` (genealogy domain,
GEDCOM, SQLite), `workbench` (UI shell), `ai` (MCP/agents), `features`
(domain UI). SQLite via better-sqlite3, GEDCOM import via `read-gedcom`,
own canonical GEDCOM 7.0 writer, `@modelcontextprotocol/sdk` for MCP.
Tests: vitest (unit) + Playwright (e2e).

## Development

Coming in v0 scaffolding. See [docs/plan.md](docs/plan.md).

## Language policy

All permanent documents (README, AGENTS.md, etc.) and all code — including
comments and identifiers — are in English. Intermediate working documents
(e.g. docs in Russian) are acceptable; see AGENTS.md.
