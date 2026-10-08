# Architecture Notes

The "why" behind choices that are not obvious from the code itself. For
decisions about what we deliberately do **not** build, see
[decisions.md](decisions.md).

## Project format

- The project is an **ordinary folder**, not a single file and not a macOS
  package. Config, theme, and history stay real text files that humans and
  agents can edit with any editor; photos stay real files in `media/`.
- `tree.doru` is SQLite with:
  - `journal_mode=DELETE` — WAL would leave `-wal`/`-shm` sidecars next to a
    "document" file and invites file-sync corruption;
  - `application_id = 0x444F5255` ("DORU") — brands the file so it is
    recognizable even in a generic SQLite browser;
  - `user_version` — the schema migration counter.
- Opening a project is **idempotent and silent**: missing pieces are recreated
  (template files, dirs, an empty tree with the latest schema). The only loud
  case is a corrupted database — that must not be silently "healed" away.

## Mutations

- Every change goes through **ops** (command pattern with inverse), giving a
  single path for undo/redo, the audit log, and (potentially) sync. SQLite is
  the single source of truth; the in-memory `TreeDocument` exists only as an
  import/export DTO.
- Repository transactions are **reentrant** (SQLite cannot nest `BEGIN`):
  outer op transactions can freely call repository methods that use their own
  transaction.
- Family links are filtered against existing persons at write time — foreign
  keys protect referential integrity without hard-failing on GEDCOM files that
  contain dangling references.
- Person search uses an **FTS5** virtual table (external content, synced by
  triggers) with prefix matching and rank ordering; any FTS failure falls back
  to a `LIKE` scan. An empty query lists persons without searching.

## GEDCOM

- **Import**: `read-gedcom` for tolerant parsing (encoding detection,
  non-standard dialects). The importer walks the low-level `TreeNode` tree
  rather than the `Selection` API — the tree is plain data and far easier to
  map. A sanitization layer above it handles ANSEL/BOM/dialect quirks.
- **Export**: our own minimal GEDCOM 7.0 writer. There are no mature
  TypeScript GEDCOM writers; writing is an order of magnitude simpler than
  parsing, and we only ever write canonical output.

## Localization

- The message **key is the English source string**; bundles are typed against
  the English bundle, so a key missing from `en` is a compile error ("add
  English first"), and a missing translation silently falls back to English.
- `resolveLocale` maps OS locales onto the 17 shipped bundles: exact match →
  `zh-hans`/`zh-hant` scripts → language-base mapping (`pt` → `pt-br`,
  `zh` → `zh-cn`) → `en`.
- The UI locale always follows the OS; see decisions.md.

## AI and agents

- **Audit actors** in `history.jsonl`:
  - `user` — manual edits;
  - `agent:{host}/{model}#{promptHash}` — OpenAI-compatible chat (12-hex
    SHA-256 of the last user message);
  - `agent:acp:{command}` — ACP agent (the doru subprocess it spawns inherits
    the actor via the `DORU_MCP_ACTOR` env var);
  - `agent:mcp` — external MCP clients driving `doru --mcp-server`.
- **Permissions**: read-only tools (`tree_query`, `charts_render`) run freely,
  mutating tools ask via an inline card (2-minute timeout denies), and tools
  from external MCP servers always ask.
- **MCP server mode** runs the same Electron binary over stdio
  (`doru --mcp-server <project>`); no separate build artifact.
- **MCP host** tools are prefixed `server:tool` so external servers cannot
  collide with built-ins; servers are spawned per chat turn and closed after.
- **ACP** (Agent Client Protocol): Doru passes its own MCP server — a
  `doru --mcp-server` subprocess — to the agent in `session/new`, so agents
  get the full tool set without a separate protocol for tree access; the
  agent's `session/request_permission` is routed into the same UI gate.
- **Providers**: the in-app Settings (gear icon) offers presets — OpenAI,
  Anthropic, Google Gemini, OpenRouter, Ollama, LM Studio, a custom
  OpenAI-compatible endpoint, and ACP. Everything except Anthropic and ACP
  speaks the OpenAI-compatible chat dialect (Gemini exposes one); Anthropic
  has its own connector (`/v1/messages`, `x-api-key`, tool_use/tool_result).
  Presets live in `packages/ai/src/providers.ts`; the config file stores only
  the provider id, base URL override, and model.
- **API keys** are entered only in the Settings UI and stored via
  `safeStorage` (OS keychain) into `ai.apiKeyEncrypted` in `doru.json`; the
  plaintext never sits in the file. `DORU_AI_API_KEY`/`DORU_AI_MODEL` env vars
  still override. Settings changes go through `jsonc-parser` edits so the
  file stays human-readable JSONC.

## Theming

- Cascade: hardcoded baseline palette < selected built-in theme < project
  `theme.css` (hot-reloaded via `fs.watch`). The built-in theme is chosen per
  OS appearance from `doru.json` (`theme.dark`/`theme.light`); the OS is the
  only authority for light vs dark.
- Built-in themes ship as real files in app resources (`themes/`), so the
  same mechanism could serve user-installed themes later.

## Packaging and releases

- Artifact naming is `doru-{os}-{arch}.{ext}` with no version (the tag carries
  it). The combined multi-arch NSIS installer that electron-builder emits
  alongside per-arch installers is excluded from releases.
- mac zip and blockmaps are published even though auto-update is not wired
  yet — they exist so electron-updater can land without packaging changes.
- macOS signing uses a manually prepared keychain in CI (electron-builder's
  own temporary keychain trips over `set-key-partition-list`); notarization
  uses an App Store Connect API key (see `docs/signing.md`).

## Processes

- SQLite is touched only by the Electron main process; the renderer and
  agents go through IPC/MCP tools. `core` and `platform` must stay free of
  Electron imports — that is the guarantee that keeps a future mobile client
  (and a plugin host) possible.
