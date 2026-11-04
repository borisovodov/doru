/**
 * Parser section: Sources and media links.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  EVENT_ATTRIBUTE_ENUM_VALUES,
  QUALITY_ENUM_VALUES,
} from '../enumerations';
import type {
  EventAttributeEnum,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  CallNumberStructure,
  CropStructure,
  MultimediaLink,
  MultimediaRecord,
  PageStructure,
  SourceCitation,
  SourceCitationData,
  SourceCitationEvent,
  SourceMetafieldStructure,
  SourceRepositoryCitation,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  addExtension,
  dispatch,
  noPayload,
  optPtr,
  reqDigits,
  reqPtr,
  reqText,
  resolvePtr,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseMediaFile,
  parseMediaStructure,
} from './media';
import {
  parseEvidenceTemplate,
  parseMftSourceQuality,
  parseSourceText,
} from './sources';
import {
  parseDateStructure,
  parseNoteStructure,
  parseRole,
} from './substructures';
import {
  parseEnum,
} from './types';

// Sources and media links
// ---------------------------------------------------------------------------

/**
 * Parses a PAGE structure: the location payload plus the relocated
 * `_SOUR` citations (registry: _SOUR.yaml — the standard SOUR tag moved
 * under PAGE, with the same payload and substructures as
 * SOURCE_CITATION). Other `_` tags under PAGE stay generic extensions
 * of the page structure, so their position is preserved too.
 */
