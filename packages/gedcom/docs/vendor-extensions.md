# GEDCOM vendor extensions in the wild

Reference catalog of how real-world vendors extend GEDCOM, with links to
the most authoritative available sources. The links here are meant to be
quoted in the JSDoc of the code that recognizes or normalizes these tags
(see the "Known strict decisions" section of the package README for the
project's stance on extensions).

Compiled 2026-10. Links checked at compilation time; some vendors block
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
  5.x parser accepts `GEDC.VERS` 5.5 (1996), 5.5.1 and 5.5.5; the
  pre-5.5 versions (3.0, 4.0, 5.0) and the superseded drafts (5.3,
  5.4) fail up front with `document.wrong-version` instead of
  mid-file unknown-tag errors. GEDCOM 6.0 (the 2001–2002 XML beta
  draft, never adopted) and GEDCOM X (FamilySearch's successor
  standard family with its own XML/JSON syntax) are different
  formats, not text GEDCOM — deliberately out of scope, with no
  import planned.
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
    structure has no slot stays generic. The test files also fixed
    real bugs along the way: extension-defined substructures under
    typed extension records (`SUBM`/`DATE` under `_LOC`) and the nested
    standard tags of generic extension records are preserved instead of
    rejected or dropped, extension epochs no longer serialize as `BCE`,
    and the model gained the 7.0 FAMC/FAMS `PHRASE` slots.
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
`CITN`, `EXCO`, …). `_DATE2`, `_PRIMARY` and `_TODO` are typed; the
rest of the AQ/FO private tags (`_HUSB`/`_WIFE`, `_MASTER`, `_VERB`,
the `_CORR` block) are deliberately generic — see chapter 7.

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
Nothing to type; unknown `_` tags round-trip generically. The T2G
template notes it has no sort dates:
<https://www.tmgtogedcom.com/en/template-heredis.htm>.

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
  `_WITN` (witnesses) under events — both **free text**, not pointers;
  `_ASSO @xref@` + `RELA` for event participants. The `_TYPE same-sex`
  FAM convention (Ahnenblatt) is not part of the N7 list. Source: the
  GenWiki "GEDCOM/_Nutzerdef-Tag" article with the full known-tag
  table (chapter 2).

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
| [_DATE.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/_DATE.yaml) | `_DATE` | under `REPO` {0:M}, DateValue + TIME/PHRASE (marked prerelease) | `RepositoryRecord.dates` | both |
| [_SOUR.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/_SOUR.yaml) | `_SOUR` | under `PAGE` {0:M} and `record-SOUR` {0:M}, a relocated citation: the standard SOUR tag moved under PAGE or under the SOUR record, same payload (a pointer) and same substructures (NOTE, OBJE, PAGE, QUAY, SNOTE, SOUR-DATA, SOUR-EVEN; marked prerelease) | `PageStructure.citations` / `SourceRecord.relocatedCitations` | both, written back under the PAGE line / under the SOUR record |

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
`ExtensionStructure`/`ExtensionRecord` (preserved verbatim, never
typed). The unified policy: known tags are recognized on input in both
versions; on output a construct with a standard equivalent uses the
target version's standard spelling, and a construct without one is
written as the vendor tag in both versions. The full rules live in the
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
| `_MARNM` (also `_MARN`) | AQ, PAF5, BKW6, "several programs and websites" | Married name | `names[]` with `TYPE MARRIED` |
| `_AKA` / `_AKAN` | AQ, PAF4/5, BKW6 | "Also known as" name | `names[]` with `TYPE AKA` |
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
| `_SENT` / `_PPFX` under event details | RootsMagic | Event sentence / place prefix (report wording); the Legacy catalog spells them without the underscore — `SENT`/`PPFX` are recognized on 5.x input too | `EventDetail.sentence` / `placePrefix` (written back as `_SENT`/`_PPFX` in both versions) |
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
| `SIGN` under INDI | USM6 | The person can sign [yes/no] | `IndividualRecord.canSign` (the wire value is undocumented; 5.5.1 writes `SIGN 1`/`SIGN 0`, 7.0 drops the tag) |
| `BTYP` under BIRT | USM6 | Birth type: 1=single, 2=twin, 3=multiple, 4=died at birth | `BirthEvent.birthType` (5.5.1 writes `BTYP`; dropped on 7.0) |
| `AGED` under BURI | USM6 | The age at death, a plain number of years (`AGED 80`) | the burial detail's standard `AGE` (standard-first: written back as `AGE`) |
| `MTYP` under INDI.FAMC | USM6 | Parent–child relation kind: 1=marital, 2=non-marital, 3/4=adoption without/with incorporation, 5=unknown, 6=uncertain | `ChildFamilyLink.parentalRelationKind` (5.5.1 writes `MTYP`; dropped on 7.0) |
| `UTYP` under FAM | USM6 | Family relationship kind: 1=married, 2=married+separated, 3=married+divorced, 4=annulled, 5=non-marital | `FamilyRecord.unionKind` (5.5.1 writes `UTYP`; dropped on 7.0) |
| `SURE` under NCHI | USM6 | The given child count is certain (`SURE 1`) | `FamilyChildCountAttribute.childCountCertain` / `IndividualChildCountAttribute.childCountCertain` (5.5.1 writes `SURE 1`/`SURE 0`; dropped on 7.0) |
| `POTM` under events | USM6 | The event occurred post mortem | `EventDetail.posthumous` (5.5.1 writes `POTM 1`/`POTM 0`; dropped on 7.0) |
| `SRCH` under events | USM6 | Where to research the event further | `EventDetail.furtherResearch` (5.5.1 writes `SRCH`; dropped on 7.0) |
| `NOTRY` under events | USM6 | The notary of the event (marriage contract, will) | `EventDetail.notary` (5.5.1 writes `NOTRY`; dropped on 7.0) |
| `RINI` under citations | USM6 | Who found the source information | `SourceCitation.foundBy` (5.5.1 writes `RINI`; dropped on 7.0) |
| `UGNM` under NAME | USM6 | The call name (Rufname) | `PersonalNameStructure.callName` (the same slot `_RUFNAME` carries; written back as `_RUFNAME`) |
| `NAME_` under NAME | USM6 | Surname variants | `PersonalNameStructure.surnameVariants` (5.5.1 writes `NAME_`; dropped on 7.0) |
| `SECG` under NAME | MFT7 | The second and further given names | `PersonalNameStructure.furtherGivenNames` (5.5.1 writes `SECG`; dropped on 7.0) |

