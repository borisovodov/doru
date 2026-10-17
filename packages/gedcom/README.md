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

- Zero runtime dependencies today (GEDZIP will add `fflate` as the single
  dependency), pure TypeScript, no Electron or `@doru/*` imports — the
  package is testable and reusable in isolation.
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
TypeScript notation), two strict parsers and two strict serializers, and
GEDZIP modelled and planned on the same layer.

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
5.5.1 `REPO` becomes the 7.0 void pointer; the declared 5.5.1 charset is
decoded and normalized to UTF-8. The serializers emit the canonical form
of their version and reject constructs the version cannot express.

## Package layout

```
src/
  index.ts          public API re-exports
  primitives.ts     identifiers, data types, known calendars (both specs)
  enumerations.ts   enumeration sets with per-value meanings
  structures.ts     the genealogical structures (records + substructures)
  gedzip.ts         the GEDZIP container types (7.0 chapter 4)
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
5.5.1 charset (`CHAR`) is used only to select the decoder and is
normalized to UTF-8 in the model's `header.characterSet`.

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
```

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

The items below are planned and designed, but **not implemented**; they
will be built in later sessions. They are listed here so the design
decisions are written down next to the code they will extend.

### 1. Byte-level output encoding — UTF-8 only

`serializeGedcom70` / `serializeGedcom551` return text today. Writing
actual files needs a thin byte layer, and by decision **both versions
always export as UTF-8**:

- **7.0** — UTF-8 (no BOM), CRLF line endings.
- **5.5.1** — also UTF-8, with the header line `1 CHAR UTF-8` (one of
  the four permitted 5.5.1 charsets).

The model is already post-decode (see Parsing): parsing re-encodes
ANSEL/ASCII/UTF-16/UTF-8 input to Unicode (ANEL additionally
NFC-normalized) and normalizes `header.characterSet` to UTF-8, so the
byte layer never sees the source encoding. The reverse ANSEL encoding
(NFC → NFD → Appendix C bytes) is explicitly out of scope — only
*decoding* of ANSEL/ASCII/UTF-16 input is supported, and it already
exists.

Open API decision: byte-returning variants
(`serializeGedcom70Bytes` / `serializeGedcom551Bytes`) or a separate
encoding step that takes the text plus the version.

### 2. GEDZIP (7.0 chapter 4)

`GedzipArchive` / `GedzipMediaEntry` types exist; read and write are
missing. Decision: use **`fflate`** (pure TypeScript, MIT, ~8 kB) — the
package's single runtime dependency. Reading and writing zip archives by
hand is a non-core problem not worth owning.

API: `parseGedzip(bytes)` / `serializeGedzip(archive)`, with the media
files surfaced next to the dataset. GEDZIP rules to enforce: the entry
`gedcom.ged` present; one entry per local `FILE` payload with the same
(non-percent-escaped) zip name; entry names case-sensitive UTF-8; the
reserved names (`MANIFEST.MF`, `META-INF/`) left alone.

### 3. Corpus validation runs

The strict parser is a hypothesis about the real world. The plan is to
run it over a large corpus of real `.ged` files from different producers
(RootsMagic, Gramps, MyHeritage, FamilySearch samples, GEDKeeper, …),
aggregate failures by error code, and decide per finding whether to:

- extend the model (new fields or normalization rules), or
- keep the strict error and document it, or
- (rarely) accept a specification ambiguity as a documented deviation.

Already-suspected divergence points to watch: arbitrary user values in
5.5.1 `DATA.EVEN`/`SOUR.EVEN`; free-form `NAME_TYPE`; parenthesized
`ROLE` descriptors; non-`@@` at-signs in real 5.5.1 files; `CONC` in 7.0
files written by tools that migrated badly; partial dates; `B.C.` on
full dates in 5.5.1.

### 4. Version conversion layer

The serializers are strict: they reject constructs of the other version.
A conversion layer would translate instead of reject — RELA → ROLE +
PHRASE, FONE/ROMN → TRAN, 5.5.1-only fields dropped or mapped (RIN,
RFN, AFN), 7.0-only fields mapped down or omitted, phrases reconstructed
for dual years. This belongs above the format layer (its own module or a
small `@doru/gedcom-convert`), because "conversion" is a product decision,
not a format rule.

### 5. Application integration

Replace the no-op import/export IPC handlers in `apps/desktop/src/main`
with real calls into this package, and design the mapping between the
ideal model (`GedcomDataset`) and the app's own domain model
(`@doru/core` `TreeDocument`): persons, families, names, dates, events,
sources, notes, media. The mapping was deliberately postponed while the
format layer was built; it is the critical path for re-enabling the
Import/Export UI. The nls keys for the UI already exist.

### 6. Repository follow-ups

- Update the GEDCOM section of `docs/architecture.md` (it still describes
  the pre-library stub state).
- Open a PR from the feature branch so the package can be reviewed as a
  unit.
