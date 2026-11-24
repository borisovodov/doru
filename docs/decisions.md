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
close the project (or the app) and stop any other writers before syncing.
A cleanly closed project with no other writers can be copied safely. After a
crash, open the project once in Dóru so SQLite can roll back any leftover
journal, then close it before copying. If the project cannot be opened, move
the damaged `.doru` file and any leftover journal out of the way before
restoring a backup.

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

## GEDCOM round-trip is not an application requirement

`@doru/gedcom` models and serializes the GEDCOM wire format. Same-version
round-trips are required for the structures that package models, except for
the drops documented in `packages/gedcom/README.md` — for example
non-underscore top-level vendor extensions and generic extension records,
which neither target grammar can spell. Cross-version round-trips are lossy
by design. Dóru's `.doru` schema is a separate domain model. Import maps the
GEDCOM data the model represents, and export writes that model back; fields
outside the model are dropped and export synthesizes a fresh header. A
`.ged → .doru → .ged` cycle is therefore not required to be lossless.

Schema and UI decisions should stand on the app's own domain needs. Do not
justify a decision by GEDCOM round-trip fidelity alone: wire-format fidelity
belongs to the format package, not to the application.

## GEDCOM legacy identifiers and FAMC/FAMS vendor details

`RFN` and `AFN` are GEDCOM 5.5.1 identifiers with no 7.0 spelling; Dóru does
not store them. The vendor FAMC/FAMS link fields `_HUSB`, `_WIFE`, `MTYP`,
`_PRIMARY`, `_PREF` and `_PLINK` are also intentionally not stored. Corpus
counts showed them in only a handful of files (or not at all); the standard
`PEDI`, `STAT` (including its 7.0 `PHRASE`), relation fields and link notes
are stored. `WILL.TEXT` is normalized into a note on the `WILL` fact and is
exported as `NOTE`, not as the vendor `TEXT` tag.

## GEDCOM task repositories, categories, localities, titles, and types

The GEDCOM-L `_TODO` `REPO` slot is parsed by `@doru/gedcom` but deliberately
not imported into the tree and not written on export. A task has no direct
repository field: an archive is chosen either as the task's polymorphic
target or through the source it concerns. Keeping a second, narrower
task-to-repository link would duplicate those paths and produce data that the
UI cannot interpret consistently.

The `_TODO` `_CAT` category and `_LOCL` locality are dropped for the same
reason: they have no shared vocabulary, no dictionary table, and no UI contract
beyond free-text fields. A task is classified by its targets, priority, and
status instead. The record-form `_TTIL` title and the GEDCOM-L `TYPE` task kind and `DATA`
solution text are dropped too: Dóru has one task text, no task-type taxonomy,
and no separate task-result field.

## Tasks are shared across targets

A task is one record with any number of `task_link` rows, not a copy per
target. Deleting a target removes only its link; the task survives as a
free-standing record (and remains visible in the global Tasks view). GEDCOM
cannot express this: `_TODO` is embedded in a record, so a multi-target task is
written under every person/family target on export and a round trip produces
separate tasks. Tasks linked only to other target types (places, sources, …)
are dropped on export.

## Tasks are not citation targets

A task is a research work item, not an assertion about a person, family or
fact, so a source has nothing to cite on it. The task tab does not render the
sources section, and `TreeService` rejects a citation whose target type is
`task`; agents and IPC callers therefore cannot create one either. This also
keeps the task model from forming a task → citation → task cycle. GEDCOM has
no citation slot on `_TODO`, so import and export are unaffected.

## Contacts are limited to their GEDCOM positions

`PHON`, `EMAIL`, `FAX` and `WWW` are not universal record fields. GEDCOM
5.5.x keeps them inside `ADDRESS_STRUCTURE`; 7.0 moves them to event details
and to the `REPO` and `SUBM` records. A direct `INDI` contact is a vendor
extension, which Dóru keeps on a person. Dóru therefore accepts contact rows
only for `person`, `fact`, `address`, `repository` and `submitter`; every other
target has no import or export path, and a contact there would be dead data.
The kind list (`email`, `phone`, `fax`, `url`, `www`) is deliberately not
restricted per target: the storage layer keeps unknown and future spellings,
and the same picker stays available on every supported target.

## Privacy restrictions are out of scope

Dóru deliberately has no `restriction` table and no Privacy section. GEDCOM
`RESN` and the vendor `_PRIV`/`_PRIVATE` flags are privacy annotations whose
semantics are too ambiguous to store without a designed product feature: the
standard itself warns that `PRIVACY` admits multiple interpretations, and none
of the values change what Dóru displays or exports. `@doru/gedcom` keeps
parsing and serializing the wire structures, but the tree database does not
store them, so an import/export round trip drops them until privacy is designed
deliberately.

