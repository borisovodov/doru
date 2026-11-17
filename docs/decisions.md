# Product Decisions

Deliberate decisions about what Dóru is **not** doing, recorded so they are not
re-litigated by future contributors. Deferred work is tracked in GitHub issues.

## Not building

### Multiple trees per project folder

A project is one `.doru` file with exactly one tree. Multiple independent
trees in a single file add complexity without a user need; open several
projects in tabs instead.

### Mobile version

No iOS/Android version for now. The door stays open: `packages/core` and
`packages/platform` must not import Electron or browser APIs, so the service
layer could be reused by a future Capacitor-based client.

### Monetization

None. Dóru is free software under the MIT license — genuinely open source, not
merely source-available: the whole app may be used, modified, and
redistributed for any purpose. If this ever changes, it must not compromise
the local-first guarantee: data stays in the user's files.

### Manual locale switcher

The UI language always follows the operating system. All 17 locales are
shipped and selected automatically; there is no in-app language setting.

### Built-in cross-device sync (CRDT)

No built-in sync engine. Projects are plain files, and keeping them in sync
between machines is the user's job — iCloud Drive, Dropbox, rclone, rsync, a
USB stick, whatever they prefer.

One caveat lives with this decision: the `.doru` file is a SQLite database,
and live-syncing an **open** project with a file-sync tool can copy the file
in a half-written state and corrupt it. Dóru uses a single-file journal mode
(`journal_mode=DELETE`) to keep the file clean, but the safe practice is:
close the project (or the app) before syncing. Copying a closed project is
always safe.

## Settings and data locations

Dóru follows each OS's native conventions for its settings directory (Electron
`userData`): `~/Library/Application Support/Doru` on macOS,
`~/.config/Doru` on Linux, `%APPDATA%\Doru` on Windows. Dev-tool culture
(gh, zed, OpenCode) uses `~/.config` everywhere, but for a GUI app the native
locations are intentional — do not move the macOS settings to `~/.config`.

## GEDCOM header, submission and raw extensions

The project database deliberately does not store the GEDCOM `HEAD`/`SUBN`
metadata or raw extension structures (`extensions`, vendor blocks, unknown
records). The schema models the genealogy domain; export synthesizes a fresh
header. Import reports whole vendor record families in `droppedStructures`;
`HEAD`/`SUBN`, `SCHMA` and raw extension/unknown structures are dropped
without a counter because they are wire metadata rather than tree records.
This is a product decision, not an unfinished mapping: revisit it only when a
concrete feature needs the wire metadata. The same applies to the LDS,
research, census, event-definition, duplicate-candidate, published-site,
group, tree-tag and GenoPro record families listed in `import/gedcom.ts`.

## GEDCOM legacy identifiers and FAMC/FAMS vendor details

`RFN` and `AFN` are GEDCOM 5.5.1 identifiers with no 7.0 spelling; Dóru does
not store them. The vendor FAMC/FAMS link fields `_HUSB`, `_WIFE`, `MTYP`,
`_PRIMARY`, `_PREF` and `_PLINK` are also intentionally not stored. Corpus
counts showed them in only a handful of files (or not at all); the standard
`PEDI`, `STAT` (including its 7.0 `PHRASE`), relation fields and link notes
are stored. `WILL.TEXT` is normalized into a note on the `WILL` fact and is
exported as `NOTE`, not as the vendor `TEXT` tag.

## Free-text family witnesses

`family_witness` preserves the vendor `_WITN` and `_GODT` family witnesses
verbatim as text. They are names, not person pointers, and are deliberately
not an attachment target: notes, sources, tasks and media belong on a
standard GEDCOM `ASSO` association row (`association`), which points at a
person and carries a role. Giving the free-text rows stable ids and
attachment panels would create `.doru`-only evidence that cannot survive a
GEDCOM round-trip.

## GEDCOM media

Media metadata and links are always imported. GEDZIP bytes are copied into
the project's `media/` folder; plain GEDCOM `FILE` paths are copied when the
referenced file is reachable on the importing machine. Unresolvable paths
stay external references in the database and are hidden from the UI. Export
offers GEDCOM 7.0 (`.ged`, paths only) and GEDZIP (`.gdz`, bundled files);
the choice lives in the Export tab, not in a save-dialog filter.

The database stores only historical/GEDCOM metadata: the record title,
`_DATE`, `_PLAC`, `_TYPE`, `_DSCR` and `_KEYS`, plus the file's `MEDI`,
`_CTYP`, `_TEXT` and `TRAN` rows. Technical facts — MIME type, byte size,
image dimensions and EXIF — are derived from the file in the main process and
never persisted. A moved or replaced file therefore reports fresh facts, and
a missing file reports none instead of stale values. `FORM` is synthesized
from the file path on export; `TRAN` is written only for GEDCOM 7.0. Sources
and notes attach to the media record (`media`); vendor `SOUR` lines under an
`OBJE` link attach to the link (`media_link`) and are editable in the media
tab.

## API stability before 1.0.0

Our own APIs — including MCP tool names — may break freely until 1.0.0 is
released; no compatibility shims. MCP tool names follow `^[a-zA-Z0-9_-]+$`
with underscore separators (`tree_query`, `sources_add`, `tree_add_relative`),
because strict OpenAI-compatible providers (DeepSeek, and others) reject dots
and colons in function names.

## Dóru AI (local assistant)

The offline assistant ("Dóru AI") ships a single curated model for now:
Qwen3.5-4B, Q4_K_M GGUF, Apache-2.0, thinking mode off. The choice is gated
by the eval suite in `scripts/` (`npx vitest run --config
scripts/eval-ai.vitest.config.ts`): on the agent toolset both 4B and 9B pass
at parity, and thinking mode wins no scenario while costing ~2.5x latency.
A larger model tier re-enters through the same gate later — it is a manifest
entry, not architecture. Minimum machine: 8 GB of RAM.

## Rejected alternatives

- **Tauri instead of Electron** — a Rust shell would break the TypeScript-only
  rule and re-invent what Electron already does for a desktop workbench.
- **Media as BLOBs inside the `.doru` database** — photos and scans would
  stop being plain files; a `media/` folder next to the `.doru` file wins.
- **macOS package folders (UTI)** — Finder would hide the structure; an honest
  `.doru` file keeps everything visible and editable.
- **WAL mode for the `.doru` file** — sidecar files next to a "document" and a
  bigger live-sync corruption risk; `journal_mode=DELETE` wins.
- **better-sqlite3** — native-module rebuild pain; `node:sqlite` ships with
  Node ≥ 22.13 and Electron 37.
- **In-memory document as the source of truth** — two competing sources of
  truth; SQLite is authoritative and ops mutate it directly.
- **Full IDE-style platform with an extension host in v1** — scope;
  deferred to issue #2.
- **Monaco for the raw GEDCOM view** — heavy for a read-only view; a plain
  `<pre>` is enough until GEDCOM editing becomes a real feature.

## Distribution

### Stores-only distribution

Dóru is distributed exclusively through app stores and package managers —
Homebrew, Scoop, Flatpak. Releases contain only the artifacts those channels
consume: the macOS dmg, the portable Windows zips, the Linux AppImages. No
installers for direct download, no deb/rpm. Each channel is a publisher-level
repository with its own update automation; the operational details live in
[distribution.md](distribution.md).