**Brother's Keeper family** (BKW6, Legacy cat.): name variants
(`_BIRN` → `NAME` `TYPE BIRTH`; `_ADPN`/`_CENN`/`_CURN`/`_FARN`/`_FKAN`/
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

## 7. Deferred: presentation and UI state

Pure report/interface data; a viewer that ignores these loses nothing
genealogical. They stay generic `ExtensionStructure`/`ExtensionRecord`
(GEDCOM 7.0 §1.5, model file `src/model/extensions.ts`) and are
preserved verbatim, so nothing is lost on re-export.

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

**Family Tree Maker extras** (deferred): `_FA1`–`_FA13` user fact
definitions — the catalogs name them ("definitions for facts") but no
source documents their structure, so the values cannot be typed; `_DETS`
(undocumented meaning — the Legacy catalog marks it
"???"). The GenWiki table gives `_ELEC` the meaning "Elected" under
INDI (the Legacy catalog marks it "???") — the typed rule follows the
documented meaning: `FACT` + TYPE "Elected" (chapter 6). The FTW marriage
statuses `_MSTAT`/`_MEND` are typed (chapter 6). The GEDCOM 5.3 schema
block is no longer deferred: it is typed as `Header.schema53` and
written back in 5.5.1 (chapter 6).

**Family Origins correspondence block** (deferred): `_CORR` with the
`_REAS`/`_RESP`/`_RPLY` children ("Correspondence entry", "Reason",
"Response", "Reply Status"). The catalogs document the meanings but not
the block's wire shape — its position and the substructure grammar are
unknown, so typing it would invent a structure. Deliberately generic
(preserved verbatim in both versions); note the bare non-underscore
`REAS`/`RESP`/`RPLY` under INDI are already typed as `FACT` + TYPE
(chapter 8), which covers the common spelling.

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
model; they stay generic extensions (preserved verbatim in both
versions) until the corpus validation runs (README "Future work")
show their actual structure.

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
non-underscore `SENT`/`PPFX` spellings are recognized on 5.x input.
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

- **Accepted on 5.x input only** (files declaring 5.5.1 or 5.5.5).
  GEDCOM 7.0 input stays strict (`structure.unknown-tag`): these tags
  are not valid 7.0 — §1.3 defines stdTags only via the specification
  and §1.5 requires extension tags to be underscore-prefixed. Unknown
  non-underscore tags remain strict errors; the list is closed.
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
  `LEGACY_GENERIC_TAGS`, accepted on 5.x input wherever no typed rule
  applies, preserved verbatim on 5.5.1 export, dropped on 7.0 export —
  7.0 §1.5 can only spell underscore-prefixed extension tags). Several
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
    under HEAD, which round-trip verbatim as header extensions.) They
    stay generic extensions, preserved verbatim on 5.5.1 export (this
    is what fixed the import of real MacFamilyTree files, which
    previously failed with `structure.unknown-tag`); on 7.0 export
    they are dropped — 7.0 cannot spell a non-underscore extension
    tag.

Where a tag's position *is* standard, the standard structure always
wins: `NATI` under INDI stays a standard attribute, `WIFE` under FAM
stays the partner link, `DESC` under SUBN stays the generation count,
`IDNO` under INDI stays the standard IDNO attribute (7.0; on 5.x input
it parses as the standard attribute too).

Covered by `tests/vendor-extensions-nonunderscore.test.ts` (per-tag
typing assertions, pointer associations, the LDS wrapper, the FAM
rules, standard-first export, and a lossless 5.5.1 round trip of the
whole catalog) and `tests/vendor-extensions-mft-usm.test.ts` (the
GenWiki Tabelle 2 tags, the FSFTID typing, and the GenWiki twins of
the typed underscore tags).
