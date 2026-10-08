# Doru

> **Local-first genealogy for the AI era.**

The name comes from Proto-Indo-European _\*dóru_ — "tree".

A cross-platform desktop app for working with family trees: your data stays in
plain folders on your disk, works fully offline, and is designed to be driven
by AI agents through MCP and chat.

**Status:** v0 and v1 are implemented: local-first project editor (GEDCOM
import/export, tabs, person editing, families, sources, undo), 17 UI locales,
MCP server mode, MCP host tools, an ACP agent provider, an in-app agent chat
with tool calls, permission prompts, and an audit trail. See the
[User Guide](docs/user-guide.md) for installation and usage,
[docs/architecture.md](docs/architecture.md) for the "why" behind the design,
and [docs/decisions.md](docs/decisions.md) for what we deliberately do not
build.

## Highlights

- **Local-first.** A project is a plain folder containing a `tree.doru` SQLite
  database, text-based `settings.json` and `theme.css`, and a `history.jsonl`
  audit log. Nothing is hidden; everything is editable by hand or by agents.
- **AI-native.** Doru is both an MCP server — run `doru --mcp-server <project>`
  and any MCP client (Claude Desktop, Cursor) can query and edit your tree
  through `tree_query`, `tree_edit`, `sources_add`, `notes_write`,
  `charts_render` — and an agent chat built into the UI: provider presets
  (OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio, custom
  endpoints) configured in the in-app settings with keys stored in the OS
  keychain, external MCP servers, and ACP agents.
- **Auditable.** Every mutation is recorded with its actor — user or agent
  (`agent:{host}/{model}#{promptHash}`). AI edits are always reviewable and
  gated by permission prompts.
- **VS Code look and feel.** Workbench-style layout (activity bar, sidebar,
  tabs, editor area, panel, command palette), themes as text files,
  text-based configuration, codicons.

## Tech stack

TypeScript (strict, ESM) on Electron, monorepo with npm workspaces:
`platform` (base services, i18n for 17 locales, theming, config), `core`
(genealogy domain, GEDCOM, SQLite), `workbench` (UI shell), `ai`
(agent runtime, MCP server, connectors, audit), `features` (domain UI).
SQLite via `node:sqlite`, GEDCOM import via `read-gedcom`, own canonical
GEDCOM 7.0 writer, `@modelcontextprotocol/sdk` for MCP. Tests: vitest (unit)
+ Playwright (e2e). CI and release installers (macOS/Linux/Windows, x64/arm64)
via GitHub Actions.

## Development

Requirements: Node.js >= 22.13 (built-in `node:sqlite`) and npm.

```sh
npm install
npm run dev          # run the desktop app in dev mode
npm test             # unit tests (vitest)
npm run typecheck    # strict TypeScript across all workspaces
npm run build        # production build (electron-vite)
npm run e2e          # Playwright smoke test against the built app
npm run site:dev     # the VitePress website
```

## Language policy

All documents and all code — including comments and identifiers — are in
English. See AGENTS.md.
