# GEDCOM vendor extensions in the wild

Reference catalog of how real-world vendors extend GEDCOM, with links to
the most authoritative available sources. The links here are meant to be
quoted in the JSDoc of the code that recognizes or normalizes these tags
(see the "Known strict decisions" section of the package README for the
project's stance on extensions).

Compiled 2026-11. Links checked at compilation time; some vendors block
scrapers (FHUG, Gramps wiki, Legacy help) — those pages are still cited
because their URLs are stable and the content was verified via search
results and secondary sources.

## 1. How extension mechanisms differ per version

- **GEDCOM 5.5.1** has no structured extension mechanism; the de-facto
  convention is a tag prefixed with an underscore (`_TAG`). Many vendors
  also emit non-underscore tags that were dropped from the standard or
  never were in it. Sources:
  - GEDCOM 5.5.1 spec, chapter 2 — see the Legacy help quote of the
    convention:
    <https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm>
  - Tamura Jones, "GEDCOM Tags" (historical overview of tags across
    GEDCOM 3.0–5.5.5, including the 5.3 `SCHEMA`/`DEFN`/`LABL`/`ISA`
    mechanism that Family Tree Maker still writes):
    <https://www.tamurajones.net/GEDCOMTags.xhtml>
- **GEDCOM 5.5.5** (gedcom.org, 2019-10-02,
  <https://www.gedcom.org/gedcom.html>) is not a separate dialect in
  this package: files declaring it parse under the 5.5.1 rules, and
  its vocabulary additions — `SEX X`/`N`, the `BCE`/`BC` epoch
  spellings, the year-less `day month` dates, the expanded
  `MULTIMEDIA_FORMAT` set (AAC/AVI/ePub/FLAC/MKV/mobi/MP3/PDF/PNG plus
  the restored JPEG/TIFF, OLE dropped) and the structured `ADDR` without
  a line value — are accepted in any 5.x file (`GEDC.FORM.VERS` is
  tolerated but not stored). See the README's Parsing and "Known
  strict decisions" sections.
- **GEDCOM 5.3** had a schema mechanism (`SCHEMA`, `DEFN`, `LABL`,
  `ISA`) that was dropped in 5.4 but survives in Family Tree Maker
  files. Same Tamura Jones source as above.
- **Versions outside the supported set are rejected explicitly.** The
  lineage gate accepts `GEDC.VERS` 5.5 (1996), 5.5.1, 5.5.5 and any
  7.x; the pre-5.5 versions (3.0, 4.0, 5.0) and the superseded drafts
  (5.3, 5.4) fail up front with `document.wrong-version` instead of
  mid-file unknown-tag errors. GEDCOM 6.0 (the 2001–2002 XML beta
  draft, never adopted) and GEDCOM X (FamilySearch's successor
  standard family with its own XML/JSON syntax) are different
  formats, not text GEDCOM — deliberately out of scope, with no
  import planned.
  - **The GEDCOM 5.5 embedded-multimedia shape is accepted but not
    written.** 5.5.1 removed the embedded `BLOB` form of the
    multimedia record (5.5 records carry `FORM`/`TITL`/`BLOB` directly
    under `OBJE`; 5.5.1 keeps only the external `FILE` form), but old
    files and Généatique (webtrees per-vendor custom-tag registry,
    `Geneatique.php`) still write record-level `FORM`/`TITL` in
    5.5.1-declared documents. Those tags — and a `BLOB` left over from
    a 5.5 file — are accepted in any file and kept verbatim as
    generic extensions of the multimedia record (the base64 payload
    is preserved as text, continuations merged); there is no typed
    model slot for the embedded binary. On export the extensions are
    dropped in both versions — neither target grammar has the
    embedded shape, and both require extension tags to be
    underscore-prefixed — and a record that carried no `FILE` at all
    (a pure 5.5-embedded record) is dropped entirely, its links
    stripped (`serialize/prepare.ts`).
- **GEDCOM 7.0** has an official mechanism: extension tags declared in
  `HEAD.SCHMA` with URIs, plus an official registry of extensions:
  - FamilySearch GEDCOM 7 specification (extension rules):
    <https://gedcom.io/specifications/FamilySearchGEDCOMv7.html>
  - Extension registry (YAML, one file per extension):
    <https://github.com/FamilySearch/GEDCOM-registries>
  - Registry manifest of registered vendor extensions:
    <https://github.com/FamilySearch/GEDCOM-registries/blob/main/manifest/extension/manifest-extensions-en-US.tsv>
  - Cross-reference identifiers on extension structures (GEDCOM 7.0
    §1.5: "A tagged extension structure … may also have a
    cross-reference identifier") are first-class: `ExtensionStructure`
    carries the `xref`, the line parser accepts one on any
    underscore-prefixed tag at any depth (records and substructures
    alike), it registers as a pointer target, and the serializers write
    it back at its level.
  - Official test files exercising every extension form:
    <https://gedcom.io/testfiles/gedcom70/extensions.ged> and
    <https://gedcom.io/testfiles/gedcom70/extension-record.ged>.
    Both are committed as fixtures under `tests/fixtures/` and run as
    regression tests (`tests/familysearch-testfiles.test.ts`): they
    must parse and round-trip through the 7.0 serializer
    model-stably and idempotently.
  - **Documented-extension resolution** (GEDCOM 7.0 §1.5 + the 7.0.4
    clarification, implemented in `parsing/schema-tags.ts`): a
    SCHMA-declared tag whose URI is a `g7:` structure-type URI is a
    documented alias of the standard structure and parses as it,
    standard-first — `_USER → g7:record-SUBM` becomes a
    `SubmitterRecord`, `_CREATOR → g7:SUBM` types into the INDI
    submitters slot, `_PHRASE → g7:PHRASE` into the FAMC phrase slot
    (`_PERSON → g7:record-INDI` and the other six records likewise),
    and the write-back uses the standard spelling. A tag declared with
    a non-`g7:` URI, a payload-type URI (`g7:enum-…`, `g7:cal-…`,
    `g7:month-…`), or a documented tag used where the standard
    structure has no slot stays generic. **A tag declared with several
    URIs** (GEDCOM 7.0 §1.5.1: permitted when the named concepts
    cannot appear in the same place, e.g. `_LOC` as a record and as a
    pointer) resolves by context: at record level the one declaration
    naming a standard record type wins, inside a structure the one
    declaration naming a standard structure with a slot there wins —
    several matching declarations keep the extension meaning rather
    than guessing (calendar and month payloads resolve the same way).
    The test files also fixed
    real bugs along the way: extension-defined substructures under
    typed extension records (`SUBM`/`DATE` under `_LOC`) and the nested
    standard tags of generic extension records are preserved instead of
    rejected or dropped, extension epochs no longer serialize as `BCE`,
    and the model gained the 7.0 FAMC/FAMS `PHRASE` slots.
  - **Pointer-shaped extension payloads are first-class.** A line value
    matching the Xref production is syntactically a pointer in both
    versions (a text value must double its leading `@` — GEDCOM 7.0
    §1.3), so `ExtensionStructure` marks such payloads
    (`payloadKind: 'pointer'`, the raw `@…@` spelling kept). The mark
    is deliberately not resolved into a typed pointer: the official
    FamilySearch corpus ships pointer-shaped *text* in extension
    payloads (`extensions.ged`: `_IN @B1@` with no `@B1@` record), so
    an unresolved target cannot be an error. Instead the 5.5.1 and 7.0
    projections keep the marked targets alive — the NO rule and the
    place-card flattening never drop a record a marked payload
    references, so a round trip cannot emit a dangling pointer.
  - Registry tools page:
    <https://gedcom.io/tools/>

## 2. Cross-vendor catalogs (best single links)

- John Cardinal, "Common GEDCOM Extensions" (draft spec-style catalog of
  `_LOC`, `_PLAC`, `_PRIM`, `_UID`, `_SDATE`, `_SHAR`, `_ROLE`, with
  "supported by" lists and the three UUID formats in the wild, including
  the PAF checksum algorithm):
  <https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html>
- Legacy Family Tree official help — "Custom GEDCOM Tags" (Legacy's own
  tags) and "User-Defined GEDCOM Tags" (tags of other programs: PAF,
  FTM, FTW, TMG, RootsMagic, Ancestral Quest, Brother's Keeper, Family
  Origins, Generations, Reunion, Roots III):
  - <https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm>
    (canonical copy of <https://legacyfamilytree.com/help/en/articles/12810043-gedcom-files-custom-tags-in-legacy>)
  - <https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm>
    (canonical copy of <https://legacyfamilytree.com/help/en/articles/12810050-gedcom-tags-custom-tags-in-other-programs>)
- Family Historian User Group Knowledge Base, "GEDCOM Extension List"
  (the tabulated FH extension tags):
  <https://www.fhug.org.uk/kb/topic/gedcom-files/>
- GED-VIEW, "Custom GEDCOM Tags Explained: _APID, _UID, _TMPLT and
  Friends" (field-oriented summary of the most common tags):
  <https://ged-view.com/guides/custom-gedcom-tags>
- Tamura Jones, "GEDCOM 5.5.1 Annotated Edition" / "GEDCOM 5.5.5"
  (annotated spec with vendor deviations):
  <https://www.tamurajones.net/GEDCOM551AnnotatedEdition.xhtml>
- GEDCOM-L working group (CompGen): the German extension agreements —
  the `_LOC` place records (L1–L3) and the recommended user-defined
  tags (N7). The GenWiki articles are bot-protected; the content was
  verified via the Wayback Machine:
  - <https://wiki.genealogy.net/GEDCOM/_LOC-Tag>
    (archived: <https://web.archive.org/web/2024/https://wiki.genealogy.net/GEDCOM/_LOC-Tag>)
  - <https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag>
    (archived: <https://web.archive.org/web/2025/https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag>).
    Its second table ("Abweichungen vom Standard bei der Verwendung")
    catalogs the non-underscore deviations of Der Stammbaum ≤ V6 (USM6),
    Mac Family Tree 7/8 (MFT7/MFT8) and RootsMagic, based on
    <http://www.gencom.org.nz/GEDCOM_tags.html>.
- Mac Family Tree (Synium) — no official tag documentation; its 7/8
  export tags (`DEED`, `MISE`, `MRCI`, `MRRE`, `PRIV`, `RECT`, `SECG`,
  `_BKM`, `_CRE`, `_EVID`, `_FID`, `_INFO`, `_QUAL`, `_STP`, …) are
  catalogued in the GenWiki table above.

## 3. Per-vendor extensions

### Ancestry / Family Tree Maker (Mackiev)

Ancestry tree downloads attach `_APID` to source citations; Family Tree
Maker (the other side of the same lineage) has the largest private tag
set of any desktop program, including the legacy GEDCOM 5.3 schema
block.

- `_APID` — Ancestry record reference, format `dbid::record`
  (e.g. `7602::2771226`); `dbid=` and `h=` in Ancestry record URLs.
  Sources:
  - <https://tmgtogedcom.com/en/apid.htm> (T2G documentation by John
    Cardinal)
  - <https://ged-view.com/guides/custom-gedcom-tags>
- `_MILT` (military service), `_MDCL` (medical), `_FOOT`, `_DCAUSE`
  (death cause), `_MEND` (marriage ending status), `_MSTAT` (marriage
  beginning status), `_FREL`/`_MREL` (child relation to father/mother),
  `_FA1`–`_FA13` (user fact definitions), `_DETS`, `_ELEC`, `_EXCM`,
  `_MISN`, `_UNKN`, `_ADPN`, `_SEPR` — sources: the Legacy
  "User-Defined GEDCOM Tags" catalog
  (<https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm>)
  and GED-VIEW (<https://ged-view.com/guides/custom-gedcom-tags>).
- `_SCHEMA`/`SCHEMA`, `DEFN`, `LABL`, `ISA` — leftover GEDCOM 5.3
  schema mechanism still written by FTM; source: Tamura Jones
  (<https://www.tamurajones.net/GEDCOMTags.xhtml>).
- `_OID`, `_USER` + `_ENCR`, `_ORIG`, `_ATL`, `_META`, `_CLON` (with
  `_TID`/`_PID`/`_OID`/`_USER`/`_ENCR`/`_DATE`) under the OBJE record
  — the media-object management block of the Ancestry.com Family Trees
  export: object id, creator token, origin, attachment flag, metadata
  XML, and the per-clone links. The wire format is undocumented; the
  shape is taken from Ancestry's own exports (the GEDCOM.NET test tree,
  <https://github.com/JasonRawlins/Gedcom> — HEAD.SOUR "Ancestry.com
  Family Trees", VERS 2025.08). The same exports write the record-level
  RIN under each event too (`2 RIN` under BIRT/DEAT/MARR/BURI…).
- `_MTYPE`/`_STYPE`/`_SIZE`/`_WDTH`/`_HGHT` under OBJE.FILE.FORM —
  the media metadata of the same exports: the display kind (portrait,
  document, headstone, story, place, …), the stored encoding (jpeg,
  png, x-inline, pdf, …), the file size in bytes and the picture
  dimensions in pixels. `_DSCR` (the description) and the `_MSER` +
  `_LKID` pair (the master mark with the link id tying the clones to
  it) sit beside them under the OBJE record. The crop rectangle under
  the inline media links is spelled `_CROP` with `_LEFT`/`_TOP`/
  `_WDTH`/`_HGHT`. Same source as above.
- The bare `FILE` line of those media records (FORM/TITL substructures
  but no file name) is accepted as the empty path so the record
  survives export.

### RootsMagic

- `_TMPLT` — Evidence Explained source template with `FIELD`/`VALUE`
  pairs. Source: GED-VIEW (<https://ged-view.com/guides/custom-gedcom-tags>).
- `_SDATE` (sort date), `_PLAC` (master place record), `_PRIM`, `_SHAR`
  + `_ROLE`, `_UID` — sources: jfcardinal
  (<https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html>) and the
  Legacy catalog.
- `_SUBQ` (subsequent source citation format), `_SENT` (event sentence),
  `_PPFX` (place prefix) — source: Legacy catalog.

### Legacy Family Tree (Millennia)

Officially documented by the vendor; the full list is in "Custom GEDCOM
Tags" (<https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm>):
`_CAT`, `_CDATE`, `_CONF_FLAG`, `_DATE`, `_DATE_TYPE`, `_DESC_FLAG`,
`_EMAIL`, `_EVENT_DEFN`, `_FREL`, `_ITALIC`, `_LIST1`–`_LIST6`, `_LOCL`,
`_MREL`, `_NAME`, `_NONE`, `_OVER`, `_PAREN`, `_PLAC_DEFN`,
`_PLACE_TYPE`, `_PP_EXCLUDE`, `_PREF`, `_PREP`, `_PRIM`, `_PRIV`,
`_QUOTED`, `_RDATE`, `_SCBK`, `_SEN1`–`_SEN8` (event sentences),
`_SENDOM`/`_SENDPM`/`_SENM`/`_SENPOM` (PAF-style sentence variants),
`_SORT`, `_SOUND`, `_STAT`, `_TAG`, `_TAG2`–`_TAG9`, `_TODO`, `_TYPE`,
`_UID`, `_URL`, `_VERI`. Note the records `_TODO`, `_EVENT_DEFN`,
`_PLAC_DEFN` at level 0.

### The Master Genealogist (TMG) / TMG to GEDCOM

Documented by John Cardinal's TMG to GEDCOM
(<https://tmgtogedcom.com/en/tag-names.htm>): `_CREF` (citation
reference), `_FULL` (formatted source), `_PLAC` (master place record),
`_ROLE` (co-participant role), `_PRIM`, `_SHAR` (shared event / witness
co-participant ID), `_SDATE`, `_FREL`, `_MREL`, and non-standard `OBJE`
under `NAME`/`_PLAC`.

### Family Historian (Calico Pie)

The full tag list is in the FHUG Knowledge Base
(<https://www.fhug.org.uk/kb/topic/gedcom-files/>). Confirmed by the
jfcardinal catalog
(<https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html>): `_PLAC`
(master place records plus a second place for an event, e.g.
"from"/"to"), `_SDATE` (via the Export GEDCOM File plugin), `_SHAR`
(with `ROLE`), `_UID`. FH 7 adds fact flags (`_FLGS`) and source
templates backed by FH-specific extensions — see FHUG
(<https://www.fhug.org.uk/kb/kb-article/exporting-templated-sources/>).

### webtrees

- `_WT_OBJE_SORT` (media sort order), `_PRIM`, `_DATE`-style flags;
  webtrees follows 5.5.1 plus "some of the more common extensions":
  <https://webtrees.net/gedcom/>
- Support for the German extension standards GEDCOM-L and GEDCOM 5.5EL
  (`_LOC` first-class locations): <https://webtrees.net/gedcom/> and
  GenWiki <http://wiki-en.genealogy.net/Gedcom_5.5EL>.

### Gramps

- The "GEDCOM Extensions" addon writes event witnesses as `ASSO @xref@`
  + `TYPE INDI` + `RELA <role>` (Geneanet convention), see the addon
  wiki page (<https://gramps-project.org/wiki/index.php/Addon:GEDCOM_Extensions>)
  and source (<https://github.com/gramps-project/addons-source/tree/master/GedcomExtensions>).
- Gramps imports many vendor tags (`_UID` etc.); the wiki GEDCOM page
  links the vendor catalogs:
  <https://www.gramps-project.org/wiki/index.php/GEDCOM>.

### Personal Ancestral File (PAF, discontinued)

PAF was the original source of several de-facto tags and the PAF UUID
format (32 hex + 4-hex checksum): `_AKA`, `_AKAN`, `_BIRN`, `_CURN`,
`_FARN`, `_GERN`, `_ADPN`, `_MARNM`, `_PRIM`, `_PRIMARY`, `_SCBK`,
`_SSHOW`, `_TYPE`, `_UID`, `_EVENT_DEFN` with `_SENM`/`_SENF`/`_SENU`
sentence definitions and `_CONF_FLAG`/`_DATE_TYPE`/`_DESC_FLAG`/
`_PLACE_TYPE`/`_MEDC`/`_NAME`/`_EMAIL`. Sources: the Legacy catalog
(<https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm>)
and the UUID formats section of jfcardinal
(<https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html>).

### MyHeritage / Family Tree Builder

No official documentation of its tags; field reports agree on `_UID`
(UUID), `_UPD` (last-updated timestamp) and `_MARNM`-style name tags.
Sources: GED-VIEW (<https://ged-view.com/guides/custom-gedcom-tags>)
and the `_UID` section of jfcardinal
(<https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html>).

- `_MTTAG` records — the tree tags (user-defined labels such as "DNA
  Match", "Common DNA Ancestor"): NAME, RIN, the `_VISI 1` visible
  flag and the `_MTCAT @C…@` category pointer; individuals link their
  tags with `1 _MTTAG @T…@`. The `_MTCAT` records carry NAME and RIN.
  Observed in MyHeritage exports (the corpus files "Natasha Taylor
  Family Tree.ged", "DiGiustino Bio_2023.ged", …); the wire format is
  undocumented. Typed as `TreeTagRecord` / `TreeCategoryRecord` +
  `IndividualRecord.treeTags`.

### Brother's Keeper

Extensive private name/event tags, catalogued by Legacy: `_ADPN`,
`_AKAN`, `_BIRN`, `_BRTM`, `_CENN`, `_COML`, `_CURN`, `_EYEC`, `_FARN`,
`_FKAN`, `_FNRL`, `_GERN`, `_HEBN`, `_HAIR`, `_HEIG`, `_INDN`, `_INTE`,
`_MARN`, `_MBON`, `_NLIV`, `_NMAR`, `_NMR`, `_OTHN`, `_PRMN`, `_RELN`,
`_SEPR`, `_SLDN`, `_SHON`, `_WEIG`, `_YART`. Source: the Legacy catalog.

### Ancestral Quest, Family Origins, Generations, Reunion, Roots III

Catalogued in the Legacy "User-Defined GEDCOM Tags" page (same URL as
above): `_AKA`, `_DATE2`, `_HUSB`/`_WIFE`, `_MASTER`, `_PRIMARY`,
`_VERB` (Ancestral Quest); `_CORR`+`_REAS`/`_RESP`/`_RPLY`, `_TODO`
(Family Origins); and a long list of non-underscore tags used by
Generations/Reunion (`CIRC`, `CLER`, `EYES`, `HEIG`, `MILF`, `SEPA`,
`CITN`, `EXCO`, …). `_DATE2`, `_PRIMARY`, `_TODO`, the `_CORR` block
and the `_HUSB`/`_WIFE`/`_MASTER` tags are typed; `_VERB` (AQ11, the
catalogs give it no description) stays generic — see chapters 6 and 7.

### GEDKeeper

Open-source, targets full 5.5.1 conformance; uses `_UID` and the common
`_SHAR`-family extensions. No separate tag documentation; the source of
record is the repository: <https://github.com/Serg-Norseman/GEDKeeper>.

### Heredis

French desktop genealogy (heredis.com). No documented private tag set:
Heredis exports standard GEDCOM 5.5.1 with media, URLs and notes, and
is known for a sloppy header (no byte-order mark, per Tamura Jones'
"Heredis 2025 Place Name Handling":
<https://www.tamurajones.net/Heredis2025PlaceNameHandling.xhtml>).
The T2G template notes it has no sort dates:
<https://www.tmgtogedcom.com/en/template-heredis.htm>.

- `_FIL` under INDI — the person's filiation: their child status
  relative to the recorded parents (`LEGITIMATE_CHILD`,
  `NATURAL_CHILD`, `ADOPTED_CHILD`, `RELATIONSHIP_UNKNOW` — observed
  in Heredis exports such as "Dudouyt Heredis 2014-Export.ged",
  HEAD.SOUR "Heredis MAC2021"; the webtrees per-vendor registry lists
  the tag as "what do they mean?"). Typed as
  `IndividualRecord.filiation` (free text, written back as `_FIL` in
  both versions).
- `_UST` under FAM — the union status of the couple (MARRIED,
  DIVORCED, SEPARATED, COMMON_LAW, COHABITATION, ENGAGEMENT, UNKNOWN
  — observed in the same exports). Typed as
  `FamilyRecord.unionStatus` (free text, written back as `_UST` in
  both versions).

### Ancestris

Open-source French GEDCOM editor (ancestris.org). It manages all
standard tags plus user-defined ones and contributes its own, most
notably `_SOSA` (the Sosa–Stradonitz Ahnentafel number of an
individual) — see the user guide, "Tags":
<https://docs.ancestris.org/books/user-guide/page/tags>. `_SOSA` is
typed (chapter 6); its other `_` tags round-trip generically.

### Agelong Tree

Russian genealogy suite (Genery Software, genery.com). No documented
private tag set; it exports standard 5.5.1 with the common `_UID`
record identifiers. Nothing to type; unknown `_` tags round-trip
generically.

### GEDCOM-L / GEDCOM 5.5EL (German extension standards)

An extension agreement of the GEDCOM-L working group (CompGen), the de
facto standard of German genealogy software (Ahnenblatt, Ages!, GES,
Stammbaumdrucker, webtrees, …). Two parts:

- **Place records** (agreements PLAC/P3 and `_LOC` L1–L3): `0 @P@ _LOC`
  records with `NAME {1:M}` (each optionally dated, abbreviated, and
  language-tagged), `TYPE` (the place kind, with the `_GOVTYPE` GOV
  object-type id), `_GOV` (the GOV gazetteer id), `_POST` (postal
  codes, each with a validity DATE), `_AIDN` (administrative
  identifiers with the required TYPE), `_DMGD` (demographical data
  with the required TYPE), `_MAIDENHEAD` (QTH locator), `RELI`
  (denomination), `EVEN` (place events with an event detail), and the
  `_LOC` hierarchy links qualified by `TYPE POLI|RELI|GEOG|CULT` and a
  DATE. Events link with `_LOC @xref@` under PLAC, and `_GOV`/`_POST`/
  `_MAIDENHEAD` also appear directly under PLAC. The deprecated FOKO
  tags (`_FPOST`/`_FSTAE`/`_FCTRY`/`_FOKOID`/`_NAMC`) were removed
  from the agreement in 2019 and stay generic. Source: the GenWiki
  "GEDCOM/_LOC-Tag" article (chapter 2).
- **Person-side tags** (agreements N7, ASSO A4, NAME Ruf.B2):
  `_RUFNAME` (call name) under INDI.NAME; `_GODP` (godparents) and
  `_WITN` (witnesses) under events **and under INDI** — both **free
  text**, not pointers; `_ASSO @xref@` + `RELA` for event participants.
  The `_TYPE same-sex` FAM convention (Ahnenblatt) is not part of the
  N7 list. Source: the GenWiki "GEDCOM/_Nutzerdef-Tag" article with
  the full known-tag table (chapter 2).
- **The N5 header declarations** (`1 _SCHEMA` + a context chain +
  `_DEFN <definition>` leaves) parse into the same `Header.schema53`
  block the FTM 5.3 declarations use (the `_DEFN` spelling normalizes
  to the 5.3 DEFN leaf); written back as `SCHEMA` in 5.5.1, dropped
  on 7.0. The historical 5.5EL spellings are recognized too: the
  non-underscore `ASSO` under FAM, `POST` under PLAC, the
  `MAP <locator>` + `TYPE MAIDENHEAD` Maidenhead form under PLAC
  (→ `PlaceStructure.maidenhead`), and the `GIVN` + `TYPE RUF` call
  name with repeated GIVN lines (→ `PersonalNameStructure.callName` /
  appended given names). Sources: the English GenWiki article "Gedcom
  5.5EL" (marked historical) and the N5 section of
  "GEDCOM/_Nutzerdef-Tag".
- **The §8.2 AGE corrections** ("Corrections to GEDCOM Files") are
  implemented on import: the faulty AGE spellings real files carry
  (a plain number, spaces between numbers and units, three bare or
  hyphen-separated groups, the German J/M/T letters, the spelled-out
  English/German unit words and yr/mo/da, weeks, the ABT/ABOUT/~
  prefixes, negative months/days) are corrected per the addendum's
  examples, and an AGE at level 1 of an INDI record is interpreted as
  the age at death (subordinated to DEAT). The suggestions are
  corrections for faulty files, not new grammar: the strict order rule
  still applies to the corrected value (see the README's Parsing
  section).

## 4. Registered GEDCOM 7.0 extensions (official registry)

The FamilySearch GEDCOM registry (the GEDCOM-registries repository) is
the official registry of 7.0 extension tags: each entry is a YAML file
under `structure/extension/` plus a row in the manifest
(<https://github.com/FamilySearch/GEDCOM-registries/blob/main/manifest/extension/manifest-extensions-en-US.tsv>).
Every registered construct below is treated as valid input and typed in
the model, with the registry YAML cited in the field JSDoc. The
prerelease `_SOUR` is typed too — the relocated `SourceCitation` list:
`PageStructure.citations` under `PAGE`, `SourceRecord.relocatedCitations`
under a SOUR record.

| Registry entry | Tag | Position | Model field | Export |
| --- | --- | --- | --- | --- |
| [Ancestry_PUBL_DATE.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/Ancestry_PUBL_DATE.yaml) | `DATE` | under `SOUR.PUBL` {0:1}, DateExact | `SourceRecord.publicationDetails.date` | 7.0; dropped on 5.5.1 |
| [Ancestry_PUBL_PLAC.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/Ancestry_PUBL_PLAC.yaml) | `PLAC` | under `SOUR.PUBL` {0:1}, place name | `SourceRecord.publicationDetails.place` | 7.0; dropped on 5.5.1 |
| [MagiKey_record_CENR.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_record_CENR.yaml) | `_CENR` | record: `_SCHD` {0:1}, `SEX` {0:M}, `INDI` {1:M}, `DATE` {1:1}, `PLAC` {1:1}, `SOUR` {0:1}, `CHAN` {0:1} | `CensusRecord` | both versions |
| [MagiKey_CENR.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_CENR.yaml) | `_CENR` | under `BIRT`, `INDI-CENS` and `OCCU` {0:M} each (event/attribute details) and `INDI-NAME` {0:M}: a pointer to the census record, "semantically similar to `SOUR`" | `EventDetail.censusLinks` / `PersonalNameStructure.censusLinks` | both versions |
| [MagiKey_CENR_INDI.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_CENR_INDI.yaml) | `INDI` | under `_CENR`: pointer to INDI, with `FATH`/`MOTH` {0:1}, `_MSTAT` {0:1}, `AGE`, `BIRT`, `FACT` {0:M}, `NAME`, `OCCU`, `ROLE`, `SEX` | `CensusRecord.entries` | both |
| [MagiKey_FATH.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_FATH.yaml) / [MagiKey_MOTH.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_MOTH.yaml) | `FATH` / `MOTH` | under the census `INDI`: `AGE`, `BIRT`, `FACT`, `MARR`, `OCCU` {0:1} each | `CensusIndividual.father` / `mother` | both |
| [MagiKey_AGER.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_AGER.yaml) | `_AGER` | under `AGE` {0:1}, payload `Integer-Integer` | `AgeStructure.ageRange` | both |
| [MagiKey_MSTAT.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_MSTAT.yaml) | `_MSTAT` | under the census `INDI` | `CensusIndividual.maritalStatus` | both |
| [MagiKey_SCHD.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_SCHD.yaml) | `_SCHD` | under `_CENR` | `CensusRecord.schedule` | both |
| [MagiKey_CENR_SEX.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_CENR_SEX.yaml) | `SEX` | under `_CENR` {0:M}: the sex of a set of individuals in a head-of-household census, with `AGE` {1:1} and `TYPE` {0:1} | `CensusRecord.sexes` | both |
| [MagiKey_CENR_SEX_AGE.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_CENR_SEX_AGE.yaml) | `AGE` | under the census `SEX` {1:1}, payload `AGE_AT_EVENT`, with `_AGER` {0:1} and the **FAM-NCHI {1:1} child count** ("An NCHI substructure is used to hold the count of relevant individuals in the indicated age range") | `CensusSexStructure.age` / `CensusSexStructure.childCount` (required, like the registry declares) | both, written back as `NCHI <count>` under the AGE line |
| [_DATE.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/_DATE.yaml) | `_DATE` | under `REPO` {0:M}, DateValue + TIME/PHRASE (marked prerelease) | `RepositoryRecord.dates` | both |
| [_SOUR.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/_SOUR.yaml) | `_SOUR` | under `PAGE` {0:M} and `record-SOUR` {0:M}, a relocated citation: the standard SOUR tag moved under PAGE or under the SOUR record, same payload (a pointer) and same substructures (NOTE, OBJE, PAGE, QUAY, SNOTE, SOUR-DATA, SOUR-EVEN; marked prerelease) | `PageStructure.citations` / `SourceRecord.relocatedCitations` | both, written back under the PAGE line / under the SOUR record |

The registry keeps a second manifest — `manifest-MagiKey-CENR-en-US.tsv`
— which carries the `SEX`/`AGE` entries above; the `SEX.AGE.NCHI`
child count is the one registry construct the earlier inventory (this
chapter before 2026-10) missed, and it is typed now. The registry's
`data-type/extension/MagiKey-AgeRange.yaml` (the `Integer-Integer`
payload of `_AGER`) is enforced as the `_AGER` payload regex.

Note on the nonconformant uses of standard tags (PUBL.DATE/PLAC and
the census INDI/FATH/MOTH/SEX): the core of GEDCOM 7.0 §1.5 permits
extension-defined substructures only under extension tags, so these
are invalid core 7.0; the registry documents them as vendor practice,
and this package accepts them per the registry — the rule is recorded
in the JSDoc of each affected field. Covered by
`tests/registry-extensions.test.ts`.

### Undocumented extension records stay generic (deliberate decision)

GEDCOM 7.0 §1.5 defines an extension tag's grammar as whatever the
writing extension defines — a tag name carries no meaning by itself,
and two writers may use the same tag for unrelated things (a "shared
tag"). The parser therefore types an extension record only when one of
three anchors identifies its meaning:

1. **A SCHMA declaration with a `g7:` structure-type URI** — the tag
   is a documented alias of a standard structure and parses as it,
   standard-first (the documented-extension resolution of
   `parsing/schema-tags.ts`: `_USER → g7:record-SUBM` becomes a
   `SubmitterRecord`).
2. **A known vendor grammar** — a documented convention assigns the
   tag a structure (`_LOC` with `NAME {1:M}` is the GEDCOM-L place
   record → `PlaceRecord`; the MagiKey `_CENR` → `CensusRecord`).
3. **An unambiguous standard tag in a standard position** — covered by
   the normal standard grammar, not by extensions.

The official FamilySearch test file `extensions.ged` exercises the
deliberate *absence* of all three anchors:

```
0 @L1@ _LOC
1 SUBM @U2@
1 DATE TO 1880
2 PHRASE Dissolved in the 1870s
```

The file's own comments label the record "undocumented record with
shared tag", the `SUBM` child "extension-defined substructure", and
the `DATE` child "ambiguous extension-defined substructure": a `_LOC`
record that is *not* the GEDCOM-L place record (anchor 2 fails — the
`NAME` child the agreement requires is missing), is *not* declared in
SCHMA (anchor 1 fails), and whose children are standard tags only by
spelling, not by meaning (anchor 3 fails — the specification itself
declines to say the `DATE` is a date).

Such a record parses as a generic `ExtensionRecord` — the tag, xref,
payload and the whole child tree are kept verbatim (`model/extensions.ts`;
`parseRecord` in `parsing/document.ts` returns `parseExtension` for it
instead of failing `structure.missing-required`, which is what the
strict GEDCOM-L parser would have done before). This is **not a loss**:
the record is a first-class model node, and the 7.0 round trip is
byte-stable — the regression over the official test files requires
deep model equality and idempotent output
(`tests/familysearch-testfiles.test.ts`). What stays untyped is only
the semantics, and the semantics are deliberately absent from the
file.

The rejected alternative: typing the children speculatively — parsing
a `DATE`+`PHRASE` that merely *looks* standard as a standard
`DateStructure` inside an unknown extension record. Rejected because
(a) it fabricates meaning the writer did not assert (the file itself
marks the case "ambiguous"), violating the project's rule that a
construct is typed only when a source documents it; (b) it would
require widening `ExtensionStructure.children` from the uniform
extension tree into a union with every typed structure, touching the
whole model; and (c) the only known producer of the form is the
synthetic test file — real programs that write `_LOC` write the
GEDCOM-L form, which *is* typed. Revisit only if the corpus
validation runs (README "Future work") show a real vendor writing
such records with a documented meaning.

## 5. Modeled in Dóru

Following the same approach as the 5.5.1-over-7.0 layering, the
multi-vendor core extensions are typed fields of the unified model;
the long tail of single-vendor tags stays generic
`ExtensionStructure`/`ExtensionRecord` (kept in the model, never
typed). The unified policy: known tags are recognized on input in both
versions; on output a construct with a standard equivalent uses the
target version's standard spelling, and a construct without one is
written as the vendor tag in both versions when the tag is
underscore-prefixed (both targets can spell it) and dropped otherwise.
The full rules live in the
JSDoc of each model field and in the README's "Vendor extensions"
section.

| Vendor tag | Model field | 5.5.1 export | 7.0 export |
| --- | --- | --- | --- |
| `_UID` | `identifiers[]` / `EventDetail.uniqueIds` | `_UID` | standard `UID` |
| `_SDATE` | `EventDetail.sortDate` | `_SDATE` | standard `SDATE` |
| `_SHAR` + `_ROLE`/`ROLE` | `EventDetail.associations` (ROLE OTHER + PHRASE) | `_SHAR`/`_ROLE` | standard `ASSO`/`ROLE` |
| `_PRIM` | `MultimediaLink.primary` | `_PRIM Y` | `_PRIM Y` (no standard equivalent) |
| `_FREL`/`_MREL` | `FamilyChildLink.fatherRelation`/`motherRelation`, `ChildFamilyLink.fatherRelation`/`motherRelation` | `_FREL`/`_MREL` | standard-first: agreeing pair → the matching `INDI.FAMC.PEDI`; otherwise dropped |
| `_APID` | `SourceCitation.ancestryPointers`, `EventDetail.ancestryPointers`, `PersonalNameStructure.ancestryPointers` | `_APID` | `_APID` (no standard equivalent) |
| `_PLAC` / `_LOC` / `_PLAC_DEFN` records | `PlaceRecord` (+ `PlaceStructure.location` links) | flattened: map/notes merged into referencing `PLAC` (citations/media dropped), records/links not written (the GEDCOM-L cards survive as `_LOC` records) | written back as `_LOC` extension records with the full contents, links kept (GEDCOM 7.0 §1.5) |
| `_PLAC` under events | `EventDetail.additionalPlaces` | `_PLAC` | `_PLAC` |

Covered by `tests/vendor-extensions.test.ts` and
`tests/place-records.test.ts` (import, export, and cross-version
round trips).

## 6. Implemented tag inventory

All of the priority tiers of the original checklist are now
implemented, so the checklist is gone: this chapter is the final
inventory of what the parsers type today. The core cross-vendor set —
`_UID`, `_SDATE`, `_SHAR`/`_ROLE`, `_PRIM`, `_FREL`/`_MREL`, `_APID`,
the `_PLAC`/`_LOC`/`_PLAC_DEFN` place records, the `_LOC` link under
`PLAC`, and the `_PLAC` second place — is the table in chapter 5. The
rest follows; each model field carries its sources and export rules in
its JSDoc.

| Tag | Vendors | Meaning | Model field |
| --- | --- | --- | --- |
| `_TMPLT` | RootsMagic, FTM | Evidence Explained source template: `FIELD`/`VALUE` pairs under SOUR (page, URL, film no, …) | `SourceRecord.template` (TID + FIELD NAME/VALUE) |
| `_MARNM` (also `_MARN`) | AQ, PAF5, BKW6, "several programs and websites" | Married name — at INDI level a separate name entry, at NAME level (the GenWiki-documented position) a name-level value | `names[]` with `TYPE MARRIED` (INDI level) / `PersonalNameStructure.marriedName` (NAME level, written back as `_MARNM`) |
| `_AKA` / `_AKAN` | AQ, PAF4/5, BKW6 | "Also known as" name — same two positions as `_MARNM` | `names[]` with `TYPE AKA` (INDI level) / `PersonalNameStructure.alsoKnownAs` (NAME level, written back as `_AKA`) |
| `_UPD` | MyHeritage | Record last-updated timestamp | `IndividualRecord.updatedAt` / `FamilyRecord.updatedAt` |
| `_WT_OBJE_SORT` | webtrees | Per-link media sort order | `media` (array order preserves the sort) |
| `_DATE` under OBJE | Legacy, webtrees | Date of a media object | `MultimediaRecord.date` |
| `_EMAIL` | BKW6, FO9, PAF | E-mail under an address block | `AddressStructure.email` |
| `_NONE` | Legacy, Ahnenblatt | "Couple had no children" under FAM — Legacy writes the bare tag, Ahnenblatt `_NONE Y` (the only documented value, by analogy with `MARR Y`); both normalize into the standard `NCHI 0` | FAM `attributes` `NCHI 0` |
| `_MILT` / `_MDCL` / `_FOOT` | FTM | Military service / medical / footnote facts | `EVEN` + TYPE |
| `_DCAUSE` | FTM | Death cause | `DEAT.CAUS` |
| `_CIRC` / `_FUN` | FTM201x, Ancestry | Circumcision / funeral (the FTM/Ancestry spellings of the facts BKW writes as `_BRTM`/`_FNRL`) | `EVEN` + TYPE |
| `_DEG` | FTM201x, webtrees, Gramps | Degree (educational attainment) | `EDUC` + TYPE "Degree" |
| `_EMPLOY` | FTM201x, Ancestry | Employment — kept as FACT, not OCCU: Ancestry distinguishes the two ("_EMPLOY = Beruf, OCCU = Beschäftigung") | `FACT` + TYPE "Employment" |
| `_DNA` / `_NAMS` | FTM201x, webtrees | DNA markers / namesake (kept free text; the catalog does not say whether _NAMS is a name or a pointer) | `FACT` + TYPE |
| `_MILTID` | FTM201x | Military identification number | `REFN` identifier + TYPE "Military" |
| `_DATE2` | PAF, AQ3, Ancestry, FTQ&E, Heritage, PhpGedView | The end date of an event ("bis-Datum"), value like DATE | `EventDetail.endDate` (written back as `_DATE2` in both versions) |
| `_STAT` under FAM | Legacy, AQ, Ages!, GDO, webtrees; the GEDCOM-L agreement FAM F7 | Marriage status — the bare status line of the vendors, or the full F7 STATUS_STRUCTURE: `{0:M}` per family (F7.4) with the optional `DATE`/`PLAC`/`NOTE`/`SOUR` substructures (the GenWiki "GEDCOM/FAM-Tag" article) | `FamilyRecord.marriageStatuses` (written back as the `_STAT` lines with their substructures in both versions) |
| `_MSTAT` / `_MEND` under FAM | FTW | The status at the beginning / end of the marriage (Friends, Engaged, Married, … / Married, Divorced, Annulled, Widowed, …) | `FamilyRecord.marriageBeginningStatus` / `marriageEndingStatus` (written back in both versions) |
| Gramps `ASSO` + `TYPE INDI` + `RELA` | Gramps | Event witnesses under family events | `EventDetail.associations` (like `_SHAR`) |
| `_CREF` / `_FULL` | TMG (via T2G) | Citation reference / formatted footnote text | `SourceCitation.reference` / `SourceRecord.fullFootnote` |
| `_SUBQ` under citations | RootsMagic | Subsequent source citation format (report wording) | `SourceCitation.subsequentCitationFormat` (written back in both versions) |
| `_SENT` / `_PPFX` under event details | RootsMagic | Event sentence / place prefix (report wording); the Legacy catalog spells them without the underscore — `SENT`/`PPFX` are recognized in any file too | `EventDetail.sentence` / `placePrefix` (written back as `_SENT`/`_PPFX` in both versions) |
| `_TYPE` under OBJE | AQ, FO7, PAF5, Legacy | Media object kind (Photo/Sound/Video) | `MultimediaRecord.objectType` |
| `_SCBK` / `_SSHOW` | AQ, FO7, PAF5 | Scrapbook / slideshow media flags | `MultimediaLink.scrapbook` / `slideshow` |
| `_PRIMARY` | AQ, PAF5 | Primary family for an adopted child | `ChildFamilyLink.primary` |
| `_URL` under INDI | Legacy | Web address of a person | `IndividualRecord.url` |
| `_PRIV` under events / ADDR | Legacy | Event or address marked private | `EventDetail.restriction` PRIVACY / `AddressStructure.private` |
| `_ITALIC` / `_PAREN` / `_QUOTED` under SOUR | Legacy, AQ3 | Source title in italics / publication facts in parentheses / source title in quotes on reports (both `Y` and `YES` value spellings, plus the bare tag, are accepted) | `SourceRecord.titleItalic` / `publicationParenthesized` / `titleQuoted` (written back as `_ITALIC Y`/`_PAREN Y`/`_QUOTED Y` in both versions) |
| `_LIST1`–`_LIST6` under ADDR | Legacy | Report address groupings: Newsletter, Family Association, Birthday, Research, Christmas, Holiday | `AddressStructure.newsletterList` … `holidayList` (written back as `_LIST1 YES` … `_LIST6 YES` in both versions) |
| `_SORT` under ADDR | Legacy | The report sort spelling of the addressee's name | `AddressStructure.sortName` (written back in both versions) |
| `_OVER` under events | Legacy | The event sentence override — the same slot RootsMagic spells `_SENT` | `EventDetail.sentence` (written back as `_SENT` in both versions) |
| `_PREP` under `_PLAC_DEFN` | Legacy | The location preposition of the place card | `PlaceRecord.preposition` (written back in both versions; the record survives as a `_LOC` record for it) |
| `_MEDC` under INDI | PAF5, BKW6+, webtrees | A medical condition (the Legacy catalog lists the tag without a description; the GenWiki table documents the meaning) | `FACT` + TYPE "Medical condition" |
| `NOTP` under INDI | WinFamily | A private note — text the author marked as not for publication | inline `Note` with `private: true` (written back as `NOTE` + `_PRIV Y` in both versions; see `Note.private`) |
| `_PREF` | Legacy | Preferred spouse / child / parents | `SpouseFamilyLink.preferred`, `FamilyPartnerLink.preferred`, `FamilyChildLink.preferred`, `ChildFamilyLink.preferred` |
| `_VERI` | Legacy | Verified checkmark on citations and places | `SourceCitation.verified`, `PlaceStructure.verified` |
| `_EXCM` / `_MISN` | FTM | Excommunicated / Mission facts | `EVEN` + TYPE |
| `_UNKN` | FTW8 | Special individual ID for later file comparisons | the `UID` identifier (exports as `_UID`) |
| `_NAME` under ADDR | PAF | Name of the addressee | `AddressStructure.name` |
| `_SOSA` | Ancestris | Sosa–Stradonitz (Ahnentafel) number of the individual | `IndividualRecord.sosaNumber` (written back in both versions) |
| `_FSFTID` (also `_FID`, and the non-underscore `FSFTID`) | Familienbuch, Legacy, AQ, Family Historian, webtrees (`_FSFTID`); MFT7, Familienbuch (`_FID`); RootsMagic (`FSFTID`) | FamilySearch Family Tree person id (PID) under INDI | `IndividualRecord.familySearchId` (written back in both versions as `_FSFTID`) |
| `_AHNNR` under INDI | GES2000 | The ancestor-table (Kekulé) number — the same slot Ancestris' `_SOSA` carries | `IndividualRecord.sosaNumber` (written back in both versions as `_SOSA`) |
| `_HEIRATNAME` under INDI | AF2000 | The name after marriage — the same slot `_MARNM` carries | `names[]` with `TYPE MARRIED` |
| `_CALL` / `_FRKA` / `_HNM` / `_INDG` / `_LNCH` under INDI | BKW6+ (`_CALL`, `_FRKA`, `_HNM`, `_INDG`, `_LNCH`), WebT (`_HNM`) | Further name variants: called name, formerly known as, Hebrew name, indigenous name, legal name change (GenWiki "GEDCOM/_Nutzerdef-Tag" table) | `names[]` with `TYPE OTHER` and a PHRASE label |
| `_MARI` under FAM | BKW6+, webtrees | The marriage intention — the sibling of the standard MARB/MARC/MARL | FAM `EVEN` + TYPE "Marriage intention" |
| `_PRI` under events | AGES! | The primary event flag (bare tag, "no value") | `EventDetail.primary` (written back as the bare `_PRI` in both versions) |
| `_EVN` under events | BKW6+ | The event number, referenced from witness ASSO links ("Witness at event _EVN ##") | `EventDetail.eventNumber` (written back in both versions) |
| `_CTYP` under OBJE.FILE | Ahnenblatt | The content type of the picture (person, group, place, signature, tombstone, document, heirloom) | `MediaFile.contentType` (written back in both versions) |
| `_WT_USER` under CHAN | webtrees, kiwitrees | The user name of the user who made the change | `ChangeDate.user` (written back in both versions) |
| `_CREAT` (also `_CREA`/`_CRE`) under INDI/FAM | GenPlus (`_CREAT`); Heredis (`_CREA`); MFT7 (`_CRE`) | The date the record was created (kept free text: the wire format is undocumented) | `IndividualRecord.createdAt` / `FamilyRecord.createdAt` (written back as `_CREAT` in both versions) |
| `_TODO` under INDI/FAM | GenoPro, RootsMagic, Ahnenblatt, webtrees, GDO, FO7, Legacy, BKW | To-do structure with `DESC`/`PRTY`/`STAT`/`DATE`/`NOTE`; the GEDCOM-L agreement TODO E1 (GenWiki "GEDCOM/TODO-Tag") adds `_CAT`, `_PRTY` (→ `priority`), `TYPE`, `DATA`, `_CDATE`, `_RDATE`, `REPO` and `_UID` — all typed (the Legacy level-0 `_TODO` record is the separate `TodoRecord`) | `IndividualRecord.todos` / `FamilyRecord.todos` (written back in both versions) |
| `_EVENT_DEFN` record | Legacy, PAF5 | The Event Definition record: the defined event tag (payload, standard-tag child, or TYPE child), the `_CONF_FLAG`/`_DATE_TYPE`/`_DESC_FLAG`/`_PLACE_TYPE`/`_PP_EXCLUDE` definition flags, the `_SEN1`–`_SEN8` sentences and the PAF5 sentence set (`_SENM`/`_SENF`/`_SENU` + Date-Only/Place-Only/Date-and-Place variants) | `EventDefinitionRecord` (written back in both versions; the event tag is written as the record payload) |
| `SCHEMA` / `_SCHEMA` | FTM; the GEDCOM-L agreement Nutzerdef.N5 | The GEDCOM 5.3 user-tag declaration block (context chains + LABL/DEFN/ISA; the GEDCOM-L spelling uses the `_SCHEMA` block with `_DEFN` leaves — both parse into the same entries) | `Header.schema53` (written back in 5.5.1 as `SCHEMA` + `DEFN`; dropped on 7.0) |
| `_TAG` / `_TAG2`–`_TAG4` under SOUR | Legacy | The report inclusion flags of a source citation — the citation detail, the citation itself, the detail text, the detail notes (the vendor's help documents the value spellings `_TAG NO`, `_TAG2 NO`, `_TAG3 YES`, `_TAG4 YES`) | `SourceRecord.citationDetailIncluded` / `citationIncluded` / `citationDetailTextIncluded` / `citationDetailNotesIncluded` (written back as `_TAG YES`/`_TAG NO` … in both versions; the value is required — an absent value under SOUR is ambiguous, see chapter 7) |
| `_TYPE` under SOUR | Family Historian | The source record type (Census, Birth Certificate, …) | `SourceRecord.sourceType` (written back in both versions; under OBJE the same tag is the media kind) |
| `_MASTER` under SOUR | Ancestral Quest | The source is to appear in the Master listing | `SourceRecord.masterListing` (written back as `_MASTER Y` in both versions) |
| `_QUAL` with `_SOUR`/`_INFO`/`_EVID` under SOUR | MFT7 | The quality of the source / of the information in it / of the evidence | `SourceRecord.quality` (written back as the `_QUAL` block in both versions) |
| `_QUAY` under citations | Family Historian 7 | The citation assessment options (a hex code such as `0x98`), supplementing the standard QUAY | `SourceCitation.assessment` (written back in both versions) |
| `_FIELD` + `TEXT` under citations | Family Historian 7 | Source-template metafield values (`_FIELD TX-PAGE` + `TEXT Page 321`) | `SourceCitation.metafields` (written back in both versions) |
| `_FLGS` + `__TAG` under INDI | Family Historian | Record flags: one `__` child per flag, the tag generated from the flag name, the payload the full name | `IndividualRecord.recordFlags` (written back as the `_FLGS` block in both versions) |
| `_FLGS` + `__PRIVATE`/… under facts | Family Historian 7 | Fact flags: only PRIVATE, PREFERRED, TENTATIVE and REJECTED | `EventDetail.factFlags` (written back as the `_FLGS` block with the canonical names in both versions) |
| `_SHAN` under facts | Family Historian | A fact witness given by name only (the `_SHAR` pointer's name-only sibling) | `EventDetail.witnesses` (written back as `_WITN`) |
| `_EMAIL` / `_WEB` under facts, REPO and SUBM | Family Historian (≤ V6.2) | The fact-level and record-level e-mail / web address — the vendor spelling of the standard EMAIL/WWW slots | `EventDetail.email`/`www`, `RepositoryRecord.email`/`www`, `SubmitterRecord.email`/`www` (standard-first; on 5.5.1 output an event detail with no address block writes `_EMAIL`/`_WEB` back) |
| `_USED` under NAME | Family Historian | The given name used (`2 _USED Tony` under `NAME Anthony Edward /Munro/`) | `PersonalNameStructure.givenNameUsed` (written back in both versions) |
| `_HUSB` / `_WIFE` under INDI.FAMC | Ancestral Quest | The child's status within the family on the father's / mother's side | `ChildFamilyLink.fatherChildStatus` / `motherChildStatus` (written back in both versions) |
| `_BKM` / `_STP` under INDI | MFT7 | The person is bookmarked / is the start person | `IndividualRecord.bookmarked` / `startPerson` (written back as `_BKM Y`/`_STP Y` in both versions) |
| `SIGN` under INDI | USM6 | The person can sign [yes/no] — Heredis writes the person's *signature* (free text) under the same tag, so a payload that is not one of the flag spellings stays a generic extension | `IndividualRecord.canSign` (the wire value is undocumented; 5.5.1 writes the underscore spelling `_SIGN 1`/`_SIGN 0`, 7.0 drops the tag) |
| `BTYP` under BIRT | USM6 | Birth type: 1=single, 2=twin, 3=multiple, 4=died at birth | `BirthEvent.birthType` (5.5.1 writes `_BTYP`; dropped on 7.0) |
| `AGED` under BURI | USM6 | The age at death, a plain number of years (`AGED 80`) | the burial detail's standard `AGE` (standard-first: written back as `AGE`) |
| `MTYP` under INDI.FAMC | USM6 | Parent–child relation kind: 1=marital, 2=non-marital, 3/4=adoption without/with incorporation, 5=unknown, 6=uncertain | `ChildFamilyLink.parentalRelationKind` (5.5.1 writes `_MTYP`; dropped on 7.0) |
| `UTYP` under FAM | USM6 | Family relationship kind: 1=married, 2=married+separated, 3=married+divorced, 4=annulled, 5=non-marital | `FamilyRecord.unionKind` (5.5.1 writes `_UTYP`; dropped on 7.0) |
| `SURE` under NCHI | USM6 | The given child count is certain (`SURE 1`) | `FamilyChildCountAttribute.childCountCertain` / `IndividualChildCountAttribute.childCountCertain` (5.5.1 writes `_SURE 1`/`_SURE 0`; dropped on 7.0) |
| `POTM` under events | USM6 | The event occurred post mortem | `EventDetail.posthumous` (5.5.1 writes `_POTM 1`/`_POTM 0`; dropped on 7.0) |
| `SRCH` under events | USM6 | Where to research the event further | `EventDetail.furtherResearch` (5.5.1 writes `_SRCH`; dropped on 7.0) |
| `NOTRY` under events | USM6 | The notary of the event (marriage contract, will) | `EventDetail.notary` (5.5.1 writes `_NOTRY`; dropped on 7.0) |
| `RINI` under citations | USM6 | Who found the source information | `SourceCitation.foundBy` (5.5.1 writes `_RINI`; dropped on 7.0) |
| `UGNM` under NAME | USM6 | The call name (Rufname) | `PersonalNameStructure.callName` (the same slot `_RUFNAME` carries; written back as `_RUFNAME`) |
| `NAME_` under NAME | USM6 | Surname variants | `PersonalNameStructure.surnameVariants` (5.5.1 writes `_NAME_`; dropped on 7.0) |
| `SECG` under NAME | MFT7 | The second and further given names | `PersonalNameStructure.furtherGivenNames` (5.5.1 writes `_SECG`; dropped on 7.0) |
| `_MHID` under INDI / FAM | MyHeritage | The person's / family's MyHeritage tree identifier (`individual-12345` / `family-555`; observed in MyHeritage exports) | `IndividualRecord.myHeritageId` / `FamilyRecord.myHeritageId` (written back as `_MHID` in both versions) |
| `_SKYPEID` / `_JABBERID` under SUBM | the official FamilySearch maximal70 sample | The submitter's Skype / Jabber identifier — the sample's own SCHMA declares the FOAF URIs (`http://xmlns.com/foaf/0.1/skypeID`, `…/jabberID`; FOAF Vocabulary Specification: <http://xmlns.com/foaf/spec/>) | `SubmitterRecord.skypeId` / `jabberId` (written back in both versions) |
| `_TITL` under HEAD | My Family Tree (Chronoplex) | The title of the tree (observed in real exports) | `Header.title` (written back as `_TITL` in both versions) |
| `_STS` under HEAD | My Family Tree (Chronoplex) | The dataset statistics block: one count line per record type (`2 INDI 179`, `2 _TASK 1`, …; observed in real exports) | `Header.statistics` (written back as the `_STS` block in both versions) |
| `_TREE` under HEAD.SOUR | Ancestry.com | The tree the export came from: the numeric tree id as the payload, with the NOTE and RIN children (webtrees per-vendor custom-tag registry, `Ancestry.php`: <https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php>) | `HeaderSource.tree` (written back as the `_TREE` block in both versions) |
| `_TASK` record | AGES! (GenWiki), My Family Tree (observed) | A task (to-do) record: the description in `_TDSC`, plus `_TTIL` (title), `_TSTS` (status), `_TPTY` (priority), `_TSDT`/`_TRDT`/`_TCDT` (scheduled/reminder/created dates in the vendor's encoded form), `_UID`, `CHAN` | `TodoRecord` (the `_TASK` spelling normalizes into the Legacy `_TODO` record; written back as `_TODO` with the `_TDSC` description as the payload and the extras as their tags) |
| `_EVDEF` record | RootsMagic; the GEDCOM 5.5.5 draft (the event definition record) | The event/fact definition: the defined event tag as the payload, `TYPE` (kind code), `TITL`, `ABBR`, `SENT` (the sentence template), `ROLE` blocks with their own `SENT`, and the `PLAC Y`/`DATE Y`/`DESC N` field flags | `EventDefinitionRecord` (the `_EVDEF` spelling normalizes into the Legacy `_EVENT_DEFN` record; `PLAC`/`DATE`/`DESC` map into `placeType`/`dateType`/`descriptionFlag`, written back as `_PLACE_TYPE`/`_DATE_TYPE`/`_DESC_FLAG`) |
| `_GRP` record | GEDKeeper | A research group record: a NAME and free-text NOTE children (observed in the GEDKeeper test resources, <https://github.com/Serg-Norseman/GEDKeeper>) | `GroupRecord` (written back as `_GRP` in both versions) |
| `_PLC` record | GEDKeeper | The GEDKeeper place card: `NAME` (the name), `FORM` (the display form), `TYPE` (a numeric place-kind code), `_PLP @parent@` (the parent place), `RIN` (the record id) | `PlaceRecord` (the `_PLC` spelling joins `_PLAC`/`_LOC`/`_PLAC_DEFN`; `FORM` → `PlaceRecord.form`, `RIN` → `automatedRecordId`, `_PLP` → `parents`; the 7.0 emitter writes the card back as a `_LOC` record) |
| `_URL` / `_CONF` / `_ACC` / `FILE` under SOUR | the Hutson family-tree data (self-documented in the file header: "_URL = web address of the source", "_CONF = confidence level (Primary / Secondary / Tentative / Provided)", "_ACC = date the source was accessed", https://github.com/CuriousG102/family-tree); `_URL` matches the webtrees `SOUR:URL` (PhpGedView.php); `FILE` is the obsidian charted-roots attachment form (https://github.com/banisterious/obsidian-charted-roots) | The source's web address, confidence level, access date (ISO-style free text) and directly attached media files | `SourceRecord.url` / `confidence` / `accessDate` / `files` (written back in both versions) |
| `_CONF` / `NAME` / `_QUAL` under citations | the Hutson convention (citation level); RootsMagic 2026 (`NAME` = the import description) and MyHeritage (`NAME` = the profile reference); MFT7 (`_QUAL` block) | The citation's confidence level, the name of the cited source, the MFT7 quality block | `SourceCitation.confidence` / `name` / `qualityAssessment` (written back in both versions) |
| `SOUR` under an inline OBJE link / `_CONF` under FAM / `_NOTA` under OBJE | the Hutson data (citations on media links); the family-tree-skill fixture (FAM confidence); Family Historian (`_NOTA` media note, the FHUG "GEDCOM Extension List") | Citations attached to a media link, the family record's confidence level, the media note | `MultimediaLink.citations` / `FamilyRecord.confidence` / `MultimediaRecord.notes` (written back in both versions) |
| `_AMTID` under INDI | RootsMagic | The person's Ancestry Member Tree reference (`tree:family:person` id of the Ancestry sync; observed in real RootsMagic exports) | `IndividualRecord.ancestryMemberTreeId` (written back in both versions) |
| `_SOSADABOVILLE` under INDI | Ancestris | The Sosa–d'Aboville number (`1 G1`: generation + position letter; the Ancestris user guide "Tags" page, https://docs.ancestris.org/books/user-guide/page/tags) | `IndividualRecord.sosaDAboville` (free text, written back in both versions) |
| `_ENV` under HEAD.SOUR._TREE | Ancestry.com (2025 exports) | The Ancestry environment the export came from (`prd`) | `HeaderSource.tree.environment` (written back in both versions) |
| `_OCUR` record + `_OCREF` under INDI | the glamberson gedcom-occurrences extension | An occurrence record: `TYPE`, `DATE`, `PLAC`, `_PART @xref@` participants with `ROLE`/`AGE`/`NOTE`, `SOUR`, `NOTE`; records link to them with `_OCREF @xref@` (https://github.com/glamberson/gedcom-occurrences) | `OccurrenceRecord` + `IndividualRecord.occurrences` (written back in both versions) |
| `PRFX` / `IRI` + `TAG`/`ISA`/`LANG` under SCHMA | the FHISO Extended Legacy Format (ELF) | The ELF extension declarations: `PRFX <tag> <uri>` prefix bindings and `IRI <curie>` entries with the `TAG`, `ISA` and `LANG` children (https://fhiso.org/TR/elf; test files in https://github.com/fhiso/legacy-format) | `Schema.prefixes` / `Schema.elfDefinitions` (written back in both versions) |
| `DATE` under NAME | files in the wild (and the official `warnings70.ged`) | The name's period of use, spelled with the standard tag — the same slot the TMG `_DATE` carries | `PersonalNameStructure.date` (written back as `_DATE` in both versions) |
| `MARR` / `DIV` / `ANUL` / `ENGA` / `MARB` / `MARC` / `MARL` / `MARS` under INDI | game-generated exports (CK3DynastyGenerator) and hand-edited files | A person-level marriage/divorce/engagement event; neither standard has the slot, so they normalize into the standard `EVEN` + `TYPE` (Marriage, Divorce, …), with the event-detail children typing normally | `IndividualRecord.events` as `EVEN` + TYPE (standard-first; written back as `EVEN` + `TYPE` in both versions) |
| `_OID` / `_USER` + `_ENCR` / `_ORIG` / `_ATL` / `_META` / `_CLON` (with `_TID`/`_PID`/`_OID`/`_USER`/`_ENCR`/`_DATE`) under OBJE | Ancestry.com Family Trees | The media-object management block: the object id (a UUID), the creator's user token with the `_ENCR 1` encrypted flag, the origin code (`acom`, `u`, `newspapers`, `fold3`), the Y/N attachment flag, the `<metadataxml>` block, and one `_CLON` block per clone (tree id, person id, object id, user token, clone timestamp). The wire format is undocumented; the shape is taken from Ancestry's own exports (the GEDCOM.NET test tree, https://github.com/JasonRawlins/Gedcom — HEAD.SOUR "Ancestry.com Family Trees"). A bare FILE line (no file name) under the same records is accepted as the empty path so the record survives export | `MultimediaRecord.objectId` / `user`+`userEncrypted` / `origin` / `attachment` / `metadata` / `clones` (AncestryClone) |
| `_MTYPE` / `_STYPE` / `_SIZE` / `_WDTH` / `_HGHT` under OBJE.FILE.FORM | Ancestry.com Family Trees | The media metadata: the display kind (portrait, document, headstone, story, place, …), the stored encoding (jpeg, png, x-inline, pdf, …), the file size in bytes and the picture dimensions in pixels (same source as the block above) | `MediaFormatStructure.kind` / `storageType` / `size` / `width` / `height` (written back under the FORM line in both versions) |
| `_DSCR` / `_MSER` + `_LKID` under OBJE | Ancestry.com Family Trees | The media object's description (the "(Ancestry media: Description)" placeholder included) and the master mark with the link id tying the clones to it (same source as above) | `MultimediaRecord.description` / `master`+`masterLinkId` |
| `RIN` under events | Ancestry.com Family Trees | The record-level RIN (GEDCOM 5.5.1 §2 AUTOMATED_RECORD_ID) repeated under the record's BIRT/DEAT/MARR/BURI… events — the same value, the same meaning (the findmypast gedcom-samples Queen.ged, HEAD.SOUR "Ancestry.com Family Trees") | `EventDetail.automatedRecordId` (written back as `RIN` under the event in 5.5.1; dropped on 7.0, like the record-level RIN) |
| `_FIL` under INDI | Heredis | The person's filiation — their child status relative to the recorded parents: LEGITIMATE_CHILD, NATURAL_CHILD, ADOPTED_CHILD, RELATIONSHIP_UNKNOW (observed in Heredis exports; kept verbatim) | `IndividualRecord.filiation` (written back as `_FIL` in both versions) |
| `_UST` under FAM | Heredis | The union status of the couple: MARRIED, DIVORCED, SEPARATED, COMMON_LAW, COHABITATION, ENGAGEMENT, UNKNOWN (observed in Heredis exports; kept verbatim) | `FamilyRecord.unionStatus` (written back as `_UST` in both versions) |
| `WWW` under HEAD.SOUR | Family Echo and other exporters | The web address of the source product (`2 WWW http://www.familyecho.com/`) | `HeaderSource.www` (written back as `WWW` under the SOUR line in both versions) |
| `REFN` / `WWW` under a citation (and `WWW` under its DATA) | exports in the wild (the Ancestry-import sample, the Archivist fixtures, GEDBAS) | A reference number of the citation itself and the web address of the cited material, written beside or under DATA | `SourceCitation.referenceNumber` / `www` and `SourceCitationData.www` (written back as `REFN`/`WWW` in both versions) |
| `_CROP` with `_LEFT`/`_TOP`/`_WDTH`/`_HGHT` under an inline OBJE link | Ancestry.com Family Trees | The crop rectangle (offset plus size) — the same slots the standard 7.0 CROP carries | `MultimediaLink.crop` (7.0 writes the standard CROP block; 5.5.1 writes the `_CROP` spelling) |
| `_MTTAG` / `_MTCAT` records + `1 _MTTAG @T…@` under INDI | MyHeritage | The tree tags (user-defined labels: "DNA Match", …) with NAME, RIN, the `_VISI` visible flag and the category pointer; the categories carry NAME and RIN; the individuals link their tags | `TreeTagRecord` / `TreeCategoryRecord` + `IndividualRecord.treeTags` (written back as the `_MTTAG`/`_MTCAT` records and links in both versions) |
| `QUAY` directly under an event | Brother's Keeper | The event's own reliability assessment (`2 QUAY 2` under BIRT/DEAT/MARR; the gedcom-go broskeep fixture, the GEDKeeper US-presidents sample) — the standard 5.5.1 tag in the event-level position | `EventDetail.quality` (written back as `QUAY` under the event in 5.5.1; dropped on 7.0, which has no QUAY) |
| `_PREF Y` under FAM / FAM.MARR | Legacy | The preferred family / the preferred marriage — the FAM/MARR positions of the same "_PREF = Indicates a Preferred spouse, child or parents" tag typed under HUSB/WIFE/CHIL | `FamilyRecord.preferred` / `FamilyEventBase.preferred` (written back as `_PREF Y` in both versions) |
| `_WPID` / `_HPID` under a marriage citation | MyHeritage | The wife's / husband's person id (`1,61370::465131`, the Ancestry-style id with the MyHeritage `1,` prefix) | `SourceCitation.wifePersonId` / `husbandPersonId` (written back as `_WPID`/`_HPID` in both versions) |
| `_FOOT` under a citation | exports in the wild | The footnote text of the citation (free text) | `SourceCitation.footnote` (written back as `_FOOT` in both versions) |
| `PAGE` / `REFN` / `WWW` / `_WPID` / `_HPID` / `_FOOT` under a free-text SOUR | files in the wild | The 5.5.1 SOURCE_DESCRIPTION form keeps the full citation grammar beneath the description text (GEDCOM 5.5.1 §2 p.39) — the same slots the pointer form carries | the pointer-form slots of `SourceCitation` (page, referenceNumber, www, wifePersonId, husbandPersonId, footnote) |
| `_APID` under SOUR records and INDI records | Ancestry tree downloads | The record-level Ancestry reference (`1 _APID 1,1030::0`), the same tag and value shape the citations carry | `SourceRecord.ancestryPointers` / `IndividualRecord.ancestryPointers` (written back as `_APID` in both versions) |
| `SOUR` under FONE/ROMN | (standard 5.5.1) | The NAME_PHONETIC_VARIATION / NAME_ROMANIZED_VARIATION citations and notes (GEDCOM 5.5.1 §2 p.55–56) | `PhoneticNameVariation.citations`/`notes`, `RomanizedNameVariation.citations`/`notes` (written back under FONE/ROMN in 5.5.1) |
| `SOUR` under the inline OBJE link | the Hutson family-tree data | A citation attached to the 5.5.1 inline media link; it lands on the synthesized multimedia record (like the link's NOTE) | `MultimediaRecord.citations` |
| `_FTSID` under INDI and SOUR + `_PLINK` blocks under INDI.FAMC | the Swarm family-tree packs (HEAD.SOUR "SwarmFamilyTreePacks") | The person's/source's FamilySearch tree id in UUID form, and the profile links to the linked profiles as recorded in the FamilySearch shared tree (`_PLINK @I…@` with `_FTSID`, the lenient PEDI and the backing citations) | `IndividualRecord.familyTreeSystemId` / `SourceRecord.familyTreeSystemId` / `ChildFamilyLink.profileLinks` (ProfileLink) |
| `TIME` beside the event DATE | Pro-Gen | The event time written next to DATE (the standard slot is DATE.TIME); attaches to the DATE's time when the DATE has parsed, stays a generic extension otherwise (or when the value is not a valid time) | `DateStructure.time` under the event (written back as DATE.TIME in both versions) |
| `_PRIM Y` under events and under NAME | Legacy | The primary event of its kind / the primary name — the `_PRIM` spellings of the same marks `_PRI` and `_PREF` carry | `EventDetail.primary` (written back as `_PRI`) / `PersonalNameStructure.primary` (written back as `_PRIM Y`) |
| `QUOT` under INDI / FAM | novel and game character trees | The person's / family's quotation | INDI: FACT + TYPE "Quotation"; FAM: an inline NOTE (the FAM.FACT structure is 7.0-only and would be dropped on 5.5.1 export) |
| `ADDR` directly under INDI | PAF and other exporters | The person's contact address without an event wrapper (the `_NAME` label and the ADR1–CTRY/contacts grammar type with it) | `IndividualRecord.address` (written back as the ADDR block in 5.5.1; dropped on 7.0) |
| `REF` under a citation | findmypast | The citation's web address (the findmypast record URL) — the `REF` spelling of the `WWW` slot | `SourceCitation.www` (written back as `WWW`) |
| `_GCID` under INDI and FAM | GEDitCOM II | The record's GEDitCOM id (a UUID, HEAD.SOUR "GEDitCOM II") | `IndividualRecord.geditcomId` / `FamilyRecord.geditcomId` (written back as `_GCID` in both versions) |
| `_WEBTAG` under SOUR records | RootsMagic | An external web link attached to the source record (NAME + URL) | `SourceRecord.webTags` (written back as the `_WEBTAG` block in both versions) |
| `QUOT` under CHIL and ASSO links | novel and game character trees | A quotation attached to the child/association link | an inline NOTE on the link (`FamilyChildLink.notes` / `AssociationStructure.notes`) |
| `_GCID` under NOTE, `_PLAC` and SUBM records | GEDitCOM II | The record's GEDitCOM id on the remaining record kinds | `NoteRecord.geditcomId` / `PlaceRecord.geditcomId` / `SubmitterRecord.geditcomId` |
| `CHAN` under events | exporters in the wild | The change date attached to the event itself (DATE + TIME + `_WT_USER`) | `EventDetail.changeDate` (written back as the CHAN block in both versions) |
| `CREA` under events | exporters in the wild | The structured creation date attached to the event (the standard-tag twin of the `_CREA` free text) | `EventDetail.creationDate` (written back as the CREA block in 7.0; dropped on 5.5.1) |
| `_CUTOUT Y` / `_PRIM_CUTOUT Y` / `_PARENTPHOTO Y` / `_PERSONALPHOTO Y` / `_PARENTRIN` under the media link | MyHeritage | The media display flags (cutout, primary cutout, parent photo, personal photo) and the parent's record id (`MH:P…`) | `MultimediaRecord.cutout` / `primaryCutout` / `parentPhoto` / `personalPhoto` / `parentRecordId` |
| `AUTH` under the OBJE record | ged4web exports | The media object's author (the standard AUTH tag in the media position) | `MultimediaRecord.author` |
| `TITL` under the OBJE record | ged4web and the Dutch-royal exports | The media object's title at the record level (the FILE-level TITL is `MediaFile.title`; the Généatique embedded shape is dropped by the projections either way) | `MultimediaRecord.title` |
| `_PID` under PLAC | the Swarm family-tree packs | The place's id in the exporting system (`curie-joliot-place-q102317`) | `PlaceStructure.placeId` |
| `RIN` under a citation | MyHeritage | The citation's record id in the source system (`MH:SC…`) — the citation-level repetition of the record-level RIN | `SourceCitation.automatedRecordId` (written back as `RIN` in 5.5.1; dropped on 7.0) |
| `_MIDN` under NAME | ged4web exports | The middle name written as its own line under NAME | `PersonalNameStructure.middleName` |
| `_TYPE` under the crop block | Ancestry-family exports | The crop variant (`primary`) | `CropStructure.type` |
| `_FNA` under events | Heredis | The Heredis event flag (Y/N, YES/NO; the vendor does not document the meaning — the webtrees registry lists `INDI:*:_FNA` as "???") | `EventDetail.fna` (written back as `_FNA Y`/`_FNA N`) |
| `_CRE` under INDI/FAM/OBJE/NAME/NOTE/SOUR (and `CREA` under NAME) | MFT7 | The structured record creation: a bare line with the DATE (and TIME) child — the `_CREA`/`_CREAT` free-text twin | the record's `creationDate` / `PersonalNameStructure.creationDate` (written back as CREA in 7.0 and `_CRE` in 5.5.1) |
| `SLGC` under FAM and under FAM.CHIL | exports in the wild (the George Washington family trees) | The child's LDS sealing to the parents, written under the family record or the child link instead of the child's INDI | `FamilyRecord.childSealings` / `FamilyChildLink.sealings` (ChildSealingOrdinance) |
| `APPT` under INDI | the GSMD Mayflower Society trees | A (supplemental) membership application, with the DATE and the "Supplemental - …" PLAC | `EVEN` + TYPE "Application" |
| `_PLACE` as the name child of a `_PLC` record | GEDKeeper (the Windsor dialect) | The place name spelled `_PLACE` instead of NAME | the same `PlaceRecord.names` entry the NAME child carries |
| `RELATION` under FAM | GenoPro | The kind of the union (Marriage, Divorce, CommittedRelationship, SeparationLegal, Widowed, …) | `FamilyRecord.unionStatus` (the same slot Heredis' `_UST` carries; written back as `_UST`) |
| `ISDEAD Y/N` under INDI | GenoPro | The person's vital flag — dead without a DEAT event | `IndividualRecord.deceased` (written back as `ISDEAD Y`/`ISDEAD N`) |
| `_XREF @place@` under PLAC | GenoPro | A pointer to the place's card record — the `_XREF` spelling of the `_LOC` place link | `PlaceStructure.placeCard` |
| `_PHOTO @M…@` under INDI | MyHeritage | A pointer to the person's photo record | `IndividualRecord.media` (the standard media link) |
| `PHON` under INDI | PAF and the ged4web exports | The individual's phone number directly under the record | `IndividualRecord.phone` (written back as `PHON`) |
| `_PATN` under NAME | Russian/Ukrainian trees | The patronymic, written as its own line under NAME | `PersonalNameStructure.patronymic` |
| `_TEXT`/`TEXT` under the OBJE record | ged4web exports | The media object's comment text — the same slot the FH `_NOTE` carries | `MultimediaRecord.mediaNote` (written back as `_NOTE`) |
| `_WLNK` under INDI | Ancestry-family exports | A web-link block: the TITL description and the NOTE payload carrying the URL | `IndividualRecord.webLinks` (WebLinkStructure) |
| `_COR` under events | MFT7 | The event's coordinates, written with the DMS block directly under the event (beside or instead of a PLAC) | `EventDetail.map` (written back as the standard MAP/LATI/LONG) |
| `_COR` under the place card | MFT7 | The place card's coordinates at the record level | `PlaceRecord.map` |
| `_TEXT` under the FILE line | FTM | The file's transcription text (the embedded-media shape) | `MediaFile.text` (written back as `_TEXT` under the FILE line) |
| `FAX` under INDI | PAF | The individual's fax number directly under the record | `IndividualRecord.fax` |
| `_DATE`/`DATE` under the FILE line | FTM | The file's modification timestamp (`2 _DATE 5/20/2017 1:51:01 PM`, kept verbatim) | `MediaFile.date` |
| `_APID`/`_ABBR`/`_QUAL`/`_CONF`/`NAME`/`_CREF`/`_SUBQ`/`_VERI` under the free-text SOUR | the citation slots of the description form | The bare-SOUR leniency fills the description form; the citation slots now type there too (same fields as the pointer form) | the pointer-form `SourceCitation` slots |
| `BLOODPURITY` under INDI | the Harry Potter fan trees | The wizard's blood status (Pure-blood / Half-blood / Muggle-born) | FACT + TYPE "Blood purity" |
| `NUMB` under INDI and FAM | the French gedcom-to-xml files | A running number the exporter assigns to the record | `IndividualRecord.sequenceNumber` / `FamilyRecord.sequenceNumber` |
| `DATE` under FAMS | files in the wild | The date of the family link itself | `SpouseFamilyLink.date` |
| `MIDDLE` under NAME | GenoPro trees | The middle name (`2 MIDDLE Thomas`) — the standard-tag spelling of the `_MIDN` slot | `PersonalNameStructure.middleName` |
| `_PGVN` under NAME | ged4web exports | The preferred given name (`2 _PGVN Esther`) — the same slot the FH `_USED` carries | `PersonalNameStructure.givenNameUsed` |
| `_SOSAN` under INDI | Ancestris | The Sosa number with the leading zeros (`1 _SOSAN 00004`) — the same slot `_SOSA` carries | `IndividualRecord.sosaNumber` |
| `_FTSID` under FAM | the Swarm family-tree packs | The family's FamilySearch tree id | `FamilyRecord.familyTreeSystemId` |
| `HOUSE` / `ALLEGIANCE` / `FILMPORTRAYAL` under INDI | the Harry Potter fan trees | The wizard's Hogwarts house, allegiance and film portrayal | FACT + TYPE "House" / "Allegiance" / "Film portrayal" |
| `Occupation` / `Education` / `Contact` / `Marriage` / `Twin` records with the `OCCUPATIONS` / `EDUCATIONS` / `CONTACTS` / `UNIONS` / `TWINS` INDI containers | GenoPro exports (the linguatree family tree and the Harry Potter trees) | The person's facts stored as entity records linked from the INDI: employment (`COMPANY`/`INDUSTRY`/`TITL`/`DURATION`), education (`INSTITUTION`), contacts, marriages and the twinning link (`TWINLINK`/`FAMILY`) — with `PLAC`/`DATESTART`/`DATEEND`/`NOTE`/`SOUR` | `OccupationRecord` / `EducationRecord` / `ContactRecord` / `MarriageRecord` / `TwinRecord` + `IndividualRecord.occupations`/`educations`/`contacts`/`marriages`/`twins` (written back as the same records and links in both versions) |
| `TITL` records with `1 TITL @R…@` pointers under the SOUR record | the Ancestris kennedy sample (`gen-kennedy_kennedy.ged`) | The source bibliography in a separate title record: the payload is the title text, the record carries `CHAN`/`AUTH` (a pointer to the author's INDI or free text)/`PUBL`/`SERS`/`ABBR`/`REPO`/`NUMB`/`CALN` | `TitleRecord` + `SourceRecord.titlRef` (written back as the same records and pointers in both versions) |
| the GEDKeeper long event spellings (`NEWS`/`OBIT`/`REMV`/`ILL`/`EDUS`/`BATM`/`EMPL`) and the gedcom5-conversion Case006 catalog (`BAP`/`BAPT`/`BAPTISM`/`BAR_MITZVAH`/`BAS_MITZVAH`/`BAT_MITZVAH`/`BLESSING`/`BURIAL`/`ADOPTION`/`CENSUS`/`ADULT_CHRISTNG`/`CHRISTENING`/`CONFIRMATION`/`CREMATION`/`EMIGRATION`/`FIRST_COMMUNION`/`GRADUATION`/`IMMIGRATION`/`ORDINATION`/`NATURALIZATION`/`PROBATE`/`RETIREMENT`/`ENLIST`/`RESIDENCE`/`MIL`/`MISE`/`_MIL`/`_MILITARY_SERVICE`/`_MISE`/`_DEGREE`) under INDI | GEDKeeper exports and the FamilySearch gedcom5-conversion test corpus (Case006-PersonsFacts.ged) | The event facts spelled with the long English names instead of the standard tags, with the payload and the `DATE`/`PLAC` children | EVEN + TYPE (the standard event tags in the same positions — `BAPM`/`BARM`/`BASM`/`CENS`/`CHRA`/`CONF`/`CREM` — parse as the standard events they already are) |
| `TEXT` under the WILL event | ged4web exports | The will's transcription under `1 WILL` (`2 TEXT …`) | `WillEvent.texts` (written back as `TEXT` lines under WILL in both versions) |
| `DATE`/`PLAC` under the SOUR record | Canvas Roots exports (the gedcom-sample-medium-sources fixture); the Legacy record-level DATE normalizes into the same slot | The date and place of the source record itself (`1 DATE 1910`, `1 PLAC Illinois` under `0 @S1@ SOUR`) | `SourceRecord.date` / `SourceRecord.place` (written back as `DATE`/`PLAC` in both versions) |
| `SOUR` under an event's `DATE` or `PLAC` | TMG (the Hawaiian Kings trees: `1 DEAT` / `2 DATE 1794` / `3 SOUR @S307@`) | The citations attached to the date/place line itself | `DateStructure.citations` / `PlaceStructure.citations` (written back as `SOUR` lines under the DATE/PLAC line) |
| `SOUR` under CHAN | the David England GEDs (LydiaHargrove.ged: `1 CHAN` / `2 SOUR @S03712@` / `3 DATA` / `4 TEXT Date of Import…`) | The citation of the change itself | `ChangeDate.citations` (written back as `SOUR` lines under the CHAN line) |
| `NOTE` under ADDR | the standard 5.5.1 ADDRESS_STRUCTURE slot (REPO.ADDR.NOTE in the RM11 family histories; BURI.ADDR.NOTE in the Allmon trees) | Notes inside the address block | `AddressStructure.notes` (written back as `NOTE` under ADDR in both versions) |
| `DATE`/`PLAC` under an inline NOTE | TMG (the Hawaiian Kings trees: `1 NOTE …` / `2 DATE 1736` / `2 PLAC …`) | The date and place of the note itself | `Note.date` / `Note.place` (written back as `DATE`/`PLAC` under the NOTE line) |
| `ALIA` (with `SOUR`) and `TITL` under NAME | TMG (the Hawaiian Kings trees: `2 ALIA William/Pitt/` / `3 SOUR @S111@`, `2 TITL Queen`) | A name alias written with the standard ALIA spelling and its citations; a title carried by the name | `PersonalNameStructure.aliasLinks` (AliasTextLink) / `PersonalNameStructure.title` |
| `PLAC`/`DATE` under the inline OBJE link | WikiTree-style exports (`1 OBJE` / `2 FILE …` / `2 PLAC AL.` / `2 DATE 1850`) | The place and date of the media object under the inline link — the same slots the record-level `PLAC`/`DATE` carry | `MultimediaRecord.place` / `MultimediaRecord.date` (written back as `_PLAC`/`_DATE`) |
| `NAME` under HEAD.SUBM | Family Echo exports | The submitter's contact (an e-mail) as the NAME child of the SUBM pointer | `Header.submitterName` (written back as `NAME` under the SUBM line in both versions) |
| `_DESCRIPTION` under an event | MyHeritage | The event's description-aware flag (the same flag the header's `_DESCRIPTION_AWARE` declares file-wide) | `EventDetail.descriptionAware` (written back as `_DESCRIPTION Y`/`_DESCRIPTION N`) |

### Leniencies of the error sweep

- **The bare-line retry.** A line whose required payload is absent —
  or a pointer in a text slot (`1 TITL @R5@`) — is retried with the
  value coerced to text: the line is kept with an empty payload (or
  the pointer string) and its substructures survive; pointer slots
  with no value are dropped. **The repair is a resolution, not an
  error:** when the retry succeeds nothing is recorded (the tolerant
  diagnostics carry only the unresolved drops — pointer slots with no
  value, lines whose retry fails too). The strict parser applies the
  same repair silently.
- **The stray-value retry.** A line carrying a stray value (`1 SEX M
  extra`) parses without it; like the bare-line retry, a successful
  repair records nothing, and only a failing retry (e.g. `1 ANCE ten`
  whose rule requires digits) surfaces the error.
- **A text alias in the ALIA pointer slot.** `1 ALIA /Becky/` — an
  "also known as" name written where the standard expects a pointer to
  another INDI (BURNETT.GED, GRAY, the norse-gods trees) — is kept as
  a NAME with the AKA type (the standard-first normalization of the
  legacy AKA rule); written back as `1 NAME …` + `2 TYPE AKA`.
- **Pointer comments.** A pointer with a trailing comment — `2 FAMC
  @F4@ /* note */` and the line-comment spelling `1 WIFE @I9@ //
  Assuming Unknown_spouse` (the gprime imp-sample files) — parses as
  the pointer; the comment is dropped (it annotates the link, and no
  model slot carries it). A pointer with a trailing blank or a bare
  US escape artifact (`1 FAMC @F2@ `, `1 SUBM @<US20>I1@`) parses as
  the trimmed token.
- **Pointer lists in the GenoPro containers.** `1 OCCUPATIONS
  @occu00012@, @occu00063@` — the comma-separated pointer list of the
  GenoPro entity containers — is split and every pointer resolves
  (a dangling member drops the whole line silently, like any
  dangling pointer); written back as separate container lines.
- **The dangling-pointer drop.** A pointer whose target record is not
  in the document (`1 FAMS @F9@` without a `0 @F9@ FAM`, the
  MyHeritage source ids of the split-off part of an export) is
  dropped silently: the link carries nothing without its target, so
  it is neither imported nor recorded as an error (the
  `document.xref-not-found` error is gone). A US escape artifact
  inside an xref (`0 @<US01>I1@ INDI`) is stripped like the
  pointer-side artifact, so the record and its pointers name the
  same identifier.
- **Bare lines inside direct-iteration parsers.** The `_EVENT_DEFN`
  record and the MAP/`_COR` coordinate blocks iterate their children
  directly (no dispatch retry); a bare member line — an empty
  `_SEN1`/`ABBR` sentence or flag, an empty `LATI`/`_LAS`/`_LOS`
  coordinate — carries no data: the text slot keeps the empty value
  and a coordinate-less MAP/`_COR` block is dropped, silently.
- **The not-GEDCOM detection.** A document with content but without a
  single level-0 line is not GEDCOM at all (REXX scripts, ASCII-art
  design documents, VHDL sources and HTML pages under `.ged`/`.gdz`
  names); it fails once with `document.not-gedcom` — one clear error
  instead of the per-line `line.bad-level` cascade.
- **The ANSEL windows-1251 fallback.** An ANSEL-declared document
  whose lines mostly fail the ANSEL set is actually windows-1251 —
  the Agelong Tree export dialect (the GenWiki "GEDCOM/_Nutzerdef-Tag"
  article documents the exporter writing windows-1251 while declaring
  CHAR ANSEL). The whole document decodes as CP1251, silently; a file
  with only a few genuinely undefined ANSEL bytes (a stray byte, the
  TGC551 torture tests) stays below the threshold and keeps its
  `decoding.invalid-ansel` errors.
- **The bare translation and the ISO exact date.** A NOTE.TRAN
  without a MIME/LANG substructure (the maximal70 test files write
  `2 TRAN British English` bare) keeps the translation text alone —
  the payload is the data, the kind declaration is not. The
  ISO-8601 timestamp form of the exact date (`2 DATE
  2022-08-24T12:26:24.532Z`, the geneafinder exports write it as the
  CHAN.DATE value) parses the date part into the DateExact value and
  the time part into the TimeValue (the fraction and the Z survive).
- **The continuation leniencies.** A CONC/CONT line merges into its
  parent's payload even after the parent's other substructures (the
  order rule is serialization pedantry — the model stores the
  payload and the children independently, and the emitter restores
  the order). A wrong-level continuation (`1 NOTE …` + `1 CONT …`,
  the GenMVD/Geni demo exports; `3 TEXT …` + `2 CONC …`, the
  myheritage fixture) continues the preceding text-bearing line —
  the exporters drop one level of indentation, and the immediately
  preceding text line is the only candidate.
- **The line-comment values.** A value that is a line comment
  (`0 @F1@ FAM // Family for Peter's parents`, `1 DEAT // Burial
  information suggests …` — the hand-annotated ged_record samples)
  is dropped: it annotates the line, not the data — the same rule
  the pointer comments follow.
- **The xref in the value position.** An xref on a substructure line
  with no value (`1 @I2@ HUSB`, the backend_family.ged exports write
  the partner and child pointers in the xref position) relocates
  into the value slot, where the tag expects it; the misplaced
  identifier is not registered, so a relocation whose target does
  not exist stays a dangling pointer (dropped silently by the
  resolve rules). An xref on a substructure that also carries a
  value stays `line.xref-on-substructure`.
- **The over-indented continuation.** A CONC/CONT whose enclosing
  level is missing (the exporter indented the continuation one level
  too deep — `2 CONT Main decisive actions:` + `3 CONT - Delivers
  …`, the three-body-problem fan trees) merges into the deepest
  text-bearing NOTE/TEXT line on the stack — the immediately
  preceding text line, nothing further is guessed. A level-skip
  without such an anchor keeps the error.
- **The SUBN placement.** The ordering rule (the SUBN record right
  after the header, GEDCOM 5.5.1 §2 p.23) is serialization pedantry:
  a SUBN anywhere in the stream parses as the submission record (the
  header-adjacent one binds the dataset slot, the others stay
  records — real files place SUBN after the SUBM record). The ORDI
  payload accepts the abbreviated Y/N spellings beside yes/no.
- **The xref repairs.** Non-ASCII characters in an xref are accepted
  (the 7.0 grammar allows them and the wild writes them: `0 @家族1@
  FAM`, `0 @شجرة عائلة@ INDI` — the unicode_xref-nonlatin fixture and
  the kahatTree exports); an empty identifier (`0 @@ OBJE`) leaves
  the record without an xref; an unterminated xref (`0 @I1 SUBM`)
  is closed at the next blank.
- **The banned-control sanitization.** The C0 controls of a line
  *value* (the tab aside) are sanitized rather than rejected: the
  vertical tab (U+000B) is a line break in the wild — the exporters
  write it inside note text where CONT belongs (`Subj: …\vDate:
  …\vFrom: …`, the LydiaSHargrove and webprowett notes) — and becomes
  the newline; the remaining controls (DEL, the stray DC4 of the
  willis-ansel sample) are dropped and the line survives, silently. A
  control character inside a cross-reference identifier stays
  `line.banned-char` — the identifier itself is broken.
- **The unleveled-continuation merge.** An unleveled line *inside* an
  otherwise valid GEDCOM file merges into the payload of the
  NOTE/TEXT line it directly follows, as a newline continuation —
  human-edited files drop the CONT prefixes (the Gedcom4Sharp
  Sopranos fixture, the ancestry-quirks fixture, the MyHeritage
  Hebrew bios under the citation `4 TEXT`). A numbered-list marker
  (`1. Jaume I`, the myheritage sample notes) is free text too: no
  valid GEDCOM line starts with digits and a dot. The CONC/CONT
  chain case is covered because a merged continuation leaves its
  parent on the stack. A blank line ends the run (the
  ancestry-quirks "after a blank line" line stays an error), a
  pointer-valued note cannot take text, and any other anchor — a
  name, a pointer line, the file start, post-TRLR prose, markdown
  fences — keeps the `line.bad-level`/`line.bad-tag` error: those
  lines have no principled home, and the nothing-is-guessed policy
  forbids attaching them to a neighbouring structure.
- **The medium leniency.** A value outside the MEDI enum (`TYPE
  image`, `TYPE story`, `MEDI Article`, `MEDI "Document agrafé"`)
  becomes OTHER with the phrase; 5.5.1 writes the phrase back as the
  TYPE value.
- **The sex leniency.** The long spellings Male/MALE/Female/FEMALE
  normalize into the standard M/F letters.
- **The enum leniencies of the remainder sweep.** The 5.5.1 LDS
  ordinance statuses CLEARED and QUALIFIED (dropped from the 7.0
  enumset) are kept verbatim; the `RESN` parts spelled `none` (any
  case) are filtered before the enum validation, so `RESN NONE,
  LOCKED` keeps LOCKED; the GEDKeeper numeric direction marker of the
  MFT `_COR` block (`_LON 1`, the gedcomimport_samples) defaults like
  an absent direction (the DMS numbers are the data, the marker is
  not); and the GEDKeeper `_CONF_FLAG 1`/`0` spells the Y/N flag.
- **The quality leniency.** The non-standard `QUAY 4` (GEDBAS) is
  accepted as a fourth assessment level.
- **Bare numeric pointers.** The Geni bare-identifier rule extends to
  digit ids (`1 CHIL 0517745826` wraps into `@0517745826@`).

### Container leniencies of the 2026-11 sweep

- **The HEAD may appear anywhere in the record stream.** Files in the
  wild start with a NOTE or straight into records, with the real HEAD
  following; the first HEAD node is parsed as the header wherever it
  sits (a duplicate HEAD block mid-stream — the FamilyEcho CS555
  exercise files repeat the header per section — is skipped: its
  content is the already-parsed header's). The charset detector scans
  the same way (a leading level-0 record does not stop the scan).
- **Any GEDCOM 5.x version is accepted** (the superseded drafts 5.3
  and 5.4 and the odd patch levels 5.50/5.01 included): the declared
  value never selects a grammar, and the 5.x record grammar is close
  enough to 5.5.1 that rejecting the file would lose the whole
  document. Only 3.0/4.0 are still rejected.
- **A missing space after the level or xref** (`1GEDC`, `0 @I1@INDI`)
  is tolerated like the leading-zero leniency: the tag starts right
  after the digits/identifier.

### Visual and application-state tags (deliberately not typed)

A small set of vendor tags describes how the vendor's UI draws the
data — diagram coordinates, node colors, encoded view state — rather
than genealogical content. These are **not typed into the model**
(deliberate decision): a Dóru tree has no use for another program's
canvas layout, and the values are meaningless outside the writing
program. On input they are accepted and kept verbatim as generic
extensions (the documents still import); on export they are dropped in
both versions, like every generic extension. The corpus run
(`scripts/gedcom-corpus.test.ts`) reports them as remaining in the
generic pile — that is expected for this set.

| Tag | Vendor | Meaning | Source |
| --- | --- | --- | --- |
| `_XY` | Gedcom-XY-Editor (cmosher01) | The x/y coordinates of a diagram node, a bare payload pair like `_XY 100,200` on the record | observed in the Gedcom-XY-Editor test files: <https://github.com/cmosher01/Gedcom-XY-Editor> |
| `_COLOR` | Yet Another Genealogy Program (YAGP) | The fill color of the diagram node | observed in YAGP sample exports (GenWiki's catalog lists the tag name only, no meaning) |
| `_DATI` | My Family Tree (Chronoplex) | An encoded status string the program writes under events and attributes (`V02C0000S01091118410000000E01000000000000000T`): internal view/flags state, not user data | observed in My Family Tree exports; the encoding is undocumented |
| `_NSTY` | My Family Tree (Chronoplex) | A display-style flag under the INDI-level NOTE (`_NSTY Y`): how the note is shown, not its content | observed in My Family Tree exports |

The official FamilySearch extension demo tags of `extensions.ged`
(`_LOC` without NAME, `_PARTY`, `_RECORD`, `_IN`, `_EXT1`, `_CREATOR`,
`_PHRASE` and their `DATE`/`NAME`/`SUBM` children) likewise stay
generic by design — see the "Undocumented extension records stay
generic" decision in chapter 4.

### Single-file internal formats (deliberately not typed)

A few tags belong to one program's internal block format and occur in
exactly one corpus file each — typing them would model a private wire
format with no second producer. They stay generic extensions
(preserved verbatim on input, dropped on export like every generic
extension); the corpus runner reports them as remaining in the pile,
which is expected:

| Tag | File / vendor | Meaning |
| --- | --- | --- |
| `_STE`, `_STF`, `_ACT`, `_ORD`, `_LCS`, `_SCS`, `_FOM` (and the `_PTE`/`_PTF`/`_VCS`/`_NCS` variant) | Synium MacFamilyTree exports (6 corpus copies of the same format: Nushi-Genealogy.ged, Hilligsoe.ged, the Franz Schubert export pair, the spindler sample, the Sidam31 test file — HEAD.SOUR "SyniumFamilyTree") | nested statement/fact blocks of one private export format (thousands of occurrences each — the files' whole structure) |
| `PEDIGREELINK` records with `FAMILY`/`INDIVIDUAL`/`POSITION`/`DISPLAY`/`BOUNDARYRECT` children | GenoPro exports (the linguatree family tree, HEAD.SOUR "GenoPro") | the tree-layout record of the program: pedigree display positions, boundary rectangles and display options — pure layout state, no genealogical content |
| `LEFT`/`RIGHT`/`TOP`/`BOTTOM`/`FILL`/`SIZE`/`WIDTH`/`HEIGHT`/`ALIGNMENT`/`VERTICAL`/`HORIZONTAL`/`BORDER`/`COLOR`/`COLORS`/`OUTLINE`/`POINTS`/`PADDING`/`LINES` | GenoPro exports | the geometry and colors of the layout blocks (the `POSITION`/`DISPLAY` rectangles and labels) — display state |
| `_POSITION <x> <y> <w> <h>` under OBJE, `ZOOM`/`PLEV` under `_PLAC.MAP` | various exporters | the media-object layout coordinates and the map zoom/level — display state |
| `_PPEXCLUDE` under INDI | report-oriented exporters | the "exclude from printed reports" flag — presentation state |
| `_PATRIARCH` under INDI | GEDKeeper | the tree's patriarch (root ancestor) mark — display state |
| the GenoPro display entities (`Label`/`Picture`/`SocialEntity`/`GLOBAL` and the relationship records, with their `POSITION`/`DISPLAY`/`SIZE`/`COLOR` geometry and the `Picture` cache fields `CACHE`/`DIMENSION`/`DPI`/`FILESIZE`/`PATH`/`REPORT`/…) | GenoPro exports (the linguatree and Harry Potter trees) | the display/schema half of the program's entity dialect — geometry, palette and interface state, no genealogical content; the records stay generic (their inner standard tags count as nested-in-generic). The *data* half — the `Occupation`/`Education`/`Contact`/`Marriage`/`Twin` entities with their `OCCUPATIONS`/`EDUCATIONS`/`CONTACTS`/`UNIONS`/`TWINS` INDI links — is typed, see chapter 6 |
| the `_DESCRIPTION Y` flag under an event's NOTE | MyHeritage | marks that particular note as the event's description — the flag sits inside the note block, so it stays nested-in-generic (the event-level flag does type, see `EventDetail.descriptionAware`) |
| `_FS_ID` | a single merge-test fixture | synthetic test data |
| `_GROUP` | a single geotour-genoroots fixture | synthetic test data |
| `NAME_GIVN`, `NAME_SURN`, `BIRT_DATE`, `BIRT_SOUR__QUAL__…`, `DEAT_PLAC_MAP_LATI`, `HEAL_TYPE`, `BURI_SOUR`, `CHR_…` and the rest of the underscore-joined family | `corsier-1680-1840.ged` and its GEDZIP twin (zenodo 10.5281/zenodo.4674521, lucasrappo/corsier-1680-1840 — two corpus entries, one content) | a Heredis export post-processed by a tool that flattened every hierarchy into one underscore-joined level-1 tag: `BIRT.DATE` → `BIRT_DATE`, `BIRT.SOUR._QUAL` → `BIRT_SOUR__QUAL`, `DEAT.PLAC.MAP.LATI` → `DEAT_PLAC_MAP_LATI`. The record skeleton (`0 @I…@ INDI`, `1 NAME`, `1 SEX`, `1 FAMC`) is standard, the substructures are not, and the notes carry RTF. Typing the flattened spellings would model one broken export — they stay generic extensions |
| `CALN` directly under the SOUR record | the GEDCOM.NET test tree copies (Ancestry's GedcomNetTestTree, ~21 corpus copies) | the call number at the source-record level (no GEDCOM version has that position) with synthetic values (`CN 123`) — test-fixture data of one file family, kept generic |

**Brother's Keeper family** (BKW6, Legacy cat.): name variants(`_BIRN` → `NAME` `TYPE BIRTH`; `_ADPN`/`_CENN`/`_CURN`/`_FARN`/`_FKAN`/
`_GERN`/`_HEBN`/`_INDN`/`_OTHN`/`_RELN`/`_SHON`/`_SLDN` → `NAME` `TYPE
OTHER` with a PHRASE label; `_AKAN`/`_MARN` are in the table above);
physical descriptors (`_EYEC`/`_HAIR`/`_HEIG`/`_WEIG` → `FACT` + TYPE);
ceremonies (`_BRTM`/`_FNRL`/`_INTE`/`_YART` → `EVEN` + TYPE);
marriage-related (`_COML` → `MARR` + TYPE, `_MBON`/`_SEPR` → FAM `EVEN`
+ TYPE); `_PRMN` → the `REFN` identifier. The negatives `_NLIV` and
`_NMAR`/`_NMR` become bare `NO DEAT` / `NO MARR`; on the 5.5.1 export a
bare `NO MARR`/`NO DEAT` on an individual is written back as
`_NMAR`/`_NLIV`, while 7.0 writes the standard `NO` (the exception to
the NO rule is documented in the README's "Vendor extensions"
section).

**Legacy data tags** (Legacy cat. "Custom GEDCOM Tags"): `_STAT` under
CHIL → `FamilyChildLink.multiplicity` (free text: the vendor writes
"Twin, Triplet, etc."); the `_TODO` record with `_CAT`/`_CDATE`/
`_LOCL`/`_RDATE` → `TodoRecord` (the INDI/FAM `_TODO` structure of
GenoPro/RootsMagic/Ahnenblatt is typed separately as `TodoStructure`,
see the table above); `_TAG`/`_TAG2`–`_TAG9` →
`IndividualRecord.marks` (slots kept, gaps stay empty); `_SOUND` →
`MultimediaRecord.soundFile`; `_NAME` under ADDR is in the table above.
The report machinery follows.

**Legacy report machinery** (Legacy cat. "Custom GEDCOM Tags"): the
print styles `_ITALIC`/`_PAREN`/`_QUOTED` under SOUR →
`SourceRecord.titleItalic`/`publicationParenthesized`/`titleQuoted`
(both the `Y` and `YES` value spellings are accepted, plus the bare
tag; written back as `_ITALIC Y`/`_PAREN Y`/`_QUOTED Y` in both
versions); the address groupings `_LIST1`–`_LIST6` (Newsletter, Family
Association, Birthday, Research, Christmas, Holiday) →
`AddressStructure.newsletterList` … `holidayList` (written back as
`_LIST1 YES` … `_LIST6 YES`); `_SORT` under ADDR →
`AddressStructure.sortName` (the report sort spelling of the
addressee's name); `_OVER` under events → `EventDetail.sentence`
(Legacy's spelling of the event-sentence slot RootsMagic calls
`_SENT`; written back as `_SENT`). The `_EVENT_DEFN` record is typed
(see chapter 6, `EventDefinitionRecord`) — the `_SEN1`–`_SEN8`/
`_SENM`/`_SENF`/`_SENU` sentence definitions, the
`_CONF_FLAG`/`_DATE_TYPE`/`_DESC_FLAG`/`_PLACE_TYPE`/`_PP_EXCLUDE`
definition flags and the PAF5 sentence set. The SOUR-position report
flags `_TAG`/`_TAG2`–`_TAG4` (`_TAG NO`, `_TAG2 NO`, `_TAG3 YES`,
`_TAG4 YES` — exclude the citation detail / the citation itself /
include the detail text / the detail notes) are typed as
`SourceRecord.citationDetailIncluded` and siblings (chapter 6). Still
deferred: the address/place "tagged" marking of the same tags — the
same tag names mean different things per position, and only the
SOUR-position meaning is documented.
Decision on `_CONF_FLAG`: it marks the event *type* as
confidential in the vendor's configuration (and the mechanism that links
a definition to its event type is undocumented — the parser accepts the
event tag in every documented form: the record payload, a standard-tag
child, or a TYPE child), so it is not projected onto individual events;
a UI may interpret the definition itself.

**MyHeritage**: `_UPD` (in the table above); no other documented tags.

**GEDKeeper**: `_UID` and the `_SHAR` family (chapter 5); nothing else
documented.

**GEDCOM-L / GEDCOM 5.5EL — typed**: the `_LOC` record fields
(`_GOV` → `govId`, `_MAIDENHEAD`, `TYPE`+`_GOVTYPE` → `types`,
`_POST` → `postalCodes`, `_AIDN` → `administrativeIds`, `_DMGD` →
`demographicData`, `NAME {1:M}` → `names` (each with its `ABBR {0:M}`
abbreviations + optional `TYPE`, e.g. ISO 3166), `RELI` → `denomination`,
`EVEN` → `events`, `_LOC`+`TYPE POLI|RELI|GEOG|CULT` → `parents`, and
the GEDCOM 5.5EL coordinate MAP (`MAP <coords>` + `TYPE DEGREE|
MAIDENHEAD`, `{0:M}`) → `PlaceRecord.elMaps`);
`_GOV`/`_POST`/`_MAIDENHEAD` and the GenPlus `_AON` (alternative place
name) under event PLACs → `PlaceStructure` fields; `_RUFNAME` (agreement
Ruf.B2) and the 5.5EL `GIVN` + `TYPE RUF` marker → `PersonalNameStructure.
callName` (the EL name splitting — one ordered `GIVN` per given name —
appends into `pieces.givenNames`); `_GODP`/`_WITN` under events and at
the INDI/FAM record level → `EventDetail.godparents`/`witnesses`,
`IndividualRecord.godparents`/`witnesses`, `FamilyRecord.witnesses`
(free text, agreement ASSO A4); the AGES! `_WTN` birth-witness pointer
→ an `ASSO` association with `ROLE WITN` (5.5.1 writes the `_SHAR`/
`_ROLE Witness` pair); the Swiss Bürgerort tags `_BUERGERORT`/`_HEIM`
→ `FACT` + TYPE "Bürgerort" (the import form the agreement PLAC P8
prescribes); the BKW `_ADPF`/`_ADPM` adopted-by flags →
`IndividualRecord.adoptedByFather`/`adoptedByMother`; `_MILI` (military,
the `_MILT` twin) and `_HOL` (Holocaust) → `EVEN`/`FACT` + TYPE; the
FAM `_STAT` statuses with their F7 substructures →
`FamilyRecord.marriageStatuses`; the TODO E1 structure →
`TodoStructure`; the N5 `_SCHEMA` block with `_DEFN` leaves →
`Header.schema53`. On output the
vendor tags are written back in both versions, and a GEDCOM-L card
survives into both outputs as a `_LOC` record with its pointers
(GEDCOM 7.0 §1.5 allows extension records; the hierarchy closes over
the surviving parents). The `_TYPE same-sex` FAM convention is typed
too: `FamilyRecord.sameSexUnion`, validated strictly to the value
`same-sex` and written back in both versions — GEDCOM 7.0 has no
same-sex slot (its FAMILY_RECORD describes HUSB/WIFE as partners and
§1.5.3 sketches a `_PARTNER` extension). The FAM negatives `_MARR N`
(Ahnenblatt) and `_NMR Y` (BKW) normalize into a bare FAM `NO MARR`
(`_MARR` accepts only N, `_NMR` only Y); 5.5.1 writes a bare FAM NO
MARR back as `_MARR N`, 7.0 as the standard `NO MARR`. `_LIV`
(GenPlus/PRO-GEN cohabitation) becomes a FAM `EVEN` with TYPE
"Cohabitation". The `_ASSO @xref@` + RELA participant links
(agreement A3) normalize into the associations model like the Gramps
convention: event-level links are written back in the canonical
`_SHAR`/`_ROLE` form, and the FAM-level link (no standard 5.5.1
slot) as `_ASSO` (7.0 uses the standard ASSO).

Covered by `tests/vendor-extensions*.test.ts` with same-version round
trips.

### The 2026-10 corpus sweep (typed additions)

The catalog cross-check of 2026-10 added the remaining documented tags
to the typed inventory; every field cites its GenWiki/T2G source in
its JSDoc:

| Tag | Vendors | Meaning | Model field |
| --- | --- | --- | --- |
| `_LEBENSORT` | AF2000, Stammbaumdrucker | Lebensort — location of residency | `FACT` + TYPE |
| `_REL` | GES2000 | Kindstand — child status (e.g. `a` = adopted) | `FACT` + TYPE "Child status" |
| `_NCHI` | GES2000 | Running number as child in the family | `FACT` + TYPE "Birth order" |
| `_NOTH` | GES2000 | Heimatort as text | `FACT` + TYPE "Heimatort" |
| `_SURN` | GES2000 | Sippenname — clan name | `names[]` `TYPE OTHER` + PHRASE |
| `_GODT` | GES2000 | Godparents and witnesses as text | `FamilyRecord.witnesses` (written back as the `_WITN` spelling of the same slot) |
| `_NAM` | GES2000 | Married name of the partner under FAM.HUSB/WIFE | `FamilyPartnerLink.name` (written back as `_NAM`) |
| `_ZVST` | GES2000 | Civil status at the time of the marriage | `FamilyPartnerLink.civilStatus` |
| `_NR` | GES2000 | Ordinal number of the marriage | `FamilyPartnerLink.marriageNumber` |
| `_MARRNAME` | Legacy | Married name of the partner following the HUSB/WIFE line | `FamilyPartnerLink.name` |
| `_PRIM` | TMG | Primary-co-participant flag under `_SHAR` | `AssociationStructure.primary` (5.5.1 writes `_PRIM Y`; 7.0 drops) |
| `_INET` + `_MHRM`/`_MHSM`/`_MHAV`/`_RDATE`/`_SDATE` | Ahnenblatt | Internet-search details block (values kept verbatim) | `IndividualRecord.internetSearch` |
| `_ALTPATH` | Ahnenblatt | Alternative/relative path without the file name | `MediaFile.alternatePath` |
| `_HOME` / `_HME` / `_NAVI` + `_NAVM` | Ages!, Ahnenblatt, GEDitCOM | Start person after opening the file; the Navigator mode | `Header.startPerson` / `Header.startPersonMode` |
| `_ALIA` record | GDO | Duplicate-candidate record (`_CPT`, `_INDI`, `_QUAY`, `_STAT`, NOTE, SOUR) | `DuplicateCandidateRecord` |
| `_IMPF` + `PAGE` | GDO | The record's XREF in the imported file + the file id, level 1 of every record | `…Record.importReference` |
| `_SUBM` | GDO | Submitter pointer under every record and citation | the standard `submitters` slot on FAM/INDI, `…Record.submitters` elsewhere, `SourceCitation.submitter` |
| `_URKU` | PC-AHNEN | Evidence of the event is available | `SourceRecord.evidenceAvailable` |
| `_JAG` | GenPlus | Volume year of the source | `SourceRecord.volumeYear` |
| `_KTIT` | GenPlus | Short title of the source | `SourceRecord.abbreviation` (standard ABBR, standard-first) |
| `_COR` + `_LAD`/`_LAM`/`_LAS`/`_LAN`/`_LOD`/`_LOM`/`_LOS`/`_LON` | MFT7 | Place coordinates, DMS per axis | `PlaceStructure.map` (standard MAP/LATI/LONG, standard-first) |
| `_PLACE` record | Family Tree Builder | Master place record, payload = the place name | `PlaceRecord` (payload dialect, like `_PLAC`) |
| `OBJE`/`_OBJE` under NAME | TMG/T2G | Exhibits attached to the name | `PersonalNameStructure.media` (written back as `OBJE`) |
| `AUTH`, `ANCE` under INDI | Reunion | Author / ??? Ancestor (meaning undocumented or format unknown) | generic extensions in any file, dropped on export (no conformant spelling in either target version) |

Covered by `tests/vendor-extensions-p5.test.ts` (import, export, and
round trips in both versions where a spelling exists).

### The 2026-11 coverage sweep (typed additions)

The webtrees-registry audit of 2026-11 closed the remaining documented
gaps and added the underscore write-back spellings for the USM6 tags
(5.5.1 requires user-defined tags to begin with an underscore, so the
5.5.1 output writes `_SIGN`/`_BTYP`/`_MTYP`/`_UTYP`/`_SURE`/`_POTM`/
`_SRCH`/`_NOTRY`/`_RINI`/`_NAME_`/`_SECG` — the non-underscore wire
spellings and the underscore forms are both recognized on input, and
7.0 drops them):

| Tag | Vendors | Meaning | Model field |
| --- | --- | --- | --- |
| `MEDI` under SOUR | Legacy | The media type of the source (webtrees Legacy.php, "Media type") | `SourceRecord.medium` (written back as `_MEDI` in both versions — neither standard has a MEDI slot under the SOUR record) |
| `RFN` under FAM | Pro-Gen | The reference number under the FAM record (webtrees ProGen.php) | the standard `REFN` identifier on `FamilyRecord` |
| `TIME` under BIRT | Pro-Gen | The time of birth, written beside DATE (webtrees ProGen.php, `TimeValue`) | generic extension of the event (the standard slot is DATE.TIME; no typed position exists beside DATE) |
| `_CORR` | FO7 | The correspondence entry with REAS/RESP/RPLY (chapter 7) | `IndividualRecord.correspondence` |
| `_DIVERSES` | AF2000 | A container for assorted data: TITL names the entry, NOTE carries the text | `FACT` with the TITL TYPE and the NOTE payload |
| `_ORGSOUR` under HEAD | (GenWiki table) | The product that originally wrote the data: the foreign SOUR.NAME/SOUR.VERS kept as NAME/VERS | `Header.originalSource` |
| `_PRMN` under FAM | BKW6 | The family's permanent number | the standard `REFN` identifier on `FamilyRecord` |
| `_KEYS` / `_FILE` / `_NOTE` under OBJE | FH | The media keywords / file path / media note (FHUG "GEDCOM Extension List", "Multimedia: _NOTE, _FILE, _DATE, _KEYS") | `MultimediaRecord.keywords` / `filePath` / `mediaNote` |
| `_SEQ` / `_AREA` / `_EXCL` / `_CAPT` under the OBJE link | FH | The media sequence number / display area (kept verbatim) / excluded-from-diagrams flag / caption flag (FHUG, "Multimedia: _ASID, _SEQ, _AREA, _EXCL, _CAPT, _NOTA") | `MultimediaLink.sequence` / `area` / `excludeFromDiagrams` / `caption` |
| `_CREA` under OBJE | Ancestry | The creation date of the media object (webtrees Ancestry.php, "Creation") | `MultimediaRecord.createdAt` |
| `_HEB` under NAME and PLAC | phpGedView | The name/place in Hebrew script (webtrees PhpGedView.php) | `PersonalNameStructure.hebrewName` / `PlaceStructure.hebrewName` |
| `URL` under ADDR | PAF (5.5.5 recommends) | The web address, a synonym of WWW (5.5.5 §2 p.65) | the address `www` slot |
| `POST` / `NAME._LANG` under `_LOC` | GEDCOM 5.5EL (historical) | The postal code / name language under a place record | `PlaceRecord.postalCodes` / `PlaceNameStructure.language` |
| `_ADDENDUM <name>` | GEDCOM-L §7.3 | The addendum declaration's name payload, {0:M} per file | `Gedcom.addenda` |
| `_HTITL` / `_WTITL` / `_RPT_PHRS` / `_RPT_PHRS2` under FAM.MARR | Legacy | The husband's / wife's report labels and the two report phrases (webtrees Legacy.php, "Label for husband", "Label for wife", "Report phrase") | `MarriageEvent.husbandLabel` / `wifeLabel` / `reportPhrases` |
| `_LENGTH` / `_WEIGHT` under BIRT | Aldfaer | The length / weight at birth (webtrees Aldfaer.php) | `EventDetail.birthLength` / `birthWeight` |
| `_ALDFAER_TIME` under BIRT/DEAT | Aldfaer | The time of birth/death (webtrees Aldfaer.php, `TimeValue`); attached to the DATE.TIME slot when a DATE exists, a generic extension otherwise | `DateStructure.time` / the detail's extensions |
| `CEME` under BURI | phpGedView | The cemetery of the burial (webtrees PhpGedView.php, `INDI:BURI:CEME`) | `EventDetail.cemetery` (written back as `_CEME`) |
| `_CREA` / `_CRE` / `_CREAT` under events | Heredis, MFT7, GenPlus | The event creation date (kept free text; GenWiki "Datensatz, Ereignis") | `EventDetail.createdAt` (written back as `_CREAT`) |
| `_PROJECT_GUID` / `_EXPORTED_FROM_SITE_ID` / `_RINS` under HEAD | MyHeritage | The project identifier, the exported-from site id and the per-record-type counts of the export (real MyHeritage exports) | `Header.projectGuid` / `exportedFromSiteId` / `recordCounts` (kept verbatim) |
| `_TIMEZONE` under HEAD.DATE | MyHeritage | The timezone of the export date (real MyHeritage exports) | `Header.timezone` (kept verbatim) |
| `_DESCRIPTION_AWARE Y` under HEAD | MyHeritage | The export includes the description field (real MyHeritage exports) | `Header.descriptionAware` |
| `_RTLSAVE` under HEAD.SOUR | MyHeritage | The right-to-left save mode (real MyHeritage exports, `_RTLSAVE RTL`) | `HeaderSource.rtlSave` (kept verbatim) |
| `_PUBLISH` record | MyHeritage | The site the tree was published to: `_SITEADDRESS`/`_SITENAME`/`_SITEID`/`_USERNAME` + the `_DISABLED` flag (real MyHeritage exports) | `PublishedSiteRecord` |
| `_THUM Y` under the OBJE link | Généatique | The thumbnail flag of the media link (real Généatique exports, `2 _THUM Y` beside `_PRIM`) | `MultimediaLink.thumbnail` |
| `_LINK` under citations | FTM | An internet link associated with the source (the gedcom4j FTM custom-tags sample; GenWiki "Internetlink in Verbindung mit einer Quelle") | `SourceCitation.links` |
| `_FILESIZE` / `_ALBUM` / `_PHOTO_RIN` beside the media FILE | Family Tree Builder, MyHeritage | The file size in bytes, the album XREF (kept verbatim — real exports dangle) and the photo's record id (webtrees FamilyTreeBuilder.php; real MyHeritage exports) | `MediaFile.fileSize` / `album` / `recordId` (written beside the FILE line, the vendor position) |

The tags the code search found no real files for (`_GRUPPE`, `_LFD`,
`_NOPARTNER`, `_ALDFAER_NOREL`, `_SURNAS`, `_DBID`, `_INQU`) and the
ones whose fetched samples did not confirm (`_SCHA`, `_ACT`) stay
generic — the catalogs document meanings, but with no real file to
show the wire form there is nothing to type. Also fixed along the way:
the synthesized inline-OBJE multimedia record now carries its
generated xref, so the 5.5.1 projection no longer strips the pointer
link to it.

The `_EVENT_DEFN` record was also verified against the real Legacy
exports (the gedcom4j "legacycustomtags.ged" sample, now a regression
fixture): the record is always written at level 0 — the webtrees
`HEAD:_EVENT_DEFN` registry key does not correspond to a real-world
position, so the HEAD form stays a generic header extension. The real
record shape is richer than the vendor help describes and is typed now:
the `TYPE` child carries the event kind code (`I`/`F`), `TITL` the
display title, `ROLE` blocks the per-role sentence sets (`_SEN1`–`_SEN8`
+ the `_DEF` default mark), and `_INC_NOTES` the include-notes flag.
Parsing the sample also uncovered real-file deviations the parser now
tolerates: a lone interior `@` in text values (the doubling rule is
enforced only at the start, where the ambiguity lives), a CONC
continuing an empty payload, a bare `_TAG` mark, a citation `DATE`
directly under the SOUR pointer (normalized into `DATA.DATE`), a
record-level SOUR `DATE` (generic), and an inline `OBJE.FORM` beside
`FILE` (injected into the file's FORM).

Also fixed in this sweep: the FAM `_TYPE` handler no longer rejects
values other than `same-sex` (they stay generic extensions — other
programs write relationship kinds there), the payload-less `1 FACT` +
`TYPE Bürgerort` P8 import form parses, the USM6 `SIGN` handler
tolerates the Heredis signature payloads (non-flag values stay generic
extensions instead of failing with `enum.invalid-value`), the 5.5.1
writer emits the DATE.TIME child it previously dropped, and the census
INDI SEX/ROLE parse through the registry's standard structures (SEX via
the version enum, ROLE via the v5.5.1 ROLE_IN_EVENT grammar with the
bare MagiKey descriptors normalized to OTHER + phrase); the MagiKey
`_AGER` range rejects an inverted bound order.

Covered by `tests/audit-fixes.test.ts`.

### The 2026-11 Ancestry media sweep (typed additions)

The generic-pile ranking of the 2026-11 corpus run (the tolerant
parse) put the Ancestry.com Family Trees media block first — the
largest remaining vendor-specific pile, ~140k occurrences across 27
files. This sweep types it, plus the RIN the same exports repeat under
events:

| Tag | Vendors | Meaning | Model field |
| --- | --- | --- | --- |
| `_OID` / `_USER`+`_ENCR` / `_ORIG` / `_ATL` / `_META` / `_CLON` under OBJE | Ancestry.com Family Trees | The media-object management block (object id, creator token + encrypted flag, origin code, attachment flag, metadata XML, per-clone links); the shape is taken from Ancestry's own exports — the GEDCOM.NET test tree (JasonRawlins/Gedcom) | `MultimediaRecord.objectId` / `user`+`userEncrypted` / `origin` / `attachment` / `metadata` / `clones` (AncestryClone; written back as the same tags in both versions) |
| bare `FILE` under OBJE | Ancestry.com Family Trees | The FILE line of those media records carries no file name (FORM/TITL only) | accepted as the empty path (`MediaFile.payload` `''`), so the record keeps its required FILE on export instead of being dropped as the embedded shape |
| `RIN` under events | Ancestry.com Family Trees | The record-level RIN repeated under BIRT/DEAT/MARR/BURI… (the findmypast gedcom-samples Queen.ged) | `EventDetail.automatedRecordId` (written back as `RIN` under the event in 5.5.1; dropped on 7.0) |
| `_MTYPE` / `_STYPE` / `_SIZE` / `_WDTH` / `_HGHT` under OBJE.FILE.FORM | Ancestry.com Family Trees | The media metadata: display kind, stored encoding, file size in bytes, picture dimensions in pixels | `MediaFormatStructure.kind` / `storageType` / `size` / `width` / `height` (written back under the FORM line in both versions) |
| `_DSCR` / `_MSER`+`_LKID` under OBJE | Ancestry.com Family Trees | The media object's description and the master mark with its link id | `MultimediaRecord.description` / `master`+`masterLinkId` |
| `_FIL` under INDI | Heredis | The person's filiation (LEGITIMATE_CHILD / NATURAL_CHILD / ADOPTED_CHILD / RELATIONSHIP_UNKNOW, kept verbatim) | `IndividualRecord.filiation` (written back as `_FIL` in both versions) |

Covered by `tests/vendor-extensions-corpus-typing-3.test.ts`. The
follow-up rounds typed the rest of the pile: `_UST` under FAM (Heredis
union status → `FamilyRecord.unionStatus`), `WWW` under HEAD.SOUR
(Family Echo → `HeaderSource.www`), `REFN`/`WWW` under citations and
`WWW` under the citation DATA (→ `SourceCitation.referenceNumber`/
`www`/`SourceCitationData.www`), the `_CROP` crop block under inline
media links (→ `MultimediaLink.crop`, the same slot the standard 7.0
CROP carries), the MyHeritage `_MTTAG`/`_MTCAT` tree-tag records with
the INDI links (→ `TreeTagRecord`/`TreeCategoryRecord`/
`IndividualRecord.treeTags`), pointers with a trailing C-style comment
(`2 FAMC @4@ /* … */` parses as the pointer, the comment is dropped),
the event-level `QUAY` (Brother's Keeper → `EventDetail.quality`),
`_PREF Y` under FAM and FAM.MARR (Legacy → `FamilyRecord.preferred` /
`FamilyEventBase.preferred`), `_WPID`/`_HPID` under marriage citations
(MyHeritage → `SourceCitation.wifePersonId`/`husbandPersonId`) and
`_FOOT` under citations (→ `SourceCitation.footnote`), the record-level
`_APID` under SOUR and INDI (→ `SourceRecord.ancestryPointers` /
`IndividualRecord.ancestryPointers`), the standard 5.5.1 citations
under FONE/ROMN and the inline OBJE link, and the Swarm family-tree
pack block (`_FTSID` under INDI/SOUR → `familyTreeSystemId`, the
`_PLINK` profile links under INDI.FAMC → `ChildFamilyLink.profileLinks`).
The 2026-11 remainder sweep closed the rest of the working pile: the
Pro-Gen event-level `TIME` (attaches to the event DATE's time), the
Legacy `_PRIM` under events and names, the character-tree `QUOT`
(INDI FACT + TYPE "Quotation" / FAM inline NOTE), the PAF INDI-level
`ADDR` (→ `IndividualRecord.address`), the findmypast `REF` under
citations (→ `SourceCitation.www`), the GEDitCOM `_GCID`
(→ `geditcomId` on INDI and FAM) and the RootsMagic `_WEBTAG` under
SOUR records (→ `SourceRecord.webTags`). The overnight remainder
sweep closed the rest: the `QUOT` positions under CHIL and ASSO
links (→ inline notes), `_GCID` on the remaining record kinds, and
the event-level `CHAN`/`CREA` (→ `EventDetail.changeDate`/
`creationDate`). The final round typed the MyHeritage media flags
(`_CUTOUT`/`_PRIM_CUTOUT`/`_PARENTPHOTO`/`_PERSONALPHOTO`/
`_PARENTRIN` → `MultimediaRecord`), the ged4web `AUTH` under OBJE and
`_MIDN` under NAME, the swarm `_PID` under PLAC (→
`PlaceStructure.placeId`) and the MyHeritage `RIN` under citations
(→ `SourceCitation.automatedRecordId`).
Left in the pile deliberately: the loose `REFN` positions on other
structures, the `_ATTC`/`_PART` swarm blocks (a dozen occurrences),
the GenoPro layout dialect, the media/map display state
(`_POSITION`, `ZOOM`/`PLEV`), and the tags of single-file formats.

### The 2026-11 remainder sweep II (typed additions)

The final ranking of the tolerant corpus run (3002 files, ~62k
generic occurrences left after the earlier sweeps) put the remaining
*data* clusters — the tags that carry genealogical content inside
standard positions that no GEDCOM version defines — first. This sweep
types them; the leftovers are the deliberately-generic layout
families of chapters 6–7 (MacFamilyTree ~30k, GenoPro display
entities and layout, `_DATI`/`_FOM`, the map display state) and
singletons nested inside generic records:

| Tag / position | Vendors | Meaning | Model field |
| --- | --- | --- | --- |
| `NOTE` under ADDR | the standard 5.5.1 ADDRESS_STRUCTURE slot, used by the RM11 family histories (REPO.ADDR.NOTE) and the Allmon trees (BURI.ADDR.NOTE) | Notes inside the address block | `AddressStructure.notes` |
| `SOUR` under CHAN (with `DATA`/`TEXT`) | the David England GEDs (LydiaHargrove.ged) | The citation of the change itself | `ChangeDate.citations` |
| `SOUR` under an event's `DATE` or `PLAC` | TMG (the Hawaiian Kings trees) | Citations attached to the date/place line | `DateStructure.citations` / `PlaceStructure.citations` |
| `ALIA` + `SOUR` and `TITL` under NAME | TMG (the Hawaiian Kings trees) | A name alias with its citations; a name-level title | `PersonalNameStructure.aliasLinks` / `.title` |
| `DATE`/`PLAC` under an inline NOTE | TMG (the Hawaiian Kings trees) | The date and place of the note itself | `Note.date` / `Note.place` |
| `DATE`/`PLAC` under the SOUR record | Canvas Roots exports; the Legacy record-level DATE normalizes into the same slot | The date and place of the source record itself | `SourceRecord.date` / `.place` |
| `1 TITL @R…@` under SOUR + the `TITL` records | the Ancestris kennedy sample | The source bibliography in a separate title record (payload + CHAN/AUTH/PUBL/SERS/ABBR/REPO/NUMB/CALN) | `TitleRecord` + `SourceRecord.titlRef` |
| `PLAC`/`DATE` under the inline OBJE link | WikiTree-style exports (GEDs_Gresham-187.ged) | The place and date of the media object under the inline link | `MultimediaRecord.place` / `.date` |
| the GEDKeeper long event spellings and the gedcom5-conversion Case006 catalog | GEDKeeper exports, the FamilySearch gedcom5-conversion test corpus | Event facts spelled with long English names, with DATE/PLAC children | EVEN + TYPE |
| `NAME` under HEAD.SUBM | Family Echo exports | The submitter's contact under the SUBM pointer | `Header.submitterName` |

The previous round's GenoPro entity records (`Occupation`/
`Education`/`Contact`/`Marriage`/`Twin` + the INDI containers), the
Ancestris/ged4web INDI-level and OBJE-record `TITL`, the `TEXT` under
the WILL event and the GEDKeeper `NEWS`/`OBIT`/`REMV`/`ILL`/`EDUS`/
`BATM`/`EMPL` set are covered by the same test file
(`tests/vendor-extensions-corpus-typing-3.test.ts`) and chapter 6.

## 7. Deferred: presentation and UI state

Pure report/interface data; a viewer that ignores these loses nothing
genealogical. They stay generic `ExtensionStructure`/`ExtensionRecord`
(GEDCOM 7.0 §1.5, model file `src/model/extensions.ts`); on export
they follow the extension rule of the target version — underscore
tags are written back in both versions, non-underscore tags are
dropped (neither 5.5.1 nor 7.0 can spell a non-underscore extension
tag).

Leaving them generic is a **deliberate decision**, not a gap in the
checklist: the project refuses to invent a model — typing a construct
no source documents would fabricate semantics (see the corpus
validation decision flow in the README's "Future work"). Each group
below (and the "???" tail of chapter 8) is one of two cases — the
meaning itself is undocumented or conflicting across the catalogs (the
"???" entries), or the meaning is known but no source documents the
wire format (position, substructures, value set), so typing would
require guessing. The decision per group is recorded next to the
sources, like the FOKO note in chapter 3; revisit only if the corpus
validation runs (README "Future work") show a concrete use.

**Legacy report machinery** (Legacy cat. "Custom GEDCOM Tags"): the
print styles, address groupings and sentence overrides are typed
(chapter 6) — `_ITALIC`/`_PAREN`/`_QUOTED` → `SourceRecord`
print-style flags, `_LIST1`–`_LIST6` → `AddressStructure` list
memberships, `_SORT` → `AddressStructure.sortName`, `_OVER` →
`EventDetail.sentence`. The `_EVENT_DEFN` record is typed (chapter 6,
`EventDefinitionRecord`). The SOUR-position report flags
`_TAG`/`_TAG2`–`_TAG4` are typed too (chapter 6:
`SourceRecord.citationDetailIncluded` and siblings). Still deferred:
the address/place "tagged" marking of the same tags — the vendor's
help documents the tag names there but not a value set or a wire
shape, so only the SOUR-position meaning is typed. Decision on
`_CONF_FLAG`: it marks the event *type* as confidential in the
vendor's configuration (and the mechanism that links a definition to
its event type is undocumented — the parser accepts the event tag in
every documented form: the record payload, a standard-tag child, or a
TYPE child), so it is not projected onto individual events; a UI may
interpret the definition itself.

**The Legacy place preposition** (`_PREP` under `_PLAC_DEFN`) is typed
(chapter 6): `PlaceRecord.preposition`, written back in both versions
(the record survives as a `_LOC` record for it).

**Family Tree Maker extras** (typed 2026-11): `_FA1`–`_FA13` user fact
definitions — the GenWiki table reads "Fakten — FACT in 5.5.1" and the
webtrees registry lists them under INDI and FAM — type into a `FACT`
(INDI) or FAM `EVEN` (FAM) whose TYPE resolves from the HEAD.SCHEMA
label of the declared context chain (fallback `Fact n`); `_DETS`
(undocumented meaning — the Legacy catalog marks it "???") stays
generic. The GenWiki table gives `_ELEC` the meaning "Elected" under
INDI (the Legacy catalog marks it "???") — the typed rule follows the
documented meaning: `FACT` + TYPE "Elected" (chapter 6). The FTW marriage
statuses `_MSTAT`/`_MEND` are typed (chapter 6). The GEDCOM 5.3 schema
block is no longer deferred: it is typed as `Header.schema53` and
written back in 5.5.1 (chapter 6).

**Family Origins correspondence block** (typed 2026-11): `_CORR` with the
`_REAS`/`_RESP`/`_RPLY` children ("Correspondence entry", "Reason",
"Response", "Reply Status" — the Legacy "User-Defined GEDCOM Tags"
catalog documents the meanings and the children) types into the
`CorrespondenceStructure` on `IndividualRecord.correspondence`
(written back as the `_CORR` block in both versions). Note the bare
non-underscore `REAS`/`RESP`/`RPLY` under INDI are typed separately as
`FACT` + TYPE (chapter 8).

**Ancestral Quest family-child status and source tags**: `_HUSB`/`_WIFE`
under INDI.FAMC and `_MASTER` under SOUR are typed (chapter 6:
`ChildFamilyLink.fatherChildStatus`/`motherChildStatus`,
`SourceRecord.masterListing`) — the positions are documented (the
GenWiki table names INDI.FAMC; the Legacy catalog names the SOUR
record) and the values are free text or a presence flag, so no wire
shape had to be invented. Still deferred: `_VERB` (AQ11) — both
catalogs list it with a blank description, so there is no meaning to
type. Deliberately generic; typed only if a source or the corpus
shows its actual form.

**Family Tree Maker / Family Tree Builder media tags** (deferred):
`_PHOTO` (FTM) and `_PHOTO_RIN` (FTB). None of our sources documents
the wire format: the GenWiki "GEDCOM/_Nutzerdef-Tag" table lists both
without a description or a superstructure
(<https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag>), the Legacy
"User-Defined GEDCOM Tags" catalog does not list them, and Tamura Jones
only documents the *standard* `PHOTO` tag of GEDCOM 5.3 (removed in
5.4), which is not the vendor tag. Typing them now would invent a
model; they stay generic extensions (underscore tags, preserved verbatim
in both versions — they have conformant spellings) until the corpus
validation runs (README "Future work") show their actual structure.

**Family Historian**: the genealogically relevant tags are typed from
the FHUG Knowledge Base "GEDCOM Extension List"
(<https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/>,
which blocks scrapers but is readable via the Wayback Machine):
`_FLGS` record flags and fact flags, `_TYPE` under SOUR, `_QUAY` and
`_FIELD` under citations, `_SHAN` witness names, `_USED` under NAME,
the `_EMAIL`/`_WEB` contact spellings (chapter 6), and the custom
attribute `_ATTR` + `TYPE` → `FACT` + TYPE (the same shape the FTM
`ATTR` rule carries). The `_PEDI` additional-relationship pedigree
(under INDI.FAMC) is typed too (chapter 6) — its wire form is the
standard PEDI payload. What stays
generic is the presentation/UI state the page itself says other
programs "typically ignore": the header state (`_ROOT`, `_VAR`,
`_UID`, `_PCIT`, `_USED`, the `_LIST` named lists), the media display
attributes (`_ASID`/`_SEQ`/`_AREA`/`_EXCL`/`_CAPT`/`_NOTA`/`_KEYS`/
`_FILE`), the FH7 rich-text block (`_TEXT`/`_FMT`/`_LINK_*`/`_LKID`),
and the `_RNOT`/`_SRCT`
record types (their internal structure is not documented; a `_SRCT`
record's `_FIELD` metafields round-trip verbatim as extensions).

**RootsMagic report fields** (`_SUBQ` under source citations and
`_SENT`/`_PPFX` under event details) are typed (chapter 6); the
non-underscore `SENT`/`PPFX` spellings are recognized in any file.
The PAF5 sentence definitions (`_EVENT_DEFN` with the `_SENM`/`_SENF`/
`_SENU` variants) are typed as part of `EventDefinitionRecord` (chapter
6). The PAF5 `_MEDC` (medical condition) is typed too (chapter 6):
`FACT` + TYPE "Medical condition".

## 8. Non-underscore vendor tags

Written by Generations, Reunion, Family Tree Maker 5 (DOS), The Master
Genealogist, Family Origins, WinFamily and early Roots versions; mostly
tags dropped from GEDCOM 5.3/5.4 or invented outright. The sources are
the Legacy Family Tree catalog, "Tags Not Specified in GEDCOM 5.5"
(<https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm>),
which names the program and the meaning per tag, and Tamura Jones,
"GEDCOM Tags" (<https://www.tamurajones.net/GEDCOMTags.xhtml>), for the
version history. The catalog is the closed list: 121 tags listed in the
catalog as non-underscore and nonstandard, plus the 10 entries of the
same catalog the earlier version of this chapter missed (`COMP`,
`CUTOFFYR`, `DATV`, `EARL`, `HISTB`, `MIDSC`, `ORIG`, `RATI`, `STAKE`,
`WEIG`) — 131 in total.

The GenWiki "GEDCOM/_Nutzerdef-Tag" article's second table
("Abweichungen vom Standard bei der Verwendung", itself based on
<http://www.gencom.org.nz/GEDCOM_tags.html>) adds the non-underscore
deviations the Legacy catalog does not list: the tags of Der Stammbaum
≤ V6 (USM6), Mac Family Tree 7/8 (MFT7/MFT8) and the RootsMagic
`FSFTID` spelling. 13 of them are now typed at their documented
positions (chapter 6): `SIGN` under INDI, `BTYP` under BIRT, `AGED`
under BURI (into the standard `AGE`), `MTYP` under INDI.FAMC, `UTYP`
under FAM, `SURE` under NCHI, `POTM`/`SRCH`/`NOTRY` under event
details, `RINI` under citations, and `UGNM`/`NAME_`/`SECG` under NAME
— anywhere else they stay generic, so nothing is lost. Nine stay
generic everywhere (`DEED`, `FPRF`, `MPRF`, `MISE`, `MRCI`, `MRRE`,
`PRIV`, `RECT`, and the non-underscore `CREA` spelling of MFT7);
`FSFTID` is typed — the same normalization as the underscore `_FSFTID`.

The webtrees per-vendor custom-tag registry
(<https://github.com/fisharebest/webtrees>, `app/CustomTags/`) adds
the remaining documented deviations of other programs. Typed: the four
Aldfaer marriage-kind tags (`MARR_CIVIL`/`MARR_RELIGIOUS`/
`MARR_PARTNERS`/`MARR_UNKNOWN` → `MARR` + the TYPE of the 5.5.5
MARR.TYPE vocabulary — civil / religious / registered partnership /
unknown), the phpGedView `COMM` comment under INDI and FAM (→ an
inline `NOTE`), and the RootsMagic `WWW` under INDI (→
`IndividualRecord.url`, the same slot `_URL` carries). Generic: the
phpGedView `SERV` (the remote server of a SOUR record) and the
MyHeritage `PERSONALPHOTO` (the personal photo reference under INDI —
no source documents the payload form). The full set is 162 tags.

The policy, implemented in `src/parsing/vendor-tags.ts` (the tables
`LEGACY_INDIVIDUAL_TAGS`, `LEGACY_FAMILY_TAGS`, `LEGACY_GENERIC_TAGS`,
each entry annotated with the catalog's program and description — the
tables are the inventory, so the list is not repeated here):

- **Accepted in any file** (the import grammar accepts the tags of
  both versions wherever the file declares them; see the README's
  Known strict decisions). Under the full-leniency rule, unknown
  non-underscore tags outside the catalog are likewise accepted as
  generic extensions — the list selects the *typed* rules.
- **Typed where the catalogs document a meaning**, normalized into the
  model slot that carries the same fact — the same standard-first
  normalization the underscore vendor tags use:
  - `AKA` → `names[]` with `TYPE AKA` (like `_AKA`); `NAMR` → `NAME` +
    `TYPE OTHER` + `PHRASE "Religious name"`; `BLESS` → the standard
    `BLES` event; `RESIR` → the standard `RESI` attribute; `NMAR` → the
    standard `NMR` count (per the catalog, FTW5 wrote "Number of
    Marriages" — unlike the BKW `_NMAR`, which means never married);
  - the non-underscore twins of the already-typed `_` facts normalize
    identically: `CIRC` (circumcision), `MILT`/`MILF`/`MILI` (military),
    `MISN` (mission), `EXCO` (excommunicated), `ENMPL` (employment),
    `DEGR` (degree), `NAMS` (namesake), `EYES`/`HAIR`/`HEIG`/`WEIG`
    (physical descriptors), and the notes `HIST`/`INFO`/`DESC`/`DESR`/
    `REMA`/`COMML` (FTW5 "comment" — not the BKW `_COML`) and `NOTP`
    (WinFamily: a *private* note → an inline `NOTE` with the privacy
    flag set, written back as `NOTE` + `_PRIV Y`; see `Note.private`);
  - ~60 further facts (`ARVL`, `CEME`, `CITN`, `CODI`, `COLO`, `COYN`,
    `CRIM`, `CSTA`, `DPRT`, `DWEL`, `EDTN`, `EDTR`, `EMAL`, `FAX`,
    `FOST`, `HEAL`, `HOBB`, `HONO`, `HOSP`, `ILLE`, `ILLN`, `LVG`,
    `LVNG`, `MILA`, `MILD`, `MOVE`, `NAMG`, `ORDL`, `PASL`, `PURC`,
    `RACE`, `REBA`, `STIL`, `STLB`, `TOWN`, `UNIT`, `VOL`, and the LDS
    status facts `BIC`, `BLSL`, `CANC`, `NULL`, `ORDI`, `PRES`, `RESE`,
    `REST`, `SLGP`, `STAL`/`STAKE`, `VOIL`, …) → `EVEN`/`FACT` + `TYPE`,
    the payload text kept;
  - `UMAR` ("unmarried") → a bare `NO MARR` (5.5.1 writes `_NMAR`);
  - the person links `FATH`, `MOTH`, `SON`, `DAU`, `SIBL`, `WIFE` (under
    INDI), `PART`, `FRND`, `CLER`, `CNTC`, `CPLR`, `INTE`, `INTV`,
    `OWNR`, `RECO` — a pointer payload → `ASSO` + `RELA` (7.0: `ROLE
    OTHER` + `PHRASE`), a text payload → `FACT` + `TYPE`;
  - `URL` → `IndividualRecord.url` (export `_URL`); `WWW` → the same
    slot (RootsMagic writes the standard tag under INDI); `FILN`/
    `HISTID`/`NUMB` → `REFN` identifiers;
  - `FSFTID` (RootsMagic) → `IndividualRecord.familySearchId` (export
    `_FSFTID`), the same normalization as the underscore `_FSFTID`;
  - `LDS` — the FTM5 wrapper: its children parse as LDS individual
    ordinances (`BAPL`/`CONL`/`ENDL`/`SLGC`), and the wrapper itself
    disappears;
  - FAM level: `CLAW` → `MARR` + `TYPE "Common law marriage"`, `SEPA` →
    FAM `EVEN` + `TYPE "Separated"`, `FEMA`/`MALE` → FAM `EVEN` + `TYPE`
    with the child-count payload; `COMM` (phpGedView) → an inline FAM
    `NOTE`; the Aldfaer `MARR_CIVIL`/`MARR_RELIGIOUS`/`MARR_PARTNERS`/
    `MARR_UNKNOWN` → `MARR` + TYPE civil / religious / registered
    partnership / unknown (the 5.5.5 MARR.TYPE vocabulary, 5.5.5 §2
    p.38).
- **Standard-first export.** The typed constructs are written in the
  standard spelling of the target version (the vendor tag itself is not
  written back), and both versions can spell all of them — nothing is
  lost in either direction.
- **The deliberately generic tail** (34 tags in
  `LEGACY_GENERIC_TAGS`, accepted in any file wherever no typed rule
  applies; no conformant spelling in either target version — 5.5.1
  reserves the underscore prefix for user-defined tags and 7.0 §1.5
  can only spell underscore-prefixed extension tags — so they are
  dropped on export in both versions, the documented projection for
  unspellable constructs). Several
  of them are typed at their documented positions (SIGN under INDI,
  BTYP under BIRT, MTYP under INDI.FAMC, UTYP under FAM, SURE under
  NCHI, POTM/SRCH/NOTRY under event details, RINI under citations,
  UGNM/NAME_/SECG under NAME, AGED under BURI — chapter 6) and stay in
  the set only as the generic fallback for every other position. Every
  tag below stays generic for a recorded reason; none of them is typed
  by accident:

  - `COMP`, `DATV`, `DETS`, `EARL`, `HISTB`, `PRTY` — the catalog
    marks the meanings "???"; there is nothing to type.
  - `NAMM` — Reunion: "Name ???" — same.
  - `MSTAT` — **conflicting documented meanings.** The Legacy catalog
    records the Mac Genealogy spelling as *death status*
    (the GenWiki "GEDCOM/_Nutzerdef-Tag" table agrees: "Death status,
    Mac Gene"), while Tamura Jones' "GEDCOM Tags" table documents the
    GEDCOM 5.3 draft's `MSTAT` as *marriage status* — the tag existed
    only in 5.3 and was removed in 5.4 (the 5.4/5.5 removal lists even
    misspell it `MSTA`). The parser cannot tell which meaning a file
    intends, and neither catalog documents the tag's position. Typing
    it either way would silently relabel data written under the other
    meaning — corruption, not preservation. (The underscore `_MSTAT`
    is a different tag — FTW's marriage *beginning* status — and is
    typed as `FamilyRecord.marriageBeginningStatus`, chapter 6.)
  - `LABL` and `SCHEMA` outside their schema contexts — the GEDCOM 5.3
    schema mechanism (`SCHEMA` with the `LABL`/`DEFN`/`ISA` leaves,
    kept alive by Family Tree Maker) is typed at its canonical
    position (HEAD.SCHEMA → `Header.schema53`, chapter 6). The same
    tags also occur elsewhere in FTM files — a bare `LABL` under a
    fact as its display label, schema fragments outside the header
    ("Defines label for given fact, under the _SCHEMA", per the
    Legacy catalog). There the schema model does not apply, and the
    model deliberately has no slot for presentation-only display
    labels, so those instances stay generic. Deliberate; see also
    chapter 7 (the same reasoning as for the deferred underscore
    tags).
  - The GenWiki "Tabelle 2" deviations of USM6 and Mac Family Tree —
    `DEED`, `FPRF`, `MPRF`, `MISE`, `MRCI`, `MRRE`, `PRIV`, `RECT`, and
    the non-underscore `CREA`. The GenWiki table documents each meaning
    ("document info", "the person is marked private", …) but no wire
    format beyond the tag itself — no position grammar, value set, or
    substructure rules — so typing any of them would invent a model.
    (The other Tabelle 2 tags with a documented position and value set
    are typed: chapter 6. `FPRF`/`MPRF` are the USM settings blocks
    under HEAD, kept in the model as header extensions.) They
    stay generic extensions, accepted in any file (this
    is what fixed the import of real MacFamilyTree files, which
    previously failed with `structure.unknown-tag`); on export they
    are dropped in both versions — neither target grammar can spell a
    non-underscore extension tag.

Where a tag's position *is* standard, the standard structure always
wins: `NATI` under INDI stays a standard attribute, `WIFE` under FAM
stays the partner link, `DESC` under SUBN stays the generation count,
`IDNO` under INDI stays the standard IDNO attribute in any file.

Covered by `tests/vendor-extensions-nonunderscore.test.ts` (per-tag
typing assertions, pointer associations, the LDS wrapper, the FAM
rules, standard-first export, and a 5.5.1 round trip of the whole
catalog's typed constructs) and `tests/vendor-extensions-mft-usm.test.ts` (the
GenWiki Tabelle 2 tags, the FSFTID typing, and the GenWiki twins of
the typed underscore tags).