## Dates are forward-referenced values

A date is a value row in `date`, not a child row with a polymorphic owner.
Each owner row has one column per date slot (`fact.date_id`,
`association.period_date_id`, …) pointing at the value with
`ON DELETE RESTRICT`. The column name is the role; there is no
`owner_type`/`role` vocabulary. A period is one `range` value: the import
layer folds two-slot wire dates (`_DATE2`, `_PERIOD`) into it, and export
splits them back where the target format needs two slots.

This gives the schema real foreign keys and makes a fact's dates visible on
the fact row. The trade-off is that SQLite cannot express "exactly one owner"
across twelve referencing tables. Repositories keep that invariant: a date
row is created for one owner and never shared, and a copied row gets a fresh
date id. `ON DELETE RESTRICT` turns a leaked share into a loud failure.

There are no date-delete triggers. Repositories delete the dates explicitly
after the owner row is gone, including for cascaded children (a deleted
person's names, facts and family links; a deleted source's events and
citations). The update path writes surviving slots first, updates the owner,
then releases the old ids; aggregate updates reserve every old date id for
the whole operation so a copy into another slot gets a fresh id. Tests assert
that no date rows are left orphaned.

## Task times are Unix instants

Task lifecycle times are operational instants, not genealogical assertions.
They are stored as epoch-millisecond integers: `created_at`, `scheduled_at`,
`reminder_at`, and `closed_at`. They do not use the `date` table.

`created_at` is set once when the app creates a task. `closed_at` is set when
the status becomes `closed` and cleared when the task is reopened. The UI uses
a date-and-time control, not the GEDCOM date editor.

GEDCOM task dates are imported only when they are complete exact dates:
My Family Tree's encoded `DDMMYYYY` text in the record form, and exact GEDCOM
dates in the `_TODO` structure form. Date-only values become local midnight.
Partial, approximate, range, or otherwise unparseable task dates are dropped
rather than inventing an instant.

`tag_link.date` is dropped entirely. The tag-application date is rare in the
corpus (a handful of modern dates in the tag-extension examples) and Dóru's
tag model does not need it; `@doru/gedcom` still parses and serializes the wire
field, but the tree database does not store it.

## No persistent change log

There is no `change_log` table and no `CHAN`/`CREA` mapping. Undo/redo is an
in-memory op queue; the database does not persist who changed what or when.
This keeps the document model minimal and avoids duplicating GEDCOM's weakly
typed change stamps. Revisit only when the product needs a real audit or
history feature.

## Free-text family witnesses

`family_witness` preserves the vendor `_WITN` and `_GODT` family witnesses
verbatim as text. They are names, not person pointers, and are deliberately
not an attachment target: notes, sources, tasks and media belong on a
standard GEDCOM `ASSO` association row (`association`), which points at a
person and carries a role. Giving the free-text rows stable ids and
attachment panels would make them look like first-class entities that Dóru
does not model.

## GEDCOM media

Media metadata and links are always imported. GEDZIP bytes are copied into
the project's `media/` folder; plain GEDCOM `FILE` paths are copied when the
referenced file is reachable on the importing machine. Unresolvable paths
stay external references in the database and are hidden from the UI. Export
offers GEDCOM 7.0 (`.ged`, paths only) and GEDZIP (`.gdz`, bundled files);
the choice lives in the Export tab, not in a save-dialog filter.

The database stores only historical/GEDCOM metadata: the record title,
`_DATE`, `_PLAC`, `_TYPE`, `_DSCR` and `_KEYS`, plus the file's `MEDI`,
`_CTYP`, `_TEXT` and `TRAN` rows. Technical facts — MIME type, byte size
and image dimensions — are derived from the file in the main process and
never persisted; EXIF metadata is neither derived nor stored. A moved or
replaced file therefore reports fresh facts, and a missing file reports none
instead of stale values. `FORM` is synthesized
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

## GEDCOM vendor spellings

The standard writers keep unknown standard tags from being emitted where a
version has no slot for them. Two deliberate vendor mappings are documented
here:

- Source-level certainty from Heredis is written as the extension-safe
  `_QUAY` at the `SOUR` record level. The parser accepts both `QUAY` and
  `_QUAY`, so older Heredis exports import under either spelling.
- Citations attached to the `SEX` fact are written as `SOUR` children of
  `SEX`. GEDCOM 5.5.1 and 7.0 do not define that substructure, but the
  alternative record-level placement loses the link to the sex fact. When no
  `SEX` line can be emitted, the citations fall back to the record level.

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
