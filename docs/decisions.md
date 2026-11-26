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

## GEDCOM FAMC/FAMS vendor details

The vendor FAMC/FAMS link fields `_HUSB`, `_WIFE`, `MTYP`,
`_PRIMARY`, `_PREF` and `_PLINK` are also intentionally not stored. Corpus
counts showed them in only a handful of files (or not at all); the standard
`PEDI`, `STAT` (including its 7.0 `PHRASE`), relation fields and link notes
are stored. `WILL.TEXT` is normalized into a note on the `WILL` fact and is
exported as `NOTE`, not as the vendor `TEXT` tag.

## GEDCOM identifiers are not stored

`@doru/gedcom` parses the standard identifier structures (`REFN`, `UID`,
`EXID`), the 5.5.1-only `AFN`/`RFN`/`RIN` fields and every vendor identity
field, but the tree mapping ignores all of them. Dóru has no identifier
table, no identifier attachment, and no identifier editor; export never
writes `UID`, `EXID`, `REFN`, `AFN`, `RFN`, `RIN` or `_GOV` tags. Record
`xref`s are not stored either: import keeps them only in transient maps for
resolving GEDCOM pointers, and export assigns fresh `@…@` identifiers. The
parser-level model and tests remain in the format package, which is
storage-free by design.

## GEDCOM task repositories, categories, localities, titles, and types

The GEDCOM-L `_TODO` `REPO` slot is parsed by `@doru/gedcom` and imported as
an ordinary polymorphic task target: a `task_link` row with `target_type =
'repository'`. A task still has no direct repository field: an archive is
chosen either as the task's target or through the source it concerns, and a
second, narrower task-to-repository column would duplicate those paths.

Export does not write `_TODO.REPO`. A task whose only target is a repository
is therefore omitted from the exported file: unlike a person or family, a
repository has no GEDCOM slot for an embedded `_TODO` structure. This is a
deliberate loss; the task remains in the tree after import but does not
round-trip through GEDCOM.

The `_TODO` `_CAT` category and `_LOCL` locality are dropped: they have no
shared vocabulary, no dictionary table, and no UI contract beyond free-text
fields. A task is classified by its targets, priority, and status instead.
The record-form `_TTIL` title and the GEDCOM-L `TYPE` task kind and `DATA`
solution text are dropped too: Dóru has one task text, no task-type taxonomy,
and no separate task-result field.

The `_TODO._UID` value is parsed by `@doru/gedcom` (it stays on
`TodoRecord.uids`) but is not imported into the tree and is never written on
export: Dóru stores no GEDCOM identifiers at all.

## Tasks are shared across targets

A task is one record with any number of `task_link` rows, not a copy per
target. Deleting a target removes only its link; the task survives as a
free-standing record (and remains visible in the global Tasks view). GEDCOM
cannot express this: `_TODO` is embedded in a record, so a multi-target task is
written under every person/family target on export and a round trip produces
separate tasks. Sources are valid targets (a task can be about checking or
acquiring one), but tasks linked only to targets without a GEDCOM embedding
slot (places, sources, repositories, …) are dropped on export.

## Attachment target policy

Every polymorphic link family has one explicit allowed-target set in
`packages/core/src/model/targetPolicy.ts`. The service guards, the attachment
panel's section visibility, every `canAdd` flag, and every target picker read
those sets; there is no global runtime target list and no second UI list.

| Family | Allowed targets |
|---|---|
| Note | Every target type except `media_link`. A note record is never a target. |
| Citation | Every target type except `task`, `citation`, and `media_link`. |
| Media link | Every target type except `media` and `media_link`; a task is a valid media target. |
| Contact | `person`, `fact`, `repository`, `submitter`. |
| Task link | Every target type except `task`, `submitter`, and `media_link`; `source` is valid. |
| Contributor link | Every target type except `task`, `media_link`, and `submitter`. |

Consequences: a source has nothing to cite on a task (a task asserts nothing),
a task card keeps Notes and Media only, a submitter card has no Tasks or
Contributors section, a media link carries no attachments at all, and
contributors are absent from task cards. `TreeService` rejects every disallowed
pair with one shared guard, so agents and IPC callers follow the same matrix as
the UI.

