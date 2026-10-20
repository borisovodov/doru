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
  spellings, the year-less `day month` dates, the `JPEG`/`TIFF` media
  formats — are accepted in any 5.x file (`GEDC.FORM.VERS` is
  tolerated but not stored). See the README's Parsing and "Known
  strict decisions" sections.
- **GEDCOM 5.3** had a schema mechanism (`SCHEMA`, `DEFN`, `LABL`,
  `ISA`) that was dropped in 5.4 but survives in Family Tree Maker
  files. Same Tamura Jones source as above.
- **GEDCOM 7.0** has an official mechanism: extension tags declared in
  `HEAD.SCHMA` with URIs, plus an official registry of extensions:
  - FamilySearch GEDCOM 7 specification (extension rules):
    <https://gedcom.io/specifications/FamilySearchGEDCOMv7.html>
  - Extension registry (YAML, one file per extension):
    <https://github.com/FamilySearch/GEDCOM-registries>
  - Registry manifest of registered vendor extensions:
    <https://github.com/FamilySearch/GEDCOM-registries/blob/main/manifest/extension/manifest-extensions-en-US.tsv>
  - Official test files exercising every extension form:
    <https://gedcom.io/testfiles/gedcom70/extensions.ged> and
    <https://gedcom.io/testfiles/gedcom70/extension-record.ged>
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
    (archived: <https://web.archive.org/web/2025/https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag>)

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
`CITN`, `EXCO`, …).

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
Every registered construct below is treated as valid input and is typed
in the model; the registry YAML is the cited source of each field.

