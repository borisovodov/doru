# Architecture Notes

The "why" behind choices that are not obvious from the code itself. For
decisions about what we deliberately do **not** build, see
[decisions.md](decisions.md).

## Project format

- The project **is a single `.doru` file** — a SQLite database branded with
  an app id. Photos and scans are ordinary files in a `media/` folder next to
  it, created on demand (its absence is normal).
- The file's name is the project's name. Moving or renaming the file moves or
  renames the project.
- The `.doru` file is SQLite with:
  - `journal_mode=DELETE` — WAL would leave `-wal`/`-shm` sidecars next to a
    "document" file and invites file-sync corruption;
  - `application_id = 0x444F5255` ("DORU") — brands the file so it is
    recognizable even in a generic SQLite browser;
  - `user_version` — the schema migration counter.
- Opening a project is **idempotent**: an existing file opens as-is, a new one
  is created with the latest schema. The only loud case is a corrupted
  database — that must not be silently "healed" away.

## Privacy

- The app makes no network calls on its own: no accounts, no cloud backend,
  no telemetry, no analytics, no update checks. The only network activity is
  what the user explicitly configures — an AI provider in Settings. Model
  lists are fetched only from endpoints the user configured: automatically
  for local ones (localhost — Ollama, LM Studio), by an explicit button press
  for anything else.
- AI provider keys are entered only in the Settings UI and stored encrypted
  via the OS keychain; the plaintext never sits in a file.
- Tree data leaves the machine only when the user sends it: a chat message to
  a configured provider or an explicit export. This guarantee is load-bearing
  for the product — see the Monetization decision in decisions.md.

## Mutations

- Every change goes through **ops** (command pattern with inverse), giving a
  single path for undo/redo and (potentially) sync. SQLite is
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

- GEDCOM import and export live in the dedicated `@doru/gedcom` package
  (GEDCOM 5.5.1, GEDCOM 7.0, GEDZIP; the GEDCOM 5.5.5 vocabulary parses
  on 5.x import), kept free of runtime dependencies and
  of Electron. The package is not wired to the tree database yet: the
  desktop export IPC handler (`project:export`) stays wired to the UI but
  is a no-op until the dataset → tree mapping lands.
- The app registers `.ged`/`.gdz` file associations (next to `.doru`) and
  routes every opened file by extension. Opening a GEDCOM file imports it
  into a new **not-yet-saved project** — the import itself is currently
  stubbed, so the project opens empty: the data lives in a temporary
  `.doru` store under the OS temp directory, keyed `untitled:<uuid>`, and
  the window shows the imported file's name with an unsaved marker. The
  first save asks for a `.doru` location, moves the store and media folder
  there and rebinds the window to the real path; from then on the project
  autosaves like any other.

## Localization