export function parsePageStructure(node: RawNode, ctx: Ctx): PageStructure {
  const out: PageStructure = { tag: 'PAGE', payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      _SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

/** Parses an FH source-template metafield under a citation
 *  (`_FIELD <name>` with a `TEXT <value>` child; see
 *  SourceMetafieldStructure). */
function parseSourceMetafield(node: RawNode, ctx: Ctx): SourceMetafieldStructure {
  const out: SourceMetafieldStructure = { tag: '_FIELD', name: reqText(node) };
  dispatch(
    node,
    out,
    {
      TEXT: (child) => {
        out.text = reqText(child);
      },
    },
    ctx,
    ['TEXT'],
  );
  return out;
}

export function parseSourceCitation(node: RawNode, ctx: Ctx): SourceCitation {
  // Both payload forms parse: the 7.0 pointer form and the 5.5.1 free-text
  // description form are both accepted in any file (the payload shape
  // selects the form, not the declared version).
  if (node.value.kind === 'pointer') {
    const out: SourceCitation = { tag: 'SOUR', source: resolvePtr(node.value.pointer, ctx, node) };
    dispatch(
      node,
      out,
      {
        PAGE: (child) => {
          out.page = parsePageStructure(child, ctx);
        },
        DATA: (child) => {
          out.data = parseSourceCitationData(child, ctx);
        },
        EVEN: (child) => {
          out.event = parseSourceCitationEvent(child, ctx);
        },
        QUAY: (child) => {
          out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, child.position);
        },
        OBJE: (child) => {
          (out.media ??= []).push(parseMultimediaLink(child, ctx));
        },
        NOTE: (child) => {
          (out.notes ??= []).push(parseNoteStructure(child, ctx));
        },
        SNOTE: (child) => {
          // The 7.0 SOURCE_CITATION carries <<NOTE_STRUCTURE>> {0:M}
          // (GEDCOM 7.0 §3.2.3); accepted in any file.
          (out.notes ??= []).push(parseNoteStructure(child, ctx));
        },
        '_APID': (child) => {
          (out.ancestryPointers ??= []).push(reqText(child));
        },
        '_CREF': (child) => {
          out.reference = reqText(child);
        },
        REFN: (child) => {
          // A reference number of the citation itself (see
          // SourceCitation.referenceNumber).
          out.referenceNumber = reqText(child);
        },
        RIN: (child) => {
          // The citation's record id in the source system (see
          // SourceCitation.automatedRecordId).
          out.automatedRecordId = reqText(child);
        },
        '_ABBR': (child) => {
          // FTM: the cited source's short title (see
          // SourceCitation.abbreviation).
          out.abbreviation = reqText(child);
        },
        WWW: (child) => {
          // The web address of the cited material, directly under the
          // citation (see SourceCitation.www).
          out.www = reqText(child);
        },
        REF: (child) => {
          // The findmypast spelling of the citation's web address
          // (`3 REF http://search.findmypast.com/record?id=…`, the
          // findmypast gedcom-samples exports) — the same slot `WWW`
          // carries (see SourceCitation.www).
          out.www = reqText(child);
        },
        '_WPID': (child) => {
          // MyHeritage: the wife's person id under a marriage citation
          // (see SourceCitation.wifePersonId).
          out.wifePersonId = reqText(child);
        },
        '_HPID': (child) => {
          // MyHeritage: the husband's person id under a marriage
          // citation (see SourceCitation.husbandPersonId).
          out.husbandPersonId = reqText(child);
        },
        '_FOOT': (child) => {
          // The footnote text of the citation (see
          // SourceCitation.footnote).
          out.footnote = reqText(child);
        },
        '_SUBQ': (child) => {
          // RootsMagic: the subsequent-citation format (report wording).
          out.subsequentCitationFormat = reqText(child);
        },
        '_VERI': (child) => {
          out.verified = parsePrivacyFlag(child, '_VERI');
        },
        '_CONF': (child) => {
          // The confidence level of the citation (see
          // SourceCitation.confidence); a value-less line stays a
          // generic extension.
          if (child.value.kind === 'text') {
            out.confidence = child.value.text;
          } else {
            addExtension(out, child, ctx);
          }
        },
        'NAME': (child) => {
          // The name of the cited source, under the citation (see
          // SourceCitation.name); a value-less line stays a generic
          // extension.
          if (child.value.kind === 'text') {
            out.name = child.value.text;
          } else {
            addExtension(out, child, ctx);
          }
        },
        '_QUAL': (child) => {
          // The MFT7 source-quality block under the citation (see
          // SourceCitation.qualityAssessment).
          out.qualityAssessment = parseMftSourceQuality(child, ctx);
        },
        '_QUAY': (child) => {
          // FH7: the citation assessment options (see
          // SourceCitation.assessment).
          out.assessment = reqText(child);
        },
        '_FIELD': (child) => {
          (out.metafields ??= []).push(parseSourceMetafield(child, ctx));
        },
        '_SUBM': (child) => {
          // GDO: a pointer to the submitter record of this citation
          // (see SourceCitation.submitter).
          out.submitter = reqPtr(child, ctx);
        },
        '_TMPLT': (child) => {
          // RootsMagic: the Evidence Explained source template of the
          // citation — its actual write position (the record-level
          // `_TMPLT` is the other; see SourceCitation.template).
          out.template = parseEvidenceTemplate(child, ctx);
        },
        '_LINK': (child) => {
          // FTM: an internet link associated with the source (see
          // SourceCitation.links).
          (out.links ??= []).push(reqText(child));
        },
        'RINI': (child) => {
          // USM6: who found the source information (see
          // SourceCitation.foundBy).
          out.foundBy = reqText(child);
        },
        '_RINI': (child) => {
          // The underscore write-back spelling of the USM6 RINI (the
          // USM6 wire spelling is non-underscore; see
          // SourceCitation.foundBy for the export rule).
          out.foundBy = reqText(child);
        },
        'TEXT': (child) => {
          // Généatique writes the citation text with the standard TEXT
          // tag directly under the SOUR pointer (the webtrees per-vendor
          // custom-tag registry, Geneatique.php); the 5.5.1 grammar
          // places it under DATA. It normalizes into the same
          // data.texts slot the free-text SOUR form uses.
          out.data ??= {};
          (out.data.texts ??= []).push(parseSourceText(child, ctx));
        },
        'DATE': (child) => {
          // Legacy Family Tree writes the citation date directly under
          // the SOUR pointer (the canonical Legacy custom-tags sample,
          // `3 DATE 29 Sep 2016`); the 5.5.1 grammar places it under
          // DATA. It normalizes into the same data.date slot, with the
          // at-most-one rule of the standard position.
          out.data ??= {};
          if (out.data.date !== undefined) {
            // First occurrence wins.
            return;
          }
          out.data.date = parseDateStructure(child, ctx);
        },
      },
      ctx,
      ['PAGE', 'DATA', 'EVEN', 'QUAY'],
    );
    return out;
  }
  if (node.value.kind === 'absent') {
    fail('structure.missing-payload', 'The SOUR line requires a pointer or a source description', node.position);
  }
  const out: SourceCitation = { tag: 'SOUR', source: '@VOID@', description: node.value.text };
  dispatch(
    node,
    out,
    {
      PAGE: (child) => {
        // The 5.5.1 SOURCE_DESCRIPTION form keeps the full citation
        // grammar beneath it (GEDCOM 5.5.1 §2 p.39) — the same PAGE
        // slot the pointer form carries (see PageStructure).
        out.page = parsePageStructure(child, ctx);
      },
      TEXT: (child) => {
        out.data ??= {};
        (out.data.texts ??= []).push(parseSourceText(child, ctx));
      },
      QUAY: (child) => {
        out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, child.position);
      },
      REFN: (child) => {
        // A reference number of the citation itself (see
        // SourceCitation.referenceNumber).
        out.referenceNumber = reqText(child);
      },
      RIN: (child) => {
        // The citation's record id in the source system (see
        // SourceCitation.automatedRecordId).
        out.automatedRecordId = reqText(child);
      },
      '_ABBR': (child) => {
        // FTM: the cited source's short title (see
        // SourceCitation.abbreviation).
        out.abbreviation = reqText(child);
      },
      WWW: (child) => {
        // The web address of the cited material (see
        // SourceCitation.www).
        out.www = reqText(child);
      },
      REF: (child) => {
        // The findmypast spelling of the citation's web address (see
        // the pointer-form handler).
        out.www = reqText(child);
      },
      '_WPID': (child) => {
        // MyHeritage: the wife's person id under a marriage citation
        // (see SourceCitation.wifePersonId).
        out.wifePersonId = reqText(child);
      },
      '_HPID': (child) => {
        // MyHeritage: the husband's person id under a marriage
        // citation (see SourceCitation.husbandPersonId).
        out.husbandPersonId = reqText(child);
      },
      '_FOOT': (child) => {
        // The footnote text of the citation (see
        // SourceCitation.footnote).
        out.footnote = reqText(child);
      },
      '_APID': (child) => {
        // Ancestry: the record reference under the citation (see
        // SourceCitation.ancestryPointers).
        (out.ancestryPointers ??= []).push(reqText(child));
      },
      '_CREF': (child) => {
        // TMG-to-GEDCOM: the citation reference value (see
        // SourceCitation.reference).
        out.reference = reqText(child);
      },
      '_SUBQ': (child) => {
        // RootsMagic: the subsequent-citation format (see
        // SourceCitation.subsequentCitationFormat).
        out.subsequentCitationFormat = reqText(child);
      },
      '_VERI': (child) => {
        // Legacy: the verified checkmark (see SourceCitation.verified).
        out.verified = parsePrivacyFlag(child, '_VERI');
      },
      '_CONF': (child) => {
        // The confidence level of the citation (see
        // SourceCitation.confidence); a value-less line stays generic.
        if (child.value.kind === 'text') {
          out.confidence = child.value.text;
        } else {
          addExtension(out, child, ctx);
        }
      },
      'NAME': (child) => {
        // The name of the cited source, under the citation (see
        // SourceCitation.name); a value-less line stays generic.
        if (child.value.kind === 'text') {
          out.name = child.value.text;
        } else {
          addExtension(out, child, ctx);
        }
      },
      '_QUAL': (child) => {
        // The MFT7 source-quality block under the citation (see
        // SourceCitation.qualityAssessment).
        out.qualityAssessment = parseMftSourceQuality(child, ctx);
      },
      OBJE: (child) => {
        (out.media ??= []).push(parseMultimediaLink(child, ctx));
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      '_QUAY': (child) => {
        // FH7: the citation assessment options (see
        // SourceCitation.assessment).
        out.assessment = reqText(child);
      },
      '_FIELD': (child) => {
        (out.metafields ??= []).push(parseSourceMetafield(child, ctx));
      },
      '_SUBM': (child) => {
        // GDO: a pointer to the submitter record of this citation
        // (see SourceCitation.submitter).
        out.submitter = reqPtr(child, ctx);
      },
      '_LINK': (child) => {
        // FTM: an internet link associated with the source (see
        // SourceCitation.links).
        (out.links ??= []).push(reqText(child));
      },
      'RINI': (child) => {
        // USM6: who found the source information (see
        // SourceCitation.foundBy).
        out.foundBy = reqText(child);
      },
      '_RINI': (child) => {
        // The underscore write-back spelling of the USM6 RINI.
        out.foundBy = reqText(child);
      },
    },
    ctx,
    ['QUAY'],
  );
  return out;
}

export function parseSourceCitationData(node: RawNode, ctx: Ctx): SourceCitationData {
  noPayload(node);
  const out: SourceCitationData = {};
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      TEXT: (child) => {
        (out.texts ??= []).push(parseSourceText(child, ctx));
      },
      WWW: (child) => {
        // The web address of the cited material, under DATA (see
        // SourceCitationData.www).
        out.www = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseSourceCitationEvent(node: RawNode, ctx: Ctx): SourceCitationEvent {
  const raw = reqText(node);
  const out: SourceCitationEvent = {};
  // Both value forms parse: a known tag, a 7.0 extension value (`_…`), or a
  // user-supplied descriptor, "classified in the category of other"
  // (5.5.1 `EVENT_TYPE_CITED_FROM` p.49). The known tags and the
  // extension values go to `payload`, anything else to `userDefined`
  // verbatim.
  if (raw.startsWith('_')) {
    out.payload = raw as EventAttributeEnum;
  } else {
    const key = Object.keys(EVENT_ATTRIBUTE_ENUM_VALUES).find(
      (value) => value.toLowerCase() === raw.toLowerCase(),
    );
    if (key !== undefined) {
      out.payload = key as EventAttributeEnum;
    } else {
      out.userDefined = raw;
    }
  }
  const handlers: Record<string, (child: RawNode) => void> = {
    ROLE: (child) => {
      out.role = parseRole(child, ctx);
    },
    // The 7.0 PHRASE child under the event; accepted
    // it in any file.
    PHRASE: (child) => {
      out.phrase = reqText(child);
    },
  };
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseSourceRepositoryCitation(node: RawNode, ctx: Ctx): SourceRepositoryCitation {
  const pointer = optPtr(node, ctx);
  const out: SourceRepositoryCitation = { tag: 'REPO', repository: pointer ?? '@VOID@' };
  const handlers: Record<string, (child: RawNode) => void> = {
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    CALN: (child) => {
      (out.callNumbers ??= []).push(parseCallNumber(child, ctx));
    },
    // The 7.0 SOURCE_REPOSITORY_CITATION carries <<NOTE_STRUCTURE>>
    // {0:M} (GEDCOM 7.0 §3.2.3); accepted in any file.
    SNOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseCallNumber(node: RawNode, ctx: Ctx): CallNumberStructure {
  const out: CallNumberStructure = { payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      MEDI: (child) => {
        out.medium = parseMediaStructure(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

/** The Family Historian media-link display attributes (see
 *  MultimediaLink.sequence / area / excludeFromDiagrams / caption):
 *  `_SEQ` {0:1} a sequence number, `_AREA` {0:1} the display area
 *  (kept verbatim), `_EXCL` {0:1} and `_CAPT` {0:1} presence flags.
 *  Registered into the OBJE-pointer handlers of both versions. */
function fhMediaLinkHandlers(
  out: MultimediaLink,
): Record<string, (child: RawNode) => void> {
  return {
    '_SEQ': (child) => {
      out.sequence = reqDigits(child);
    },
    '_AREA': (child) => {
      out.area = reqText(child);
    },
    '_EXCL': (child) => {
      out.excludeFromDiagrams = parseFhPresenceFlag(child, '_EXCL');
    },
    '_CAPT': (child) => {
      out.caption = parseFhPresenceFlag(child, '_CAPT');
    },
  };
}

/** The Family Historian presence flags whose documented value is a
 *  bare tag or an explicit marker (`_EXCL ALL`, `_CAPT Y`; see the
 *  FHUG "GEDCOM Extension List"): an absent value, `Y`, `YES` or the
 *  `ALL` spelling marks the flag set; `N`/`NO` clears it. */
export function parseFhPresenceFlag(node: RawNode, tag: string): boolean {
  if (node.value.kind === 'absent') {
    return true;
  }
  const text = reqText(node).trim().toUpperCase();
  if (text === 'Y' || text === 'YES' || text === 'ALL') {
    return true;
  }
  if (text === 'N' || text === 'NO') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be a yes/no flag, not "${text}"`, node.position);
}

export function parseMultimediaLink(node: RawNode, ctx: Ctx): MultimediaLink {
  // Both forms parse: the pointer form (with the 7.0 CROP/TITL
  // children) and the 5.5.1 inline form (synthesized into a record)
  // are both accepted in any file — the payload shape selects the
  // form, not the declared version.
  if (node.value.kind === 'pointer') {
    const out: MultimediaLink = { tag: 'OBJE', object: resolvePtr(node.value.pointer, ctx, node) };
    dispatch(
      node,
      out,
      {
        CROP: (child) => {
          out.crop = parseCrop(child, ctx);
        },
        '_CROP': (child) => {
          // Ancestry.com Family Trees spells the crop block `_CROP`
          // with the underscore children (see parseCrop).
          out.crop = parseCrop(child, ctx);
        },
        TITL: (child) => {
          out.title = reqText(child);
        },
        SOUR: (child) => {
          // A citation under the inline media link (see
          // MultimediaLink.citations).
          (out.citations ??= []).push(parseSourceCitation(child, ctx));
        },
        '_PRIM': (child) => {
          out.primary = parseYNFlag(child, '_PRIM');
        },
        '_SCBK': (child) => {
          out.scrapbook = parseYNFlag(child, '_SCBK');
        },
        '_SSHOW': (child) => {
          out.slideshow = parseYNFlag(child, '_SSHOW');
        },
        '_THUM': (child) => {
          // Généatique: the thumbnail flag (see MultimediaLink.thumbnail).
          out.thumbnail = parseYNFlag(child, '_THUM');
        },
        ...fhMediaLinkHandlers(out),
      },
      ctx,
    );
    return out;
  }
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', 'The OBJE line takes a pointer or nothing', node.position);
  }
  const record: MultimediaRecord = { tag: 'OBJE', files: [] };
  let title: string | undefined;
  let primary: boolean | undefined;
  let scrapbook: boolean | undefined;
  let slideshow: boolean | undefined;
  let thumbnail: boolean | undefined;
  let fileSize: number | undefined;
  let album: string | undefined;
  let photoRecordId: string | undefined;
  // Legacy Family Tree writes the format directly under the inline
  // OBJE (`2 FORM jpg` beside `2 FILE …`); the 5.5.1 inline grammar
  // places it under FILE. It is injected into each FILE that lacks its
  // own FORM before parsing (the canonical Legacy custom-tags sample).
  const linkForm = node.children.find((child) => child.tag === 'FORM');
  dispatch(
    node,
    record,
    {
      FORM: () => undefined,
      FILE: (child) => {
        const hasOwnForm = child.children.some((grandchild) => grandchild.tag === 'FORM');
        const fileNode = linkForm !== undefined && !hasOwnForm
          ? { ...child, children: [linkForm, ...child.children] }
          : child;
        record.files.push(parseMediaFile(fileNode, ctx));
      },
      TITL: (child) => {
        title = reqText(child);
      },
      NOTE: (child) => {
        // The 5.5.1 inline MULTIMEDIA_LINK grammar (GEDCOM 5.5.1 §2
        // p.37) carries NOTE {0:M} at the link level; the note lands
        // on the synthesized multimedia record, which is written back
        // as a record on export.
        (record.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SOUR: (child) => {
        // A citation under the inline OBJE link (the Hutson
        // family-tree data attaches them to media links; see
        // MultimediaLink.citations). It lands on the synthesized
        // multimedia record, like the NOTE above.
        (record.citations ??= []).push(parseSourceCitation(child, ctx));
      },
      '_PRIM': (child) => {
        primary = parseYNFlag(child, '_PRIM');
      },
      '_SCBK': (child) => {
        scrapbook = parseYNFlag(child, '_SCBK');
      },
      '_SSHOW': (child) => {
        slideshow = parseYNFlag(child, '_SSHOW');
      },
      '_THUM': (child) => {
        // Généatique: the thumbnail flag (see MultimediaLink.thumbnail).
        thumbnail = parseYNFlag(child, '_THUM');
      },
      '_TYPE': (child) => {
        record.objectType = reqText(child);
      },
      '_SOUND': (child) => {
        record.soundFile = reqText(child);
      },
      '_KEYS': (child) => {
        // FH: the media object's keywords (see MultimediaRecord.keywords).
        record.keywords = reqText(child);
      },
      '_FILE': (child) => {
        // FH: the path of the media file (see MultimediaRecord.filePath).
        record.filePath = reqText(child);
      },
      '_NOTE': (child) => {
        // FH: a media note (see MultimediaRecord.mediaNote).
        record.mediaNote = reqText(child);
      },
      '_CREA': (child) => {
        // Ancestry.com Family Trees: the date the media object was
        // created (see MultimediaRecord.createdAt).
        record.createdAt = reqText(child);
      },
      DATE: (child) => {
        // The date of the media object under the inline link (the
        // same slot the record-level DATE carries; see
        // MultimediaRecord.date).
        record.date = parseDateStructure(child, ctx);
      },
      PLAC: (child) => {
        // The place of the media object under the inline link (the
        // WikiTree-style exports: `1 OBJE` / `2 FILE …` / `2 PLAC
        // AL.` — the same slot the record-level PLAC carries; see
        // MultimediaRecord.place).
        record.place = reqText(child);
      },
      '_CUTOUT': (child) => {
        // MyHeritage: the cutout flag (see MultimediaRecord.cutout).
        record.cutout = parseYNFlag(child, '_CUTOUT');
      },
      '_PRIM_CUTOUT': (child) => {
        // MyHeritage: the primary cutout mark (see
        // MultimediaRecord.primaryCutout).
        record.primaryCutout = parseYNFlag(child, '_PRIM_CUTOUT');
      },
      '_PARENTPHOTO': (child) => {
        // MyHeritage: the parent-photo flag (see
        // MultimediaRecord.parentPhoto).
        record.parentPhoto = parseYNFlag(child, '_PARENTPHOTO');
      },
      '_PERSONALPHOTO': (child) => {
        // MyHeritage: the personal-photo flag (see
        // MultimediaRecord.personalPhoto).
        record.personalPhoto = parseYNFlag(child, '_PERSONALPHOTO');
      },
      '_PARENTRIN': (child) => {
        // MyHeritage: the parent's record id (see
        // MultimediaRecord.parentRecordId).
        record.parentRecordId = reqText(child);
      },
      AUTH: (child) => {
        // ged4web: the media author under the OBJE record (see
        // MultimediaRecord.author).
        record.author = reqText(child);
      },
      '_TEXT': (child) => {
        // ged4web: the media comment text (the same slot the FH
        // `_NOTE` carries; see MultimediaRecord.mediaNote).
        record.mediaNote = reqText(child);
      },
      TEXT: (child) => {
        // The standard spelling of the media comment text.
        record.mediaNote = reqText(child);
      },
      '_DATE': (child) => {
        record.date = parseDateStructure(child, ctx);
      },
      '_FILESIZE': (child) => {
        // Family Tree Builder / MyHeritage: the media file size (see
        // MediaFile.fileSize).
        fileSize = reqDigits(child);
      },
      '_ALBUM': (child) => {
        // Family Tree Builder / MyHeritage: the album XREF (see
        // MediaFile.album; the wire form is xref-shaped, kept verbatim
        // and unresolved — real exports dangle).
        album = child.value.kind === 'pointer' ? child.value.pointer : reqText(child);
      },
      '_PHOTO_RIN': (child) => {
        // Family Tree Builder / MyHeritage: the photo's record id (see
        // MediaFile.recordId).
        photoRecordId = reqText(child);
      },
    },
    ctx,
  );
  if (record.files.length === 0) {
    // An inline OBJE without FILE is tolerated (the full-leniency
    // container rule).
  }
  const firstFile = record.files[0];
  if (firstFile !== undefined) {
    if (title !== undefined) {
      firstFile.title = title;
    }
    if (fileSize !== undefined) {
      firstFile.fileSize = fileSize;
    }
    if (album !== undefined) {
      firstFile.album = album;
    }
    if (photoRecordId !== undefined) {
      firstFile.recordId = photoRecordId;
    }
  }
  // Synthesize a multimedia record (the GEDCOM 7.0 normalization).
  let xref: string;
  do {
    xref = `@_SYNO${ctx.syntheticIndex}@`;
    ctx.syntheticIndex++;
  } while (ctx.xrefs.has(xref));
  ctx.xrefs.add(xref);
  // The synthesized record must carry its identifier: the serializers
  // write the record and the pointer link verbatim, and the 5.5.1
  // projection strips links whose target is missing.
  record.xref = xref;
  ctx.synthetic.push(record);
  return {
    tag: 'OBJE',
    object: xref,
    ...(primary === undefined ? {} : { primary }),
    ...(scrapbook === undefined ? {} : { scrapbook }),
    ...(slideshow === undefined ? {} : { slideshow }),
    ...(thumbnail === undefined ? {} : { thumbnail }),
  };
}

/**
 * Parses a presence-style privacy flag (`_PRIV`): an absent value or `Y`
 * marks the flag set, `N` clears it. Used where the flag has no standard
 * slot (addresses) and where it projects onto RESN (event details).
 */
export function parsePrivacyFlag(node: RawNode, tag: string): boolean {
  if (node.value.kind === 'absent') {
    return true;
  }
  const text = reqText(node);
  if (text === 'Y') {
    return true;
  }
  if (text === 'N') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be Y or N, not "${text}"`, node.position);
}

/** Parses a vendor Y/N flag (`_PRIM`, `_SCBK`, `_SSHOW`, …). */
export function parseYNFlag(node: RawNode, tag: string): boolean {
  const text = reqText(node).trim().toUpperCase();
  if (text === 'Y' || text === 'YES') {
    return true;
  }
  if (text === 'N' || text === 'NO') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be Y or N, not "${text}"`, node.position);
}

/**
 * Parses a presence-style vendor flag with the wider value spellings the
 * catalogs document (`Y` and `YES` both occur, e.g. Legacy's `_ITALIC Y`
 * versus `_LIST1 YES` in its "Custom GEDCOM Tags" help): an absent value,
 * `Y` or `YES` marks the flag set, `N`/`NO` clears it. Used for the
 * report-formatting flags without a standard slot.
 */
export function parseVendorFlag(node: RawNode, tag: string): boolean {
  if (node.value.kind === 'absent') {
    return true;
  }
  const text = reqText(node).trim().toUpperCase();
  if (text === 'Y' || text === 'YES') {
    return true;
  }
  if (text === 'N' || text === 'NO') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be Y, YES, N or NO, not "${text}"`, node.position);
}

/**
 * Parses a USM6 (Der Stammbaum ≤ V6) yes/no flag (`SIGN`, `POTM`): the
 * wire value is undocumented (the GenWiki "GEDCOM/_Nutzerdef-Tag"
 * article's "Tabelle 2" describes the value set only as "[ja/nein]"),
 * so an absent value or the usual positive spellings (`Y`, `YES`, `J`,
 * `JA`, `1`) mark the flag set and the negative ones (`N`, `NO`,
 * `NEIN`, `0`) clear it.
 */
export function parseUsmFlag(node: RawNode, tag: string): boolean {
  const flag = parseUsmFlagLenient(node, tag);
  if (flag === undefined) {
    fail('enum.invalid-value', `The ${tag} value must be a yes/no flag, not "${reqText(node)}"`, node.position);
  }
  return flag;
}

/**
 * The lenient twin of parseUsmFlag: returns undefined when the payload
 * is not one of the flag spellings, so the caller can keep the line as
 * a generic extension instead of failing the import. Used where two
 * vendors give the same tag different meanings (USM6's `SIGN` can-sign
 * flag versus Heredis' `SIGN` signature — see IndividualRecord.canSign).
 */
export function parseUsmFlagLenient(node: RawNode, tag: string): boolean | undefined {
  void tag;
  if (node.value.kind === 'absent') {
    return true;
  }
  if (node.value.kind !== 'text') {
    return undefined;
  }
  const text = node.value.text.toUpperCase();
  if (text === 'Y' || text === 'YES' || text === 'J' || text === 'JA' || text === '1') {
    return true;
  }
  if (text === 'N' || text === 'NO' || text === 'NEIN' || text === '0') {
    return false;
  }
  return undefined;
}

/**
 * Parses the USM6 `SURE` certainty marker under an INDI or FAM NCHI:
 * `1` marks the given child count certain, `0` clears the mark (the
 * GenWiki example is "SURE 1").
 */
export function parseSureFlag(node: RawNode): boolean {
  const text = reqText(node);
  if (text === '1') {
    return true;
  }
  if (text === '0') {
    return false;
  }
  fail('enum.invalid-value', `The SURE value must be 1 or 0, not "${text}"`, node.position);
}

/**
 * Parses one of the USM6 digit codes (BTYP, MTYP, UTYP): the accepted
 * digits are the documented value set of the tag, and the returned
 * literal is one of them (the meanings live in the model types).
 */
export function parseUsmCode<T extends string>(node: RawNode, tag: string, allowed: readonly T[]): T {
  const text = reqText(node);
  if (!allowed.includes(text as T)) {
    fail('enum.invalid-value', `The ${tag} value must be one of ${allowed.join(', ')}, not "${text}"`, node.position);
  }
  return text as T;
}

export function parseCrop(node: RawNode, ctx: Ctx): CropStructure {
  noPayload(node);
  const out: CropStructure = {};
  dispatch(
    node,
    out,
    {
      TOP: (child) => {
        out.top = reqDigits(child);
      },
      LEFT: (child) => {
        out.left = reqDigits(child);
      },
      HEIGHT: (child) => {
        out.height = reqDigits(child);
      },
      WIDTH: (child) => {
        out.width = reqDigits(child);
      },
      // The underscore spellings of the Ancestry.com Family Trees crop
      // block (`_CROP` with `_LEFT`/`_TOP`/`_WDTH`/`_HGHT` — the
      // offset-plus-size form, same slots as the standard 7.0 CROP).
      '_TOP': (child) => {
        out.top = reqDigits(child);
      },
      '_LEFT': (child) => {
        out.left = reqDigits(child);
      },
      '_HGHT': (child) => {
        out.height = reqDigits(child);
      },
      '_WDTH': (child) => {
        out.width = reqDigits(child);
      },
      '_TYPE': (child) => {
        // The crop variant (`primary`; see CropStructure.type).
        out.type = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

// ---------------------------------------------------------------------------