| Registry entry | Tag | Position | Model field | Export |
| --- | --- | --- | --- | --- |
| [Ancestry_PUBL_DATE.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/Ancestry_PUBL_DATE.yaml) | `DATE` | under `SOUR.PUBL` {0:1}, DateExact | `SourceRecord.publicationDetails.date` | 7.0; dropped on 5.5.1 |
| [Ancestry_PUBL_PLAC.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/Ancestry_PUBL_PLAC.yaml) | `PLAC` | under `SOUR.PUBL` {0:1}, place name | `SourceRecord.publicationDetails.place` | 7.0; dropped on 5.5.1 |
| [MagiKey_record_CENR.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_record_CENR.yaml) | `_CENR` | record: `_SCHD` {0:1}, `SEX` {0:M}, `INDI` {1:M}, `DATE` {1:1}, `PLAC` {1:1}, `SOUR` {0:1}, `CHAN` {0:1} | `CensusRecord` | both versions |
| [MagiKey_CENR_INDI.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_CENR_INDI.yaml) | `INDI` | under `_CENR`: pointer to INDI, with `FATH`/`MOTH` {0:1}, `_MSTAT` {0:1}, `AGE`, `BIRT`, `FACT` {0:M}, `NAME`, `OCCU`, `ROLE`, `SEX` | `CensusRecord.entries` | both |
| [MagiKey_FATH.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_FATH.yaml) / [MagiKey_MOTH.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_MOTH.yaml) | `FATH` / `MOTH` | under the census `INDI`: `AGE`, `BIRT`, `FACT`, `MARR`, `OCCU` {0:1} each | `CensusIndividual.father` / `mother` | both |
| [MagiKey_AGER.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_AGER.yaml) | `_AGER` | under `AGE` {0:1}, payload `Integer-Integer` | `AgeStructure.ageRange` | both |
| [MagiKey_MSTAT.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_MSTAT.yaml) | `_MSTAT` | under the census `INDI` | `CensusIndividual.maritalStatus` | both |
| [MagiKey_SCHD.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/MagiKey_SCHD.yaml) | `_SCHD` | under `_CENR` | `CensusRecord.schedule` | both |
| [_DATE.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/_DATE.yaml) | `_DATE` | under `REPO` {0:M}, DateValue + TIME/PHRASE (marked prerelease) | `RepositoryRecord.dates` | both |
| [_SOUR.yaml](https://github.com/FamilySearch/GEDCOM-registries/blob/main/structure/extension/_SOUR.yaml) | `_SOUR` | under `PAGE` {0:M} and `record-SOUR` {0:M}, a relocated citation (marked prerelease) | generic extension, preserved verbatim | both |

Note on the nonconformant uses of standard tags (PUBL.DATE/PLAC and
the census INDI/FATH/MOTH/SEX): the core of GEDCOM 7.0 §1.5 permits
extension-defined substructures only under extension tags, so these
are invalid core 7.0; the registry documents them as vendor practice,
and this package accepts them per the registry — the rule is recorded
in the JSDoc of each affected field. Covered by
`tests/registry-extensions.test.ts`.

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
| `_FREL`/`_MREL` | `FamilyChildLink.fatherRelation`/`motherRelation` | `_FREL`/`_MREL` | standard-first: agreeing pair → `INDI.FAMC.PEDI`; otherwise dropped |
| `_APID` | `SourceCitation.ancestryPointers` | `_APID` | `_APID` (no standard equivalent) |
| `_PLAC` / `_LOC` / `_PLAC_DEFN` records | `PlaceRecord` (+ `PlaceStructure.location` links) | flattened: map/notes merged into referencing `PLAC` (citations/media dropped), records/links not written | same flattening |
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
| `_NONE` | Legacy | "Couple had no children" under FAM | FAM `attributes` `NCHI 0` |
| `_MILT` / `_MDCL` / `_FOOT` | FTM | Military service / medical / footnote facts | `EVEN` + TYPE |
| `_DCAUSE` | FTM | Death cause | `DEAT.CAUS` |
| `_STAT` under FAM | Legacy | Marriage status (Married, Unmarried, …) | `FamilyRecord.marriageStatus` |
| Gramps `ASSO` + `TYPE INDI` + `RELA` | Gramps | Event witnesses under family events | `EventDetail.associations` (like `_SHAR`) |
| `_CREF` / `_FULL` | TMG (via T2G) | Citation reference / formatted footnote text | `SourceCitation.reference` / `SourceRecord.fullFootnote` |
| `_TYPE` under OBJE | AQ, FO7, PAF5, Legacy | Media object kind (Photo/Sound/Video) | `MultimediaRecord.objectType` |
| `_SCBK` / `_SSHOW` | AQ, FO7, PAF5 | Scrapbook / slideshow media flags | `MultimediaLink.scrapbook` / `slideshow` |
| `_PRIMARY` | AQ, PAF5 | Primary family for an adopted child | `ChildFamilyLink.primary` |
| `_URL` under INDI | Legacy | Web address of a person | `IndividualRecord.url` |
| `_PRIV` under events / ADDR | Legacy | Event or address marked private | `EventDetail.restriction` PRIVACY / `AddressStructure.private` |
| `_PREF` | Legacy | Preferred spouse / child / parents | `SpouseFamilyLink.preferred`, `FamilyChildLink.preferred`, `ChildFamilyLink.preferred` |
| `_VERI` | Legacy | Verified checkmark on citations and places | `SourceCitation.verified`, `PlaceStructure.verified` |
| `_EXCM` / `_MISN` | FTM | Excommunicated / Mission facts | `EVEN` + TYPE |
| `_UNKN` | FTW8 | Special individual ID for later file comparisons | the `UID` identifier (exports as `_UID`) |
| `_NAME` under ADDR | PAF | Name of the addressee | `AddressStructure.name` |
| `_SOSA` | Ancestris | Sosa–Stradonitz (Ahnentafel) number of the individual | `IndividualRecord.sosaNumber` (written back in both versions) |
| `SCHEMA` / `_SCHEMA` | FTM | The GEDCOM 5.3 user-tag declaration block (context chains + LABL/DEFN/ISA) | `Header.schema53` (written back in 5.5.1 as `SCHEMA`; dropped on 7.0) |

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
`_LOCL`/`_RDATE` → `TodoRecord`; `_TAG`/`_TAG2`–`_TAG9` →
`IndividualRecord.marks` (slots kept, gaps stay empty); `_SOUND` →
`MultimediaRecord.soundFile`; `_NAME` under ADDR is in the table above.
The Legacy report machinery is deferred in chapter 7.

**MyHeritage**: `_UPD` (in the table above); no other documented tags.

**GEDKeeper**: `_UID` and the `_SHAR` family (chapter 5); nothing else
documented.

**GEDCOM-L / GEDCOM 5.5EL — typed**: the `_LOC` record fields
(`_GOV` → `govId`, `_MAIDENHEAD`, `TYPE`+`_GOVTYPE` → `types`,
`_POST` → `postalCodes`, `_AIDN` → `administrativeIds`, `_DMGD` →
`demographicData`, `NAME {1:M}` → `names`, `RELI` → `denomination`,
`EVEN` → `events`, `_LOC`+`TYPE POLI|RELI|GEOG|CULT` → `parents`);
`_GOV`/`_POST`/`_MAIDENHEAD` under event PLACs → `PlaceStructure`
fields; `_RUFNAME` → `PersonalNameStructure.callName`; `_GODP`/`_WITN`
→ `EventDetail.godparents`/`witnesses` (free text). On output the
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
preserved verbatim, so nothing is lost on re-export. Revisit only if
the corpus validation runs (README "Future work") show a concrete use.

**Legacy report machinery** (Legacy cat. "Custom GEDCOM Tags"): the
`_EVENT_DEFN` record with `_SEN1`–`_SEN8`/`_SENM`/`_SENF`/`_SENU`
sentence definitions, `_CONF_FLAG`/`_DATE_TYPE`/`_DESC_FLAG`/
`_PLACE_TYPE`/`_PP_EXCLUDE` definition flags, `_ITALIC`/`_PAREN`/
`_QUOTED` source print styles, `_LIST1`–`_LIST6` address groupings,
`_SORT`/`_OVER`/`_PREP` — how reports are worded, printed and grouped.
Decision on `_CONF_FLAG`: it marks the event *type* as confidential in
the vendor's configuration (and the mechanism that links a definition
to its event type is undocumented), so it is not projected onto
individual events; it stays a generic extension, and a UI may interpret
the definition itself.