- The message **key is the English source string**; bundles are typed against
  the English bundle, so a key missing from `en` is a compile error ("add
  English first"), and a missing translation silently falls back to English.
- `resolveLocale` maps OS locales onto the 17 shipped bundles: exact match →
  `zh-hans`/`zh-hant` scripts → language-base mapping (`pt` → `pt-br`,
  `zh` → `zh-cn`) → `en`.
- The UI locale always follows the OS; see decisions.md.

## AI and agents

- **MCP server mode** runs the same Electron binary over stdio
  (`doru --mcp-server <project>`); no separate build artifact.
- **ACP** (Agent Client Protocol): Dóru passes its own MCP server — a
  `doru --mcp-server` subprocess — to the agent in `session/new`, so agents
  get the full tool set without a separate protocol for tree access; the
  agent's `session/request_permission` requests are auto-allowed for now.
- **Runtime**: the agent loop is powered by the Vercel AI SDK (`streamText`
  with tools and step-count stop); text streams to the chat as deltas, tool
  activity lands in the transcript as steps, and a Stop button aborts the run
  through an `AbortSignal`. Anthropic uses `@ai-sdk/anthropic`;
  everything else speaks the OpenAI-compatible chat dialect through
  `@ai-sdk/openai-compatible`.
  The wire dialect is derived from the provider registry, not stored in
  settings. The toolset comes from a single shared definition list
  (`doruTools`), which feeds both the in-app AI SDK tools and the MCP server.
- **Chat sessions**: Dóru owns every conversation — transcripts live as JSONL
  files under `<userData>/sessions/<projectKeyHash>/` (never inside the
  `.doru` document; chat is not family data). The transcript is the single
  source of truth for every provider: models get it replayed as message
  context each turn, and an ACP agent gets a fresh agent session with the
  transcript replayed into it whenever the user switches chat sessions — no
  `session/resume` bookkeeping. The panel header lists sessions with
  auto-generated titles plus new/delete.
- **Model catalog**: `@opencode-ai/models` (the official models.dev package)
  ships the offline snapshot — provider lists, pricing, limits, capabilities
  and reasoning options — curated in `packages/ai/src/catalog.ts`. Providers
  resolve in `packages/ai/src/providers.ts`; a refresh at release time is a
  version bump of that package.
- **Model lists**: catalog providers pick models from the shipped offline
  catalog. Catalog-less providers (Ollama, LM Studio, custom
  OpenAI-compatible endpoints) walk a Settings wizard: a fetch button pulls
  the list from the provider's own endpoint and the pick becomes a dropdown;
  local providers also auto-fetch when Settings opens or the provider
  changes. The fetched list is the truth — a saved model missing from it is
  replaced by the first entry and persisted; a failed or empty fetch never
  touches the saved settings.
- **Providers**: Ollama, LM Studio, a custom OpenAI-compatible endpoint, and
  ACP. Cloud presets (OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek) are
  temporarily unlisted while they are rebuilt one by one.
  `settings.json` records the active provider id plus per-provider entries
  (model, base URL, reasoning level, ACP command/args) keyed by provider id —
  only the active provider's entry is used, so switching restores each
  provider's own setup. Defaults resolve in `ai-settings.ts`.
- **API keys** are entered only in the Settings UI and stored in
  `secrets.json` (mode 0600) in the data directory, keyed by provider id and
  separate from `settings.json` so sharing settings never leaks keys. No OS
  keychain is involved. Settings changes go through `jsonc-parser` edits so
  the file stays human-readable JSONC.

## Theming

- Cascade: hardcoded baseline palette < selected built-in theme. One theme
  file holds both the dark and the light palette; `settings.json` picks the
  theme (`"theme": "doru"`). The operating system appearance is the only
  authority for light vs dark.
- User themes live in `<userData>/themes/*.json` (the directory is created
  on startup) and override a bundled theme with the same id.
- The Settings page hosts the AI provider section as a step-by-step wizard per
  provider kind — endpoint and key first, then the model (fetched for local
  providers, picked from the offline catalog for cloud presets, typed as a
  command for ACP), then reasoning and the connection test — plus the
  Theme dropdown and an "Open log file" button; picking a theme goes through
  the `theme:set` IPC, which writes `settings.json` — the same path as editing
  the file by hand.
- Built-in themes are single JSON palette files in app resources (`themes/`),
  resolved to CSS custom properties at startup — the same mechanism could
  serve user-installed themes later.
- JSON Schemas for `settings.json` and theme files are generated from the zod
  schemas in `apps/desktop/src/main/schemas.ts` into `apps/website/public/`
  (published at `doru.family/`) — run `scripts/generate-schemas.ts` after
  edits; `check:schemas` (CI) fails when the committed files drift and
  validates the settings template and bundled themes with the same zod schemas.
  The main process also validates at load time: a `settings.json` that fails
  to parse or fails the schema is replaced with the empty template (a warning
  is logged), and an invalid theme file is skipped and hidden from the theme
  list.

## Logging

- Logs go to the console (stderr — stdout carries the MCP protocol in server
  mode) and to `<userData>/doru.log` via `electron-log` (appended across
  runs, rotated at 5 MB). The default verbosity is `warn` — quiet on user
  machines; `npm run dev` raises it to `debug` (`import.meta.env.DEV`).
  `DORU_LOG_LEVEL` (trace|debug|info|warn|error) always wins; the main
  process wires it up in `apps/desktop/src/main/log.ts`. Runtime diagnostics
  (e.g. a `settings.json` or theme file that fails schema validation) end up
  in the log.

## Design system

- **The accent is the app icon**: deep forest green (`#263b2e`) and warm
  parchment (`#ece1d2`). The dark theme is a green-tinted near-black canvas
  (`#0f1311`) with chrome (`#161a17`), raised (`#1b201c`) and popover
  (`#202621`) surface layers and a sage accent (`#63a37f`); the light theme is
  paper (`#fdfcf9`) and cream (`#f2efe7`) with a forest accent (`#3f7355`).
  UI glyphs (activity bar, title-bar toggle) come from **lucide-react**.
- **Tokens are semantic**: `--doru-bg-*` (surfaces), `--doru-fg-*` (text
  weights), `--doru-border*` (alpha hairlines), `--doru-accent*`,
  `--doru-overlay-*` (hover/pressed), `--doru-state` colors, `--doru-ring`
  (0.5px elevation ring), geometry (`--doru-radius-sm/md/lg` = 4/6/8px,
  `--doru-control-height` = 28px).
- **Floating panels**: the workbench root is the
  shell — a plain surface in the chrome color. The activity bar and the
  primary side bar share one rounded card (1px border, 8px radius) with a
  hairline seam between them; the editor is its own rounded card in the
  canvas color (`overflow: hidden` clips the tab strip); the agent chat
  panel floats on the right as a standalone card. Cards sit 4px from the
  window edges and from each other (`--doru-panel-gutter`), so only their
  borders separate them from the shell — they are framed, not cut. The title
  bar is not a card: it spans the full width under the window controls.
- **Resizable side bars**: the primary side bar (260px default) and the
  agent chat panel (320px default) are resized with pointer-based sashes
  (`.sash`, 8px hit strip in the gutter between the cards, a 2px accent line
  with a short hover delay and an always-visible faint three-dot grip that
  yields to the line, `col-resize` cursor via a body class); widths are
  clamped (160–520 / 220–560), live in `Workbench` state and feed the grid
  via `--doru-sidebar-width` / `--doru-agent-chat-column` custom properties.
  The title bar carries a toggle button for the agent chat panel (also
  `Meta/Ctrl+Alt+B`).
- **Component conventions**: controls are 28px tall with 6px radius and a
  0.5px ring; hover/pressed are alpha overlays, not hardcoded colors; focus is
  a 2px accent outline; disabled is opacity 0.45. Tabs: a 35px strip in the
  canvas color without a bottom border, tabs
  are 24px rounded pills (4px radius, 4px gaps, no dividers) with equal
  widths capped at a common 160px maximum (browser-like) that shrink with
  labels fading out on the right edge instead of scrolling — the fade reaches
  the tab edge while the close action is hidden and yields to it on hover or
  activation — inactive
  transparent, hover overlay, active chrome-active; the close action appears
  on hover and on the active tab. Tabs are drag-reorderable via pointer
  capture (not native HTML5 drag, whose OS session flashes the copy cursor on
  macOS): pressing a tab activates it immediately, a dimmed source tab, a
  drag ghost that follows the pointer at its grab point and a 2px accent line
  mark the gesture, Escape cancels; the index math lives in `tabReorder.ts`.
  Chat: user bubbles are accent-alpha pills,
  tool steps are raised chips, the input is a 32px rounded field.
- **Custom title bar** (see `createWindow` in the main process): macOS uses
  `titleBarStyle: 'hiddenInset'` with positioned traffic lights; Linux and
  Windows use `frame: false` + a Window Controls Overlay colored from the theme
  and updated on theme change. The renderer always draws a 38px `.title-bar`
  (drag region, `-webkit-app-region: drag`) and reserves room for the OS
  controls via `env(titlebar-area-*)` (Linux/Windows) or left padding (macOS).
- **Interaction conventions** (learned the hard way): every drag gesture
  (tab reordering, side-bar sashes) is pointer-based — `setPointerCapture`,
  a 4px threshold, Escape to cancel — never native HTML5 drag: the OS drag
  session flashes the macOS copy cursor and replaces our cursor/ghost
  styling. Native `title` tooltips are unreliable under the drag region on
  macOS, so tooltips are custom (`ActivityBar` pattern: fixed pill, delay,
  `aria-label` instead of `title`). Icon-only buttons must reset the UA
  `padding: 0` and use `display: inline-flex`, or the flex child SVG
  collapses to the leftover content box. The `BrowserWindow`
  `backgroundColor` follows the theme (`windowBackgroundColor()` in the main
  process) so live resizes never flash white. Accepted macOS quirk: the drag
  region makes the window background movable (`isMovableByWindowBackground`),
  so grabbing a resize edge occasionally moves the window instead of
  resizing — not fixable from the renderer.

## Workbench windows and tabs

- One `BrowserWindow` per open project file. The main process tracks
  `projectWindows` (path → window) and `windowProject` (webContents id →
  path or `null` for a welcome window); opening an already-open file focuses
  its window, and a welcome window gets *bound* to the newly opened project.
- The renderer bootstraps from `project:current` and listens for
  `project:bind`. Open tabs are renderer state (`tree`, `settings`,
  `person:<id>`, `person:new:<uuid>`); the tab contents are kept alive in
  hidden panes (`.editor-stack`/`.editor-pane`), and the welcome page is shown
  in the editor area whenever zero tabs are open. Closing a window closes its
  project runtime; the session file stores open window paths.

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