A note is a leaf annotation: it is owned by exactly one record and stores its
text, but no attachment may point at it, and a note row has no attachment
panel. GEDCOM shared notes are copied per target on import, so the database
never holds a note shared between records; export writes every note as an
inline `NOTE`. GEDCOM 7 allows `SOUR` inside both `NOTE` and `SNOTE`;
`@doru/gedcom` still parses it, but the core mapping drops it on import and
never writes it on export. Vendor `_SUBM` links on notes are dropped the same way.

## Notes store text only

A note's content is its text; it has no MIME type, language or translations.
The row also keeps `created_at` and `updated_at` epoch-millisecond instants for
provenance. GEDCOM `NOTE.LANG`/`SNOTE.LANG`, `NOTE.MIME`/`SNOTE.MIME` and
`NOTE.TRAN`/`SNOTE.TRAN` are parsed by `@doru/gedcom` but dropped by the core
mapping: Dóru has one note text and no translation editor.

## Notes are copied per target

Shared notes complicate the UI — split-vs-shared edits, attach existing,
detach, delete everywhere — without a matching research need. A note is owned
by exactly one record and its section only adds, edits and deletes that text.
GEDCOM shared notes are copied to every referencing target on import; export
writes inline `NOTE` structures and never emits `SNOTE` records or pointers.
The note-link table and the split/attach/detach operations are gone.

Some note targets have no GEDCOM note slot of their own: name parts and name
variants, place names and hierarchy links, and address lines. Their notes are
emitted on the nearest enclosing standard NOTE slot (`NAME`, `_PLAC`, `ADDR`).
Import attaches them back to that parent, so the text round-trips but the
fine-grained target does not.

## Contacts belong to their GEDCOM owner

`PHON`, `EMAIL`, `FAX` and `WWW` are not universal record fields. GEDCOM
5.5.x keeps them inside `ADDRESS_STRUCTURE`; 7.0 moves them to event details
and to the `REPO` and `SUBM` records. A direct `INDI` contact is a vendor
extension, which Dóru keeps on a person. Dóru therefore accepts contact rows
only for `person`, `fact`, `repository` and `submitter`; every other target has
no import or export path, and a contact there would be dead data.

An address is a postal container, not a contact owner. The parser canonicalizes
5.5.x contacts into the address block, so the importer hoists them onto the
owning person, fact, repository or submitter; the 5.5.1 serializer merges them
back into the address block on export. This keeps one row per contact instead
of duplicating it on both the address and its owner.

The website kind is `www` (the GEDCOM tag); `url` survives only as a legacy
alias and is normalized to `www` when edited. `skype` and `jabber` are accepted
vendor handles: the parser and exporter support them on `submitter`; on other
targets they are stored and shown but have no GEDCOM output path. The kind list
is deliberately open, so unknown and future spellings survive a round trip.

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

Task times are operational instants, not genealogical assertions. They are
stored as epoch-millisecond integers: `created_at`, `updated_at`, and
`remind_at`. They do not use the `date` table.

`created_at` is set once when the app creates a task, `updated_at` changes on
every task edit, and `remind_at` is the single user-chosen reminder instant.
Closing a task only changes its status; there is no separate completion
timestamp. Link changes do not count as edits. The UI uses a date-and-time
control, not the GEDCOM date editor. Import maps a complete exact
`_TODO.CHAN` to `updated_at`, raised to `created_at` when earlier; when it is
absent, `updated_at` follows `created_at`. `created_at` uses a complete exact
task date, otherwise the import instant.

GEDCOM task dates are imported only when they are complete exact dates:
My Family Tree's encoded `DDMMYYYY` text in the record form, and exact GEDCOM
dates in the `_TODO` structure form. Date-only values become local midnight.
`_TODO.DATE` is the creation date and maps to `created_at`; `_RDATE`/`_TRDT`
map to `remind_at`, with `_TSDT` as a fallback. `_CDATE` is dropped together
with the completion timestamp. Partial, approximate, range, or otherwise
unparseable values are not used as task dates; the record timestamps follow
the fallback above.

## Record timestamps are aggregate-level

Top-level record roots (`person`, `family`, `source`, `media`, `place`,
`repository`, `submitter`, `address`, `title`, plus `note` and `task`) keep
Dóru-local epoch-millisecond `created_at`/`updated_at` instants. They are
operational provenance, not genealogical dates. `created_at` is set once;
`updated_at` changes only when the aggregate's own content changes. Child
rows, link rows, attachment links and `date` values have no timestamps of
their own.