**Family Tree Maker extras** (deferred): `_FA1`–`_FA13` user fact
definitions, `_DETS` and `_ELEC` (undocumented meaning) — and the FTW
marriage statuses `_MSTAT`/`_MEND` (beginning/ending status under MARR;
the meaning collides with `_STAT`, the writing product is
discontinued). The GEDCOM 5.3 schema block is no longer deferred: it is
typed as `Header.schema53` and written back in 5.5.1 (chapter 6).

**RootsMagic report fields**: `_SUBQ` (subsequent citation format),
`_SENT` (event sentence), `_PPFX` (place prefix) — report wording.

**Family Historian**: `_FLGS` fact flags and the FH7 source-template
extensions — the wire format is not documented in our sources (the
FHUG Knowledge Base blocks scrapers); typing them would invent a model.
Needs the corpus.

**PAF sentence definitions** (PAF5): `_EVENT_DEFN`, `_SENM`/`_SENF`/
`_SENU` plus the `_SENDOM`/`_SENDPM`/`_SENPOM`/`_SENDOF`/`_SENPOF`/
`_SENDPF`/`_SENDOU`/`_SENPOU`/`_SENDPU` variants, `_DATE_TYPE`,
`_DESC_FLAG`, `_PLACE_TYPE`, `_MEDC`, `_CONF_FLAG` — sentence
templates for reports; PAF is discontinued. (Shares the sentence
family with Legacy above.)

## 8. Deferred: non-underscore vendor tags

Written by Generations, Reunion, Family Tree Maker 5 (DOS), The Master
Genealogist and early Roots versions; mostly tags dropped from GEDCOM
5.3/5.4 or invented outright (from the Legacy cat. "Tags Not Specified
in GEDCOM 5.5" list): `AKA`, `ARVL`, `ATTR`, `BIC`, `BLESS`, `BLSL`,
`CANC`, `CEME`, `CIRC`, `CITN`, `CLAW`, `CLER`, `CNTC`, `CODI`,
`COLO`, `COMML`, `COYN`, `CPLR`, `CRIM`, `CSTA`, `DAU`, `DEGR`,
`DESC`, `DESR`, `DETA`, `DETS`, `DPRT`, `DWEL`, `EDTN`, `EDTR`,
`EMAL`, `ENMPL`, `EXCO`, `EYES`, `FATH`, `FAX`, `FEMA`, `FILN`,
`FMT`, `FOST`, `FRND`, `HAIR`, `HEAL`, `HEIG`, `HIST`, `HISTID`,
`HOBB`, `HONO`, `HOSP`, `IDNO`, `ILLE`, `ILLN`, `INFO`, `INTE`,
`INTV`, `ISA`, `ISSU`, `LABL`, `LDS`, `LOCA`, `LVG`, `LVNG`, `MALE`,
`MILA`, `MILD`, `MILF`, `MILI`, `MILT`, `MISC`, `MISN`, `MOTH`,
`MOVE`, `MSTAT`, `NAMG`, `NAMM`, `NAMR`, `NAMS`, `NATI`, `NMAR`,
`NOTP`, `NULL`, `NUMB`, `ORDI`, `ORDL`, `OWNR`, `PART`, `PASL`,
`PERI`, `PPFX`, `PRES`, `PRTY`, `PUBL`, `PURC`, `RACE`, `REAS`,
`REBA`, `RECO`, `REGI`, `REMA`, `RESE`, `RESIR`, `RESP`, `REST`,
`RPLY`, `SCHEMA`, `SENT`, `SEPA`, `SIBL`, `SLGP`, `SON`, `STAL`,
`STIL`, `STLB`, `SUBM`, `TOWN`, `UMAR`, `UNIT`, `URL`, `VOIL`, `VOL`,
`WIFE`.

These are **strict errors** in the parser today: not `_`-prefixed, they
bypass the generic extension path, so a file containing one fails with
`structure.unknown-tag` instead of silently round-tripping. (The
exception is the GEDCOM 5.3 `SCHEMA` block under HEAD — typed, chapter
6.) The policy
decision is open; the options considered, in increasing order of
strictness: accept the known list as generic extensions on input
(documented, re-emitted verbatim); accept any unknown tag as an
extension (maximum leniency — against the strict-by-default
principle); or keep rejecting them (today's behavior) and record each
real-world occurrence in the README's "Known strict decisions". The
inventory says: keep rejecting for now; revisit after the corpus
validation runs (README "Future work") show which of these actually
appear in modern files.
