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

## 4. Registered GEDCOM 7.0 extensions (official registry)

From the registry manifest
(<https://github.com/FamilySearch/GEDCOM-registries/blob/main/manifest/extension/manifest-extensions-en-US.tsv>):

| Tag | Registered by (HEAD.SOUR) |
| --- | --- |
| `DATE`, `PLAC` under `PUBL` | Ancestry.com Family Trees |
| `FATH`, `MOTH`, `INDI` (census), `_AGER`, `_CENR`, `_MSTAT`, `_SCHD` | MagiKey |
| `_DATE`, `_SOUR` | unowned (community) |

Each entry has a YAML file under `structure/extension/` in the
GEDCOM-registries repository, served as a URI (e.g.
`https://gedcom.io/terms/v7/HEAD` for standard terms).

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

## 6. Notes for the Dóru integration

- The underscore convention and the GEDCOM 7 SCHMA mechanism both
  survive in the unified model as `ExtensionStructure` /
  `ExtensionRecord` (`GEDCOM 7.0 §1.5`, model file
  `src/model/extensions.ts`).
- When the corpus work starts (see the README "Future work" brief),
  this catalog is the checklist: every tag above is a candidate for a
  documented normalization (tag → standard structure) or a documented
  strict rejection in "Known strict decisions".
- The PAF checksum UUID format (32+4 hex) is worth a dedicated
  normalizer in the `_UID` handling.

## 7. Exhaustive tag inventory (decision checklist)

Every tag from chapters 2 and 3, with: which vendors write it (from the
Legacy Family Tree "User-Defined GEDCOM Tags" catalog with its program
codes, John Cardinal's "Common GEDCOM Extensions", the TMG-to-GEDCOM
docs, and GED-VIEW; "Legacy cat." below = the Legacy catalog), what it
means, whether the model already has a field, how hard typing it would
be, and a recommendation. The FHUG Knowledge Base list could not be
scraped (bot protection); the Family Historian rows below carry the
tags confirmed by secondary sources and should be checked against the
corpus.

Priorities:

- **P0** — already typed (see chapter 5).
- **P1** — recommended: multi-vendor, real data, low effort.
  **Fully implemented** — every row in the table below is typed.
- **P2** — worth considering: meaningful data or very common vendor,
  but single-vendor or medium effort. **Fully implemented** — every row
  in the table below is typed; the only P2 item deferred is FTW
  `_MSTAT`/`_MEND`, which moved to P3 (DOS-era, colliding meaning).
- **P3** — single-vendor housekeeping: **resolved** — every
  data-bearing tag is typed (the Legacy data tags, the Brother's
  Keeper family, the FTM `_EXCM`/`_MISN`/`_UNKN`), everything else
  moved to P4.
- **P4** — defer: pure presentation/UI state (sentence templates,
  print styles, mailing-list groupings, definition flags).
- **P5** — the non-underscore relics of dropped standard tags or
  invented tags; today these are strict `structure.unknown-tag` errors
  (they are not `_`-prefixed, so they do not flow into the generic
  extensions); a policy decision is needed before any typing.

### 7.1 P0 — already in the model

`_UID`, `_SDATE`, `_SHAR`/`_ROLE`, `_PRIM`, `_FREL`/`_MREL`, `_APID`,
the `_PLAC`/`_LOC`/`_PLAC_DEFN` records, the `_LOC` link under PLAC,
and the `_PLAC` second place — see the table in chapter 5.

### 7.2 P1 — recommended candidates

| Tag | Vendors | Meaning | Model today | Effort | Recommend |
| --- | --- | --- | --- | --- | --- |
| `_TMPLT` | RootsMagic, FTM | Evidence Explained source template: `FIELD`/`VALUE` pairs under SOUR (page, URL, film no, …) | typed → `SourceRecord.template` (TID + FIELD NAME/VALUE) | — | Done |
| `_MARNM` (also `_MARN`) | AQ, PAF5, BKW6, "several programs and websites" | Married name | typed → `names[]` with `TYPE MARRIED` | — | Done |
| `_AKA` / `_AKAN` | AQ, PAF4/5, BKW6 | "Also known as" name | typed → `names[]` with `TYPE AKA` | — | Done |
| `_UPD` | MyHeritage | Record last-updated timestamp | typed → `IndividualRecord.updatedAt` / `FamilyRecord.updatedAt` | — | Done |
| `_WT_OBJE_SORT` | webtrees | Per-link media sort order | typed → `media` (like OBJE, array order preserves the sort) | — | Done |
| `_DATE` | Legacy (under OBJE), webtrees | Date of a media object | typed → `MultimediaRecord.date` | — | Done |
| `_EMAIL` | BKW6, FO9, PAF | E-mail under an address block | typed → `AddressStructure.email` | — | Done |

### 7.3 P2 — worth considering

| Tag | Vendors | Meaning | Model today | Effort | Recommend |
| --- | --- | --- | --- | --- | --- |
| `_NONE` | Legacy | "Couple had no children" under FAM | typed → `attributes` `NCHI 0` | — | Done |
| `_MILT` / `_MDCL` / `_DCAUSE` / `_FOOT` | FTM | Military service / medical / death cause / footnote facts | typed → `EVEN`+TYPE; `_DCAUSE` → `DEAT.CAUS` | — | Done |
| `_STAT` (FAM) | Legacy | Marriage status (Married, Unmarried, …) | typed → `FamilyRecord.marriageStatus` | — | Done |
| Gramps witness convention | Gramps | `ASSO @xref@` + `TYPE INDI` + `RELA <role>` under **family events** | typed → `EventDetail.associations` (like `_SHAR`) | — | Done |
| `_CREF`, `_FULL` | TMG (via T2G) | Citation reference / formatted footnote text | typed → `SourceCitation.reference` / `SourceRecord.fullFootnote` | — | Done |
| `_TYPE` under OBJE | AQ, FO7, PAF5, Legacy | Media object kind (Photo/Sound/Video) | typed → `MultimediaRecord.objectType` | — | Done |
| `_SCBK`, `_SSHOW` | AQ, FO7, PAF5 | Scrapbook / slideshow media flags | typed → `MultimediaLink.scrapbook` / `slideshow` | — | Done |
| `_PRIMARY` | AQ, PAF5 | Primary family for an adopted child | typed → `ChildFamilyLink.primary` | — | Done |
| `_URL` under INDI | Legacy | Web address of a person | typed → `IndividualRecord.url` | — | Done |
| `_PRIV` under events | Legacy | Event marked private | typed → `EventDetail.restriction` PRIVACY | — | Done |
| `_PRIV` under ADDR | Legacy | Address marked private | typed → `AddressStructure.private` | — | Done |
| `_PREF` | Legacy | Preferred spouse / child / parents | typed → `SpouseFamilyLink.preferred`, `FamilyChildLink.preferred`, `ChildFamilyLink.preferred` | — | Done |
| `_VERI` | Legacy | Verified checkmark on citations and places | typed → `SourceCitation.verified`, `PlaceStructure.verified` | — | Done |

### 7.4 P3 — single-vendor housekeeping

Resolved: every data-bearing tag in this family is typed, everything
else moved to P4.

**Legacy data tags — typed** (Legacy cat. "Custom GEDCOM Tags"): `_STAT`
under CHIL → `FamilyChildLink.multiplicity` (free text: the vendor
writes "Twin, Triplet, etc."); the `_TODO` record with `_CAT`/`_CDATE`/
`_LOCL`/`_RDATE` → `TodoRecord`; `_TAG`/`_TAG2`–`_TAG9` →
`IndividualRecord.marks` (slots kept, gaps stay empty); `_SOUND` →
`MultimediaRecord.soundFile`; `_NAME` under ADDR →
`AddressStructure.name` (see the PAF family).

**Brother's Keeper descriptors** (BKW6) — **typed**: name variants
(`_BIRN` → NAME TYPE BIRTH; `_ADPN`/`_CENN`/`_CURN`/`_FARN`/`_FKAN`/
`_GERN`/`_HEBN`/`_INDN`/`_OTHN`/`_RELN`/`_SHON`/`_SLDN` → NAME TYPE
OTHER with a PHRASE label; `_AKAN`/`_MARN` were already typed in P1);
physical descriptors (`_EYEC`/`_HAIR`/`_HEIG`/`_WEIG` → FACT + TYPE);
ceremonies (`_BRTM`/`_FNRL`/`_INTE`/`_YART` → EVEN + TYPE);
marriage-related (`_COML` → MARR + TYPE, `_MBON`/`_SEPR` → FAM.EVEN +
TYPE); `_PRMN` → REFN; the negatives `_NLIV`/`_NMAR`/`_NMR` → bare NO
DEAT / NO MARR (5.5.1 writes them back as `_NLIV`/`_NMAR`).

**Family Tree Maker extras — typed**: `_EXCM` and `_MISN` → EVEN +
TYPE; `_UNKN` → the UID identifier. The rest moved to P4.

**MyHeritage**: `_UPD` is in P1; no other documented tags.

**GEDKeeper**: `_UID` and the `_SHAR` family — already typed; nothing
else documented.

### 7.5 P4 — presentation and UI state

Pure report/interface data; a viewer that ignores these loses nothing
genealogical. Preserved verbatim as generic extensions; revisit only if
the corpus shows a concrete use.

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
definitions, `_DETS` and `_ELEC` (undocumented meaning), the GEDCOM
5.3 schema block (`_SCHEMA`/`SCHEMA`, `DEFN`, `LABL`, `ISA`) — and the
FTW marriage statuses `_MSTAT`/`_MEND` (beginning/ending status under
MARR; the meaning collides with `_STAT`, the writing product is
discontinued).

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
family with Legacy above.) The `_NAME` under ADDR (the name of the
addressee) is data and is typed → `AddressStructure.name`.

### 7.6 P5 — non-underscore vendor tags

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

These are currently **strict errors** in the parser (not `_`-prefixed,
so they bypass the extension path). Options to decide, in increasing
order of strictness:

1. accept the known list as generic extensions on input (documented,
   re-emitted verbatim);
2. accept any unknown tag as an extension (maximum leniency — against
   the strict-by-default principle);
3. keep rejecting them (today's behavior) and file them in "Known
   strict decisions".

The inventory says: keep rejecting for now; revisit after the corpus
run shows which of these actually appear in modern files.