Editing a person's names or facts moves the person's instant even when the
fact is saved through its own operation. Family partner/child links, media
files, place names/hierarchy and source texts belong to their roots. Adding a
note, citation, media link, task link, contact or contributor does
not move the host's instant, and neither does the reference cleanup performed
when another record is deleted. Undo restores the previous instants; redo
restores the edit's.

GEDCOM import fills these instants from the file when possible:
`CREA`/`_CREAT`/`_CREA`/`_CRE` for creation, `CHAN`/`_UPD` and the latest fact
`CHAN` for editing. Typed record fields win; the same tags left in generic
extensions are the second priority. Only complete exact dates are accepted;
partial, approximate, range, BCE and unparseable text are dropped. When
GEDCOM has no creation stamp, the earliest known change date is used as a
lower bound. With no usable stamp at all, both instants are the import
instant. The values stay Dóru-local: `CHAN.NOTE`, `CHAN._WT_USER`,
`CHAN.SOUR` and change history are ignored, and export does not synthesize
`CHAN` or `CREA`. The UI does not display these fields.

## No persistent change log

There is no `change_log` table. GEDCOM `CHAN`/`CREA` dates are read only to
fill a root's first/last instants; the change notes, users, citations and
history inside those blocks are dropped, and multiple changes are not stored.
Undo/redo is an in-memory op queue; the database does not persist who changed
what. This keeps the document model minimal and avoids duplicating GEDCOM's
weakly typed change stamps. Revisit only when the product needs a real audit or
history feature.

## Free-text family witnesses

`family_witness` preserves the vendor `_WITN` and `_GODT` family witnesses
verbatim as text. They are names, not person pointers, and are deliberately
not an attachment target: notes, sources, tasks and media belong on a
standard GEDCOM `ASSO` association row (`association`), which points at a
person and carries a role. Giving the free-text rows stable ids and
attachment panels would make them look like first-class entities that Dóru
does not model.

## No tags or global attachment lists

Tags are not part of the document model: there is no tag table, tag link,
UI section, IPC surface, or import/export mapping. `@doru/gedcom` still
parses `_TAG`, `_MTTAG` and similar vendor records, but the tree ignores
them on import and never writes them on export.

The Sources sidebar intentionally has no global Notes or Citations
registries either. Notes and citations are browsed from the record they
belong to, which keeps the sidebar focused on records with their own tabs.

## GEDCOM media

Dóru models one media card as exactly one file. A GEDCOM `OBJE` with several
`FILE` rows is split into one card per file on import; the record notes,
citations, submitters and links are duplicated onto every card. The imported
xref is not stored; every card receives a fresh export identifier. `TRAN` is
ignored. GEDZIP bytes and reachable local `FILE` paths are copied into the
project's `media/` folder. Plain `http(s)`
URLs are downloaded silently with protocol, size, timeout and private-address
limits; a failed download keeps the URL in `media.path` and the UI shows a
silent generic placeholder. Export offers GEDCOM 7.0 (`.ged`, paths only) and
GEDZIP (`.gdz`, bundled local files); the choice lives in the Export tab, not
in a save-dialog filter.

The database stores only the media card itself: the title and the historical
`_DATE`. Other GEDCOM metadata (`_PLAC`, `_TYPE`, `_DSCR`, `_KEYS`, `MEDI`,
`_CTYP`, `_TEXT`) and the file's technical facts are not persisted: MIME type,
byte size and image dimensions are derived from the file in the main process,
and the parser's historical fields are dropped by the core mapping. EXIF
metadata is neither derived nor stored. A moved or replaced file therefore
reports fresh facts, and a missing file reports none instead of stale values.
`FORM` is synthesized from the file path on export.

Sources and notes attach to the media card (`media`), never to a link row.
Citations written under an `OBJE` link are dropped on import and not written on
export; an inline 5.5.1 `NOTE` under the link is hoisted onto the media record,
while a pointer-form link note has no slot and is dropped. A media link stores
only the crop and the primary flag; it is not an attachment target at all. The
GEDCOM parser still reads the link-level display fields (`CROP`, `_PRIM`,
`_SCBK`, `_SSHOW`, `_THUM`, `_SEQ`, `_EXCL`, `_CAPT`) so `@doru/gedcom` stays
faithful, but the tree keeps only `crop` and `primary`.

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
