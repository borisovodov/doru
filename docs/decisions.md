# Product Decisions

Deliberate decisions about what Doru is **not** doing, recorded so they are not
re-litigated by future contributors. Deferred work is tracked in GitHub issues.

## Not building

### Multiple trees per project folder

A project is one folder with exactly one `tree.doru`. Multiple independent
trees in a single folder add complexity without a user need; open several
projects in tabs instead.

### Mobile version

No iOS/Android version for now. The door stays open: `packages/core` and
`packages/platform` must not import Electron or browser APIs, so the service
layer could be reused by a future Capacitor-based client.

### Monetization

None. Doru is free software (MIT). If this ever changes, it must not compromise
the local-first guarantee: data stays in the user's folder.

### Manual locale switcher

The UI language always follows the operating system. All 17 locales are
shipped and selected automatically; there is no in-app language setting.

### Built-in cross-device sync (CRDT)

No built-in sync engine. Projects are plain folders, and keeping them in sync
between machines is the user's job — iCloud Drive, Dropbox, rclone, rsync, a
USB stick, whatever they prefer.

One caveat lives with this decision: `tree.doru` is a SQLite database, and
live-syncing an **open** project with a file-sync tool can copy the file in a
half-written state and corrupt it. Doru uses a single-file journal mode
(`journal_mode=DELETE`) to keep the folder clean, but the safe practice is:
close the project (or the app) before syncing. Copying a closed project is
always safe.

## API stability before 1.0.0

Our own APIs — including MCP tool names — may break freely until 1.0.0 is
released; no compatibility shims. MCP tool names follow `^[a-zA-Z0-9_-]+$`
with underscore separators (`tree_query`, `sources_add`, `charts_render`),
because strict OpenAI-compatible providers (DeepSeek, and others) reject dots
and colons in function names. External MCP host tools keep arbitrary names and
are sanitized on the wire by the connectors.

## Rejected alternatives

- **Tauri instead of Electron** — a Rust shell would break the TypeScript-only
  rule and re-invent what Electron already does for a VS Code-style workbench.
- **Single-file `.doru` document** (SQLite with media blobs) — media and
  config would stop being plain files; the folder wins.
- **macOS package folders (UTI)** — Finder would hide the structure; an honest
  folder keeps everything visible and editable.
- **WAL mode for `tree.doru`** — sidecar files next to a "document" and a
  bigger live-sync corruption risk; `journal_mode=DELETE` wins.
- **better-sqlite3** — native-module rebuild pain; `node:sqlite` ships with
  Node ≥ 22.13 and Electron 37.
- **In-memory document as the source of truth** — two competing sources of
  truth; SQLite is authoritative and ops mutate it directly.
- **Full VS Code-style platform with an extension host in v1** — scope;
  deferred to issue #2.
- **Monaco for the raw GEDCOM view** — heavy for a read-only view; a plain
  `<pre>` is enough until GEDCOM editing becomes a real feature.
