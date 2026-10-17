# @doru/gedcom

The GEDCOM layer of [Dóru](https://github.com/borisovodov/doru): a strict
reader and writer for **GEDCOM 7.0.18** and **GEDCOM 5.5.1**, built around a
single TypeScript object model that spans both versions.

```ts
import { parseGedcom70, serializeGedcom551 } from '@doru/gedcom';

const result = parseGedcom70(bytes);       // → ParseResult<GedcomDataset>
if (result.ok) {
  const text = serializeGedcom551(result.value); // → ParseResult<string>
}
```

- One runtime dependency (`fflate`, pure TypeScript, MIT, ~8 kB) for the
  GEDZIP zip layer; no Electron or `@doru/*` imports — the package is
  testable and reusable in isolation.
- Strict by design: every violation of either specification is a typed
  error with a unique code and the source position of the offending line.
- Every exported type carries the specification references it is derived
  from (`GEDCOM 7.0 §…`, `GEDCOM 5.5.1 §2 (p.…)`).

## Motivation

GEDCOM is how genealogical data enters and leaves Dóru. Before this
package, the app used `read-gedcom` for import and a hand-written minimal
7.0 writer for export. That combination had three structural problems:

1. **No shared model.** `read-gedcom` parses into its own low-level tree
   (5.5.5-oriented), and the app mapped it ad hoc into its domain model.
   Every mapping decision lived in one importer function and could not be
   tested in isolation.
2. **No version coverage.** `read-gedcom` is "mostly GEDCOM 5.5.5
   compliant"; GEDCOM 7.0 is outside its target, and GEDZIP is not
   supported at all. The export side could only write a minimal 7.0
   subset.
3. **No strictness.** A tolerant parser silently drops or mangles data it
   does not understand. For a local-first app, the import path is the only
   gate between foreign files and the user's database: silent data loss
   is the worst possible failure mode.

The package solves all three: one ideal model (the specification, in
TypeScript notation), two strict parsers and two strict serializers, and GEDZIP
read/write on the same layer.

## Ideology and principles

These principles are load-bearing; change them deliberately, not
accidentally.

### 1. One model for all versions

There is exactly one object model, and it is the *union* of what both
supported specifications can express. Things that exist in only one
version (the 5.5.1 SUBN record, the 7.0 SNOTE record, RIN, UID, …) are
fields of the same model and are marked as such in their JSDoc. Parsers
produce it, serializers consume it. There are no per-version models and
no translation between models — normalization happens once, on import,
per the rules recorded in the JSDoc of each affected entity.

### 2. The model is the specification

Every exported type is a translation of a named concept of the
specifications, and every type documents where it comes from:

- `GEDCOM 7.0 §2.4` — chapter and section of FamilySearch GEDCOM 7.0.18;
- `GEDCOM 5.5.1 §2 (p.42)` — chapter and page of The GEDCOM Standard
  5.5.1 (chapter 2: record structures p.23, substructures p.31, primitive
  elements p.41).

This is a hard requirement: the type definitions are the living map from
spec to code. When in doubt about a rule, read the JSDoc first — it
contains both the rule and where it comes from.

### 3. Strict by default

A parser that guesses is a data-loss machine. This package never guesses:

- unknown standard tags in a context are errors, not ignorable noise;
- cardinality violations (`{0:1}` repeated, missing `{1:1}`) are errors;
- pointers must resolve to an existing cross-reference identifier;
- enum values must be members of their set;
- dates, times, ages, names and coordinates are validated against the
  grammars of the relevant version.

Errors are **fail-fast**: the first problem aborts the parse. Each error
carries a unique `code`, a human-readable `message`, and the source
position (line, column, byte offset). The codes are granular enough to
aggregate per problem class across a corpus of real files.

### 4. Errors are values

The public API never throws. Every operation returns a discriminated
result:

```ts
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GedcomError };
```

`GedcomError` has `code` (a literal union of ~40 codes grouped by layer:
`decoding.*`, `line.*`, `document.*`, `structure.*`, `date.*`, `enum.*`,
…), `message`, and an optional `position`.

### 5. Corpus-driven evolution

The strictness is a bet: the specifications describe the world, and real
files occasionally disagree. The planned response to such disagreement is
**to extend the model or the normalization rules — never to relax the
parser silently**. Findings from real files will arrive as explicit,
documented decisions (see Future work), not as tolerated quirks.

### 6. Hard typing where the spec allows it

- Discriminated unions for structures whose tag alone does not determine
  the type (`NOTE` vs `SNOTE` vs `NOTE`-pointer, family events, …).
- Enumeration sets are literal unions derived from `const` tables that
  record the specification's meaning of every value.
- Cardinality is mapped mechanically: `{0:1}` → optional field,
  `{1:1}` → required field, `{0:M}` → optional array, `{1:M}` → required
  array.
- Where the specs disagree, the model holds both spellings explicitly
  (e.g. `relationship` for 5.5.1 RELA next to `role` for 7.0 ROLE)
  instead of a lossy common denominator.

### 7. Normalize on import, canonicalize on export

Version differences that do not change meaning are resolved on import
and recorded in the JSDoc of the affected entity. Examples: the 5.5.1
`INT` dates and dual years (`1648/49`) become a date plus a phrase; an
inline 5.5.1 `OBJE` is synthesized into a `MULTIMEDIA_RECORD`; an empty
5.5.1 `REPO` becomes the 7.0 void pointer; the declared 5.5.1 charset
selects the decoder and is discarded (the model is post-decode). The serializers emit the canonical form
of their version and reject constructs the version cannot express.

## Package layout

```
src/
  index.ts          public API re-exports
  primitives.ts     identifiers, data types, known calendars (both specs)
  enumerations.ts   enumeration sets with per-value meanings
  structures.ts     the genealogical structures (records + substructures)
  gedzip.ts         GEDZIP read/write (7.0 chapter 4, via fflate)
  errors.ts         GedcomError, ParseResult, error codes
  parsing/
    decode.ts       charsets: UTF-8/BOM, ANSEL (Appendix C, NFC), ASCII, UTF-16
    lines.ts        strict container tokenizer and raw tree builder
    types.ts        payload parsers: dates, times, ages, lists, names, enums
    assemble.ts     raw tree → typed model (per-version assembler)
  serialize/
    serialize.ts    typed model → text (per-version writers)
tests/
  decode / lines / parse70 / parse551 / serialize / roundtrip
```

## Parsing

```ts
parseGedcom70(input: Uint8Array): ParseResult<GedcomDataset>
parseGedcom551(input: Uint8Array): ParseResult<GedcomDataset>
```

Input is always bytes. Version handling:

- **7.0** — UTF-8, optional BOM on the first line only (a BOM anywhere
  else is an error). Banned characters of 7.0 §1.1 are enforced.
- **5.5.1** — the character set is detected from the header `CHAR` tag
  (required). `ANSEL` uses the Appendix C tables; non-spacing characters
  are buffered and attached to their base character, and the result is
  NFC-normalized (`e` + combining acute → `é`). `ASCII` rejects bytes
  above 0x7F, `UNICODE` is UTF-16 and requires a BOM.

Both versions share the container tokenizer: levels (no leading zeros,
5.5.1 ≤ 99), single-space delimiters, cross-reference identifiers,
pointers, `@@` escaping, 5.5.1 `@#…@` escape sequences, `CONT`/`CONC`
continuation merging, and the per-version banned-character rules.

Decoding happens at parse time, and the model is **post-decode**: every
text field holds plain Unicode, never the source encoding. The declared
5.5.1 charset (`CHAR`) is validated strictly, used only to select the
decoder, and then discarded — the model has no `characterSet` field.

What strictness rejects (each with its own error code):

| Group | Codes |
|---|---|
| Decoding | `decoding.invalid-utf8`, `invalid-utf16`, `bom`, `missing-charset`, `unknown-charset`, `invalid-ansel` |
| Lines | `line.blank`, `leading-whitespace`, `bad-level`, `level-limit`, `level-skip`, `missing-delimiter`, `bad-tag`, `reserved-tag`, `bad-xref`, `xref-on-substructure`, `bad-pointer`, `unescaped-at`, `bad-escape`, `banned-char`, `too-long`, `continuation-*` |
| Document | `document.missing-header`, `missing-trailer`, `trailer-not-last`, `duplicate-xref`, `xref-not-found`, `missing-gedc`, `missing-gedc-vers`, `wrong-version` |
| Structures | `structure.unknown-tag`, `cardinality`, `missing-required`, `missing-payload`, `unexpected-payload`, `record-without-xref` |
| Payloads | `enum.invalid-value`, `date.*`, `time.invalid`, `age.invalid`, `list.invalid`, `name.invalid`, `latitude.invalid`, `longitude.invalid`, `tagdef.invalid`, `charset.invalid`, `uri.invalid` |

Extension tags (`_…`) are accepted anywhere and kept as opaque
`ExtensionStructure` nodes, per 7.0 §1.5 / 5.5.1 `NEW_TAG`.

## Serialization

```ts
serializeGedcom70(dataset: GedcomDataset): ParseResult<string>
serializeGedcom551(dataset: GedcomDataset): ParseResult<string>
serializeGedcom70Bytes(dataset: GedcomDataset): ParseResult<Uint8Array>
serializeGedcom551Bytes(dataset: GedcomDataset): ParseResult<Uint8Array>
```

The byte variants are the file-writing API: UTF-8, no BOM, CRLF line
endings; 5.5.1 output declares `1 CHAR UTF-8`. A lone (unpaired)
surrogate in the model text is reported as `serialize.invalid-text`
rather than silently replaced.

The writers emit the canonical form of their version:

- **7.0** — `GEDC.VERS 7.0`, uppercase enums, calendar keywords and the
  `BCE` epoch inside dates, `PHRASE` substructures, `CONT` for multiline
  payloads, leading `@` doubled, pointers verbatim.
- **5.5.1** — `CHAR`, `GEDC.FORM LINEAGE-LINKED`, required `SOUR`/`SUBM`,
  lowercase spelling where the spec uses it (`privacy`, `birth`, `maiden`,
  …), `@#D…@` calendar escapes and `B.C.`, phrases as a subordinate `NOTE`
  (per 5.5.1 §2 p.48) or the parenthesized form, all `@` doubled (except
  pointers and escapes), `CONC` splitting at the 255-character line limit
  (split points never start with a space).

Serialization is strict in the other direction: a dataset containing
constructs the target version cannot express (a SNOTE record in 5.5.1,
a RELA relationship in 7.0, the SEX value `X` in 5.5.1, …) fails with
`serialize.unsupported-value` or `serialize.missing-field` naming the
construct. Missing 5.5.1 header requirements (`SOUR`, `SUBM`, `CHAR`,
`GEDC.FORM`) are errors, not defaults.

## GEDZIP (7.0 chapter 4)

```ts
parseGedzip(bytes: Uint8Array): ParseResult<GedzipArchive>
serializeGedzip(archive: GedzipArchive): ParseResult<Uint8Array>
```

`parseGedzip` unzips the archive, parses the `gedcom.ged` entry as a
GEDCOM 7.0 data stream, and surfaces every other entry as a media file
(zip directory markers are skipped). `serializeGedzip` writes the
dataset as a 7.0 UTF-8 stream plus one entry per media file.

- Zip entry names equal the `FILE` payload strings verbatim (no
  percent-decoding in either direction); names are case-sensitive UTF-8.
- External URLs (`ftp`/`http`/`https`/`file`) simply have no entry.
- Strictness: a missing `gedcom.ged` entry is `gedzip.missing-dataset`,
  malformed zip data is `gedzip.invalid-archive`, duplicate entry names
  (and a media name colliding with `gedcom.ged`) are
  `gedzip.duplicate-entry`. Reserved names (`MANIFEST.MF`, `META-INF/`)
  pass through untouched, per the specification's "recommended not to
  use".

## Testing

The test suite covers every error code, every structure family of both
versions, the 5.5.1 normalizations, and the serialization spellings.
Round-trip tests parse → serialize → parse representative documents of
both versions and require deep model equality plus idempotent output.

```sh
npm test -w @doru/gedcom   # vitest
npm run typecheck -w @doru/gedcom
```

## Known strict decisions

Deliberate places where the strict parser is stricter than a tolerant one
would be, or where the model takes a documented position:

- 5.5.1 permits arbitrary user-supplied values in `DATA.EVEN` /
  `SOUR.EVEN` ("classified in the category of other"); the strict parser
  rejects them with `enum.invalid-value`. The model will be extended when
  the corpus shows them in the wild.
- Hebrew month lengths are validated as 1–30 (the specification states a
  month-specific maximum without giving the calendar algorithm);
  Gregorian and Julian days are validated precisely, including the
  different leap-year rules.
- The 5.5.1 `LANGUAGE_ID` table is preserved verbatim (including the
  spec's own typos, e.g. `Mandrin`) as `LANGUAGE_IDS_551`; it is not
  one-to-one with BCP 47 (Catalan/Catalan_Spn), so the mapping lives in
  the serializer, not the type.
- ANSEL input is NFC-normalized on decode (see Parsing).

## Future work

The items below are planned and designed, but **not implemented**. They
are written as self-contained briefs: decisions already made, the
proposed API, the rules and edge cases to enforce, the test plan, and the
files involved — so that a later session can pick any item and implement
it without re-deriving context.

### State snapshot (for the next session)

- The package lives in `packages/gedcom` on branch `feat/gedcom-library`
  (rebased on `main`, force-pushed as it evolves; it has not been merged
  yet).
- Completed and tested: the dual-version model (`primitives.ts`,
  `enumerations.ts`, `structures.ts`, `gedzip.ts`), the strict parsers
  (`parsing/`), the strict serializers (`serialize/serialize.ts`), the
  error model (`errors.ts`), and ANSEL decoding. 126 package tests / 230
  repo tests, clean typecheck.
- Conventions a later session must follow:
  - every model entity cites both specs (`GEDCOM 7.0 §…`,
    `GEDCOM 5.5.1 §2 (p.…)`);
  - operations return `ParseResult<T>` and never throw; errors carry a
    unique `code` (see `errors.ts`) and a source position;
  - normalization decisions are recorded in the JSDoc of the affected
    entity;
  - the model is post-decode (always Unicode; the declared charset is
    validated and discarded);
  - export is always UTF-8.

### 1. Corpus validation runs

**Goal:** validate the strict parsers against real-world `.ged` files
from many producers, aggregate failures by error code, and turn findings
into decisions. The strictness is a bet; this is where it gets tested.

**Method:**

- Gather files from public sources (FamilySearch spec samples; the
  `royal92.ged` referenced by the `read-gedcom` docs; files produced by
  RootsMagic, Gramps, MyHeritage, GEDKeeper, Ancestry, …). Do **not**
  commit corpus files to the repository (size/licensing) — the tooling
  takes a directory path.
- A dev script (e.g. `scripts/gedcom-corpus.ts`, following the repo's
  Node type-stripping conventions) walks the directory and parses each
  file with both parsers. Version detection is simple: `parseGedcom70`
  rejects 5.5.1 at `document.wrong-version`/decoding, `parseGedcom551`
  rejects 7.0 at `decoding.missing-charset` — try both, and if both fail
  report the richer error. Aggregate results per producer and per
  `GedcomError.code` into a JSON/table report.
- For every finding, decide exactly one of: extend the model / add a
  normalization (record it in JSDoc, like the existing ones) / keep the
  strict error and document it in "Known strict decisions" / (rarely)
  accept a specification ambiguity as a documented deviation. **Never
  relax the parser silently.**

**Already-suspected divergence points** (start by checking these):
arbitrary user values in 5.5.1 `DATA.EVEN`/`SOUR.EVEN`; free-form
`NAME_TYPE`; parenthesized `ROLE` descriptors; single (non-doubled)
at-signs in real 5.5.1 files; `CONC` in files claiming 7.0; partial
dates; `B.C.` on full dates in 5.5.1; lowercase tags; trailing spaces.

### 2. Version conversion layer

**Goal:** translate between the versions instead of rejecting (the
serializers stay strict). This is a *product* decision layered above the
format: it belongs in its own module (`src/convert.ts`), not inside the
parsers/serializers.

**API (proposed):**

```ts
convertTo70(dataset: GedcomDataset): ParseResult<GedcomDataset>
convertTo551(dataset: GedcomDataset): ParseResult<GedcomDataset>
```

Strict by default: a construct the target version cannot express is a
`convert.*` error unless a documented lossy option is added later.

**Mapping table to implement (5.5.1 → 7.0):**

| 5.5.1 | 7.0 |
|---|---|
| `RELA` | `ROLE OTHER` + `PHRASE` |
| `FONE`/`ROMN` | `TRAN` with a `LANG` derived from the method (`kana` → `ja-Kana`, `hangul` → `ko-Hang`, `pinyin` → `zh-Latn`, `romaji` → `ja-Latn`, `wadegiles` → `zh-Latn-wadegile`; user-defined method → error) |
| `NOTE` record / `NOTE` pointer | `SNOTE` record / `SNOTE` pointer |
| age keywords `CHILD`/`INFANT`/`STILLBORN` | `bound` (`<8y`, `<1y`) / phrase (`STILLBORN` → PHRASE) |
| `SUBN`, `RIN`, `RFN`, `AFN` | error (no 7.0 equivalent) |

**Mapping table to implement (7.0 → 5.5.1):**

| 7.0 | 5.5.1 |
|---|---|
| `SNOTE` record / pointer | `NOTE` record / pointer |
| `SEX X`, `MEDI OTHER`, `PEDI OTHER`, `ord-STAT INFANT` | error |
| `NAME.TYPE PROFESSIONAL`/`OTHER` | user-defined `TYPE` text (via the phrase) |
| age weeks | error |
| `NO` structure | error (5.5.1 has no negation) |
| `UID`, `EXID`, `CREA`, `SDATE` | error (or drop behind an explicit lossy option) |
| date `PHRASE` | parenthesized form when there is no date, otherwise a `NOTE` under `DATE` (5.5.1 §2 p.48 convention) |

**Tests:** fixture-based conversions that round-trip through both strict
serializers; one test per mapping-table row; error tests for the
"error" rows.

### 3. Application integration

**Current state (do not redo):** `apps/desktop/src/main/gedcom.ts` holds
no-op `importGedcom`/`exportGedcom` returning `null`; the IPC channels
`project:import`/`project:export` (`ipc-project.ts`), the preload API,
`doru.d.ts`, the `useProject` hook, the SidebarView buttons and the nls
keys (`features.tree.importGedcom`/`exportGedcom`) are all intact — the
UI was deliberately left untouched.

**Steps:**

1. **Wire the handlers.** Import: read bytes with the existing
   `NodeFileSystem.readBinary`, detect the version (try `parseGedcom70`,
   fall back to `parseGedcom551` on the detection errors from item 3),
   map the `GedcomDataset` to the app model, and apply it through the
   existing ops (`importGedcomOp` was removed — either restore an
   equivalent batch op or apply `addPersonOp`/`addFamilyOp` per record
   inside one transaction/op for undo). Export: `repo.toTreeDocument()`
   → map to `GedcomDataset` → `serializeGedcom70Bytes` → write. Export
   as 7.0 by default (the dialog offers `.ged`; a 5.5.1 choice is a
   product decision for later).
2. **Design the mapping `GedcomDataset ↔ @doru/core` `TreeDocument`** —
   the deliberately postponed core decision. Inventory to reconcile
   (GEDCOM constructs → what `@doru/core` can hold):
   - `INDI` → `PersonRecord { id, names, sex, birth?, death? }`; strip
     the `@` from xrefs for ids and rewrite all pointers consistently
     (`@I1@` → `I1`); `SEX X` → error or `U` (decide);
   - `FAM` → `FamilyRecord { id, parents, children }`;
   - events → `EventRecord { id, type, date?, place?, personId?, familyId? }`; map the GEDCOM `DateValue` union onto the core `DateValue`
     (`quality`: exact → `'exact'`, approx → `'about'`, bound/range →
     `'range'`, period → `'range'`, unknown → `'unknown'`);
   - notes → `NoteRecord`, sources → `SourceRecord` + citations,
     `OBJE` → `MediaRecord`;
   - GEDCOM-only constructs the core model has no slot for (TRAN,
     FONE/ROMN, PEDI/STAT detail, ordinances, shared notes vs inline,
     media FORM/MEDI, addresses, RESN…) — decide per construct:
     flatten into text fields, attach as notes, or drop, and record the
     decision here in the README.
3. **Re-enable the UI** (remove the disabled states; the nls keys and
   the `useProject` calls already exist).
4. **e2e:** extend `e2e/workflows.spec.ts` with an import → export →
   re-import round trip through the real IPC surface.

**Files:** `apps/desktop/src/main/gedcom.ts`, `ipc-project.ts`,
`packages/core` (mapping module or ops), `packages/gedcom` (only if the
mapping is generic enough to live there), renderer, e2e.

### 4. Repository follow-ups

- Update the GEDCOM section of `docs/architecture.md` (it still
  describes the pre-library stub state).
- Open a PR from `feat/gedcom-library` for review.
