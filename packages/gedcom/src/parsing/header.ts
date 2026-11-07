/**
 * Parser section: Header.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  fail,
} from '../errors';
import {
  GEDCOM_555_TAG_ALIASES,
} from './gedcom-555';
import type {
  AncestryTreeStructure,
  Corporation,
  DatasetStatistics,
  ElfDefinition,
  FtmSchemaBlock,
  FtmSchemaEntry,
  Gedcom,
  GedcomAddendum,
  Header,
  HeaderPlace,
  HeaderSource,
  HeaderSourceData,
  OriginalSourceStructure,
  Schema,
  SchemaPrefix,
  TagDefinitionStructure,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  addExtension,
  dispatch,
  merge551RecordContacts,
  noPayload,
  one,
  reqPtr,
  reqText,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseAddressStructure,
  parseDateExactStructure,
  parseNoteStructure,
} from './substructures';
import {
  parseVendorFlag,
} from './sources-media';
import {
  normalizeCharset551,
} from './decode';
import {
  parseListText,
  parseTagDefinition,
} from './types';

// Header
// ---------------------------------------------------------------------------

export function parseHeader(node: RawNode, ctx: Ctx): Header {
  noPayload(node);
  if (node.xref !== undefined) {
    fail('line.xref-on-substructure', 'The HEAD pseudo-structure must not have a cross-reference identifier', node.position);
  }
  const header: Omit<Header, 'gedcom'> = { tag: 'HEAD' };
  let gedcom: Gedcom | undefined;
  // HEAD.NOTE {0:1} — GEDCOM 7.0 §3.2.1 gives the header one
  // NOTE_STRUCTURE, so the inline NOTE and the SNOTE pointer forms are
  // mutually exclusive; 5.5.1 only knows the inline form.
  const setNote = (child: RawNode): void => {
    if (header.note !== undefined) {
      // First occurrence wins (the full-leniency container rule).
      return;
    }
    header.note = parseNoteStructure(child, ctx);
  };
  dispatch(
    node,
    header,
    {
      GEDC: (child) => {
        if (gedcom !== undefined) {
          // First occurrence wins.
          return;
        }
        gedcom = parseGedc(child, ctx);
      },
      SCHMA: (child) => {
        header.schema = parseSchema(child, ctx);
      },
      SNOTE: (child) => {
        // The 7.0 HEAD carries <<NOTE_STRUCTURE>> {0:1}; the
        // shared-note pointer form is accepted in any file.
        setNote(child);
      },
      SOUR: (child) => {
        header.source = parseHeaderSource(child, ctx);
      },
      DEST: (child) => {
        header.destination = reqText(child);
      },
      WWW: (child) => {
        // The web address(es) of the dataset, written directly under
        // the header (see Header.www).
        (header.www ??= []).push(reqText(child));
      },
      DATE: (child) => {
        // GEDCOM 5.5.1 §2 Record Structures (p.23) allows a TIME under
        // HEAD.DATE (TRANSMISSION_DATE), like 7.0's HEAD-DATE. The
        // MyHeritage `_TIMEZONE` child (see Header.timezone) is typed
        // separately, so it is stripped before the date parse.
        const timezone = child.children.find((grandchild) => grandchild.tag === '_TIMEZONE');
        const dateNode = timezone === undefined
          ? child
          : { ...child, children: child.children.filter((grandchild) => grandchild.tag !== '_TIMEZONE') };
        header.date = parseDateExactStructure(dateNode, ctx);
        if (timezone !== undefined) {
          header.timezone = reqText(timezone);
        }
      },
      SUBM: (child) => {
        header.submitter = reqPtr(child, ctx);
        // A pointer line has no standard children in either version;
        // Aldfaer writes the submitter's contact lines (PHON, _EMAI,
        // _FAX, _WWW, ADDR) beneath HEAD.SUBM anyway (the webtrees
        // per-vendor custom-tag registry, Aldfaer.php:
        // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Aldfaer.php).
        // They are kept verbatim as header extensions instead of being
        // discarded (the nesting is normalized to the header level on
        // export). The Family Echo NAME child types into
        // Header.submitterName.
        for (const grandchild of child.children) {
          if (grandchild.tag === 'NAME') {
            header.submitterName = reqText(grandchild);
            continue;
          }
          addExtension(header, grandchild, ctx);
        }
      },
      SUBN: (child) => {
        header.submission = reqPtr(child, ctx);
      },
      FILE: (child) => {
        header.fileName = reqText(child);
      },
      COPR: (child) => {
        header.copyright = reqText(child);
      },
      LANG: (child) => {
        header.language = parseLanguage(child, ctx);
      },
      PLAC: (child) => {
        header.place = parseHeaderPlace(child, ctx);
      },
      _HOME: (child) => {
        // Ages! / Ahnenblatt: the start person shown after opening the
        // file, a person reference (see Header.startPerson); GEDitCOM
        // spells the same fact `_HME`.
        header.startPerson = reqPtr(child, ctx);
      },
      _HME: (child) => {
        header.startPerson = reqPtr(child, ctx);
      },
      _NAVI: (child) => {
        // Ahnenblatt: the Navigator-view start person (see
        // Header.startPerson).
        header.startPerson = reqPtr(child, ctx);
      },
      _NAVM: (child) => {
        // Ahnenblatt: the mode choosing the Navigator start person,
        // one of 0, 1, 2 (see Header.startPersonMode).
        const value = reqText(child);
        if (value !== '0' && value !== '1' && value !== '2') {
          fail('enum.invalid-value', `The _NAVM value must be 0, 1 or 2, not "${value}"`, child.position);
        }
        header.startPersonMode = value;
      },
      _PROJECT_GUID: (child) => {
        // MyHeritage: the project identifier of the tree (see
        // Header.projectGuid).
        header.projectGuid = reqText(child);
      },
      _EXPORTED_FROM_SITE_ID: (child) => {
        // MyHeritage: the site the tree was exported from (see
        // Header.exportedFromSiteId).
        header.exportedFromSiteId = reqText(child);
      },
      _RINS: (child) => {
        // MyHeritage: the record counts of the exported tree (see
        // Header.recordCounts).
        header.recordCounts = reqText(child);
      },
      _DESCRIPTION_AWARE: (child) => {
        // MyHeritage: the export includes descriptions (see
        // Header.descriptionAware).
        header.descriptionAware = parseVendorFlag(child, '_DESCRIPTION_AWARE');
      },
      _TITL: (child) => {
        // My Family Tree: the title of the tree (see Header.title).
        header.title = reqText(child);
      },
      _UID: (child) => {
        // MyHeritage / Family Historian: the unique identifier of the
        // dataset (see Header.uid).
        header.uid = reqText(child);
      },
      _STS: (child) => {
        // My Family Tree: the dataset statistics block (see
        // Header.statistics): one count line per record type.
        noPayload(child);        const stats: DatasetStatistics = { tag: '_STS' };
        dispatch(
          child,
          stats,
          {
            INDI: (count) => {
              stats.individuals = reqText(count);
            },
            FAM: (count) => {
              stats.families = reqText(count);
            },
            REPO: (count) => {
              stats.repositories = reqText(count);
            },
            SOUR: (count) => {
              stats.sources = reqText(count);
            },
            NOTE: (count) => {
              stats.notes = reqText(count);
            },
            SUBM: (count) => {
              stats.submitters = reqText(count);
            },
            OBJE: (count) => {
              stats.media = reqText(count);
            },
            _TASK: (count) => {
              stats.tasks = reqText(count);
            },
          },
          ctx,
          ['INDI', 'FAM', 'REPO', 'SOUR', 'NOTE', 'SUBM', 'OBJE', '_TASK'],
        );
        header.statistics = stats;
      },
      NOTE: (child) => {
        setNote(child);
      },
      CHAR: (child) => {
        parseCharacterSetStructure(child, ctx);
      },
      SCHEMA: (child) => {
        if (header.schema53 !== undefined) {
          // First occurrence wins.
          return;
        }
        header.schema53 = parseSchema53(child, ctx);
        fillSchema53Labels(header.schema53, ctx);
      },
      _SCHEMA: (child) => {
        // The Family Tree Maker spelling of the same block.
        if (header.schema53 !== undefined) {
          // First occurrence wins.
          return;
        }
        header.schema53 = parseSchema53(child, ctx);
        fillSchema53Labels(header.schema53, ctx);
      },
      _ORGSOUR: (child) => {
        // The product that originally wrote the data (see
        // Header.originalSource): NAME and VERS children carry the
        // foreign SOUR.NAME/SOUR.VERS.
        const entry: OriginalSourceStructure = { tag: '_ORGSOUR' };
        dispatch(
          child,
          entry,
          {
            NAME: (grandchild) => {
              entry.name = reqText(grandchild);
            },
            VERS: (grandchild) => {
              entry.version = reqText(grandchild);
            },
          },
          ctx,
          ['NAME', 'VERS'],
        );
        header.originalSource = entry;
      },
    },
    ctx,
    ['SCHMA', 'SOUR', 'DEST', 'DATE', 'SUBM', 'SUBN', 'FILE', 'COPR', 'LANG', 'PLAC', 'NOTE', 'CHAR', 'SCHEMA', '_ORGSOUR'],
  );
  if (gedcom === undefined) {
    // A header without GEDC is tolerated (the full-leniency container
    // rule): the block is synthesized with the 5.5.1 default, which
    // is what the version gate and the at-sign escape rule already
    // assume for such files.
    gedcom = { version: '5.5.1' };
  }
  // The 5.5.1 spec requires the HEAD.SOUR substructure; 7.0 does not.
  // A missing SOUR is accepted (it must not
  // depend on the declared version).
  return { ...header, gedcom };
}

export function parseGedc(node: RawNode, ctx: Ctx): Gedcom {
  noPayload(node);
  // A missing or value-less VERS is tolerated (the full-leniency
  // container rule): the version defaults to 5.5.1, the value the
  // version gate assumes for such files.
  const versNode = one(node, 'VERS');
  const gedcom: Gedcom = {
    version: versNode !== undefined && versNode.value.kind === 'text' ? versNode.value.text : '5.5.1',
  };
  // The version gate reads only the format lineage: the parser
  // accepts every file declaring a dotted version number, and
  // nothing else. The declared value does not select a grammar —
  // both pipelines parse the same import grammar (see the README's
  // Known strict decisions). The whole 5.x family is accepted (the
  // full-leniency container rule): files in the wild declare the
  // superseded drafts 5.3/5.4 and odd patch levels (5.50, 5.01)
  // whose record grammar is close enough to 5.5.1 that rejecting
  // them would lose the whole document. The pre-5.x versions (1.0,
  // 4.0, 4.18 — the PAF-era GEDs exports) are accepted the same way:
  // the full leniency keeps their unknown tags generic instead of
  // failing mid-file. The `GEDCOM ` prefix (`VERS GEDCOM 5.5`, the
  // WJTHOMAS exports) and a trailing typo (`5.5.1n`, the
  // student-test files) are tolerated — the value survives verbatim
  // in Gedcom.version.
  const declared = gedcom.version.replace(/^GEDCOM\s+/i, '').trim();
  if (!/^\d+(\.\d+)*/.test(declared)) {
    fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a supported GEDCOM version (a 7.x version or any 5.x version)`, node.position);
  }
  // The GEDCOM-L addendum declarations under GEDC.VERS (see
  // Gedcom.addenda) — the only documented children of the VERS line;
  // several addenda may be declared ({0:M}).
  if (versNode !== undefined) {
    dispatch(
      versNode,
      gedcom,
      {
        _ADDENDUM: (child) => {
          (gedcom.addenda ??= []).push(parseGedcomAddendum(child, ctx));
        },
      },
      ctx,
    );
  }
  // FORM is optional (5.5.1 requires it, 7.0
  // rejects it); when present, any value is tolerated (the
  // full-leniency container rule — files in the wild write
  // LINEAGE_LINKED, JSON-LD, …).
  const formNode = one(node, 'FORM');
  if (formNode !== undefined) {
    gedcom.form = reqText(formNode);
    // GEDCOM 5.5.5 added GEDC.FORM.VERS (a version number for the
    // GEDCOM form, distinct from GEDC.VERS; 5.5.5 §1 p.49–50). The
    // package does not store it — the writers emit 5.5.1 and 7.0,
    // neither of which has the slot — so the line is accepted and
    // discarded (its cardinality is still checked).
    one(formNode, 'VERS');
    dispatch(formNode, { }, { VERS: () => undefined }, ctx);
  }
  dispatch(node, gedcom, { VERS: () => undefined, FORM: () => undefined }, ctx);
  return gedcom;
}

/**
 * Parses the GEDCOM-L addendum declaration `_ADDENDUM` under GEDC.VERS
 * (see Gedcom.addenda): the addendum's name as the payload
 * (`3 _ADDENDUM GEDCOM-L Addendum`, `n _ADDENDUM <ADDENDUM_NAME>
 * {1:80}` in the spec — some files omit it, so it stays optional),
 * plus the addendum's own version and web address ("GEDCOM 5.5.1
 * Specification GEDCOM-L Addendum", §7.3, 2nd release, 2020-12-01,
 * eds. A. Emmerich & D. Hesmer).
 */
export function parseGedcomAddendum(node: RawNode, ctx: Ctx): GedcomAddendum {
  const out: GedcomAddendum = {
    tag: '_ADDENDUM',
    ...(node.value.kind === 'text' ? { payload: node.value.text } : {}),
  };
  dispatch(
    node,
    out,
    {
      VERS: (child) => {
        out.version = reqText(child);
      },
      WWW: (child) => {
        out.www = reqText(child);
      },
    },
    ctx,
    ['VERS', 'WWW'],
  );
  return out;
}

export function parseSchema(node: RawNode, ctx: Ctx): Schema {
  noPayload(node);
  const schema: Schema = { tagDefinitions: [] };
  dispatch(
    node,
    schema,
    {
      TAG: (child) => {
        schema.tagDefinitions.push(parseTagDefinitionStructure(child));
      },
      PRFX: (child) => {
        // The ELF prefix declaration (see Schema.prefixes): the prefix
        // tag and the IRI it abbreviates, whitespace-separated.
        const [prefix, uri, ...rest] = reqText(child).split(' ');
        if (prefix === undefined || uri === undefined || rest.length > 0 || prefix === '' || uri === '') {
          fail('tagdef.invalid', `The PRFX value must be "<tag> <uri>", got "${reqText(child)}"`, child.position);
        }
        const entry: SchemaPrefix = { tag: 'PRFX', prefix, uri };
        (schema.prefixes ??= []).push(entry);
        dispatch(child, entry, {}, ctx);
      },
      IRI: (child) => {
        // The ELF tag declaration (see Schema.elfDefinitions): the IRI
        // payload with the TAG, ISA and LANG children.
        const entry: ElfDefinition = { tag: 'IRI', iri: reqText(child) };
        dispatch(
          child,
          entry,
          {
            TAG: (grandchild) => {
              (entry.tagValues ??= []).push(reqText(grandchild));
            },
            ISA: (grandchild) => {
              (entry.parents ??= []).push(reqText(grandchild));
            },
            LANG: (grandchild) => {
              entry.language = reqText(grandchild);
            },
          },
          ctx,
        );
        (schema.elfDefinitions ??= []).push(entry);
      },
    },
    ctx,
  );
  // Fill the document's tag→URIs map (see Ctx.schemaTags): the date
  // parser resolves documented extension calendars and months through
  // it, and the SCHMA resolution of extension tags uses it (GEDCOM 7.0
  // §2.14 / §1.5.1 — one tag may carry several URIs; see
  // resolveDocumentedTag).
  for (const definition of schema.tagDefinitions) {
    const tag = definition.payload.tag;
    const uris = ctx.schemaTags.get(tag);
    if (uris === undefined) {
      ctx.schemaTags.set(tag, [definition.payload.uri]);
    } else {
      uris.push(definition.payload.uri);
    }
  }
  return schema;
}

export function parseTagDefinitionStructure(node: RawNode): TagDefinitionStructure {
  if (node.children.length > 0) {
    fail('structure.unexpected-payload', 'A TAG definition must not have substructures', (node.children[0] as RawNode).position);
  }
  return { payload: parseTagDefinition(reqText(node), node.position) };
}

export function parseHeaderSource(node: RawNode, ctx: Ctx): HeaderSource {
  const source: HeaderSource = { payload: reqText(node) };
  dispatch(
    node,
    source,
    {
      VERS: (child) => {
        source.version = reqText(child);
      },
      NAME: (child) => {
        source.name = reqText(child);
      },
      CORP: (child) => {
        source.corporation = parseCorporation(child, ctx);
      },
      DATA: (child) => {
        source.data = parseHeaderSourceData(child, ctx);
      },
      _RTLSAVE: (child) => {
        // MyHeritage: the right-to-left save mode (see
        // HeaderSource.rtlSave).
        source.rtlSave = reqText(child);
      },
      WWW: (child) => {
        // Family Echo and other exporters: the web address of the
        // source product, written under HEAD.SOUR (see
        // HeaderSource.www). Neither standard has the slot; the value
        // is a URL.
        source.www = reqText(child);
      },
      _TREE: (child) => {
        // Ancestry.com: the tree the export came from (see
        // HeaderSource.tree). The payload is the tree id; the NOTE
        // and RIN children are typed, everything else stays generic.
        const tree: AncestryTreeStructure = {
          tag: '_TREE',
          ...(child.value.kind === 'text' ? { id: child.value.text } : {}),
        };
        dispatch(
          child,
          tree,
          {
            NOTE: (grandchild) => {
              tree.note = reqText(grandchild);
            },
            RIN: (grandchild) => {
              tree.rin = reqText(grandchild);
            },
            _ENV: (grandchild) => {
              // The Ancestry environment the export came from (see
              // AncestryTreeStructure.environment).
              tree.environment = reqText(grandchild);
            },
          },
          ctx,
          ['NOTE', 'RIN', '_ENV'],
        );
        source.tree = tree;
      },
    },
    ctx,
  );
  return source;
}

export function parseCorporation(node: RawNode, ctx: Ctx): Corporation {
  const corp: Corporation = { payload: reqText(node) };
  dispatch(
    node,
    corp,
    {
      ADDR: (child) => {
        corp.address = parseAddressStructure(child, ctx);
      },
      PHON: (child) => {
        (corp.phone ??= []).push(reqText(child));
      },
      EMAIL: (child) => {
        (corp.email ??= []).push(reqText(child));
      },
      FAX: (child) => {
        (corp.fax ??= []).push(reqText(child));
      },
      WWW: (child) => {
        (corp.www ??= []).push(reqText(child));
      },
    },
    ctx,
  );
  merge551RecordContacts(corp);
  return corp;
}

export function parseHeaderSourceData(node: RawNode, ctx: Ctx): HeaderSourceData {
  const data: HeaderSourceData = { payload: reqText(node) };
  dispatch(
    node,
    data,
    {
      DATE: (child) => {
        data.date = parseDateExactStructure(child, ctx);
      },
      COPR: (child) => {
        data.copyright = reqText(child);
      },
    },
    ctx,
  );
  return data;
}

export function parseHeaderPlace(node: RawNode, ctx: Ctx): HeaderPlace {
  noPayload(node);
  // A missing or value-less FORM is tolerated (the full-leniency
  // container rule).
  const formNode = one(node, 'FORM');
  const place: HeaderPlace =
    formNode !== undefined && formNode.value.kind === 'text' ? { form: parseListText(formNode.value.text) } : {};
  dispatch(node, place, { FORM: () => undefined }, ctx);
  return place;
}

/* Validates the 5.5.1 CHAR line; the declared value selects the
 * decoder (checked earlier by the charset detection) and is not stored
 * in the model. CHAR.VERS is accepted and discarded. */
export function parseCharacterSetStructure(node: RawNode, ctx: Ctx): void {
  const text = reqText(node);
  if (normalizeCharset551(text) === undefined) {
    fail('charset.invalid', `Unknown character set "${text}"; expected ANSEL, UTF-8, UNICODE, ASCII, CP1252, CP850, or MACINTOSH`, node.position);
  }
  dispatch(
    node,
    { },
    { VERS: () => undefined },
    ctx,
  );
}

/**
 * Parses the GEDCOM 5.3 SCHEMA block: context chains of tags ending in
 * the declared user tag, with LABL/DEFN/ISA leaves beneath it (GEDCOM
 * 5.3 `USER_TAG_SCHEMA`, p.25–26 of the Tamura Jones PDF). The context
 * tags carry no payloads; the leaves are payload texts and have no
 * substructures of their own.
 */
export function parseSchema53(node: RawNode, ctx: Ctx): FtmSchemaBlock {
  noPayload(node);
  const out: FtmSchemaBlock = { tag: 'SCHEMA', entries: [] };
  for (const child of node.children) {
    collectSchemaEntry(child, [], out.entries, ctx);
  }
  return out;
}

/** Fills the Ctx.schema53Labels map: each declared tag's context chain
 *  (e.g. `INDI/_FA1`) mapped to its LABL text — the `_FA1`–`_FA13`
 *  fact handlers resolve their TYPE from it. Entries without a LABL
 *  are skipped (the handlers fall back to `Fact n`). */
function fillSchema53Labels(block: FtmSchemaBlock, ctx: Ctx): void {
  for (const entry of block.entries) {
    if (entry.label !== undefined) {
      ctx.schema53Labels.set(entry.context.join('/'), entry.label);
    }
  }
}

/** Walks one branch of the SCHEMA tree, collecting the declaration leaves. */
function collectSchemaEntry(node: RawNode, context: string[], entries: FtmSchemaEntry[], ctx: Ctx): void {
  // The 5.5.5 full-word spellings of the declaration leaves (the
  // official FTM sample writes `4 LABEL Fact 1`): the alias resolves
  // before the leaf check.
  const tag = GEDCOM_555_TAG_ALIASES[node.tag] ?? node.tag;
  if (tag === 'LABL' || tag === 'DEFN' || tag === 'ISA' || tag === '_DEFN') {
    const key = context.join('/');
    let entry = entries[entries.length - 1];
    if (entry === undefined || entry.context.join('/') !== key) {
      entry = { context: [...context] };
      entries.push(entry);
    }
    if (tag === 'LABL') {
      if (entry.label !== undefined) {
        // First occurrence wins (the full-leniency container rule).
        return;
      }
      entry.label = reqText(node);
    } else if (tag === 'DEFN' || tag === '_DEFN') {
      // The underscore spelling is the GEDCOM-L convention (agreement
      // Nutzerdef.N5; see the GenWiki "GEDCOM/_Nutzerdef-Tag" article:
      // https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag): the
      // `_SCHEMA` block of the German programs spells the definition
      // leaf `_DEFN`, where Family Tree Maker writes `DEFN`. Both name
      // the same declaration member.
      if (entry.definition !== undefined) {
        // First occurrence wins.
        return;
      }
      entry.definition = reqText(node);
    } else {
      if (entry.parent !== undefined) {
        // First occurrence wins.
        return;
      }
      entry.parent = reqText(node);
    }
    for (const grandchild of node.children) {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(entry, grandchild, ctx);
    }
    return;
  }
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', `The SCHEMA context tag ${node.tag} must not carry a value`, node.position);
  }
  for (const child of node.children) {
    collectSchemaEntry(child, [...context, node.tag], entries, ctx);
  }
}

export function parseLanguage(node: RawNode, _ctx: Ctx): string {
  // The language is kept as free text (the 7.0 rule; the 5.5.1
  // LANGUAGE_ID table is a closed list the import no longer
  // validates — the serializer maps onto it on export).
  return reqText(node);
}

// ---------------------------------------------------------------------------
