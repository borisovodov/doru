/**
 * Parser section: Names and places.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  fail,
} from '../errors';
import type {
  AliasTextLink,
  GedcomStructureBase,
  MapCoordinates,
  NameTranslation,
  NameTypeStructure,
  PersonalNamePieces,
  PersonalNameStructure,
  PhoneticNameVariation,
  PhoneticPlaceVariation,
  PlaceStructure,
  PlaceTranslation,
  PostalCodeStructure,
  RomanizedNameVariation,
  RomanizedPlaceVariation,
} from '../structures';
import {
  addExtension,
  dispatch,
  noPayload,
  one,
  reqPtr,
  reqText,
} from './context';
import type {
  Ctx,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseMultimediaLink,
  parsePrivacyFlag,
  parseSourceCitation,
  parseYNFlag,
} from './sources-media';
import {
  datedSourceHandlers,
  parseCreationDateLenient,
  parseDateStructure,
  parseExternalIdentifier,
  parseNoteStructure,
} from './substructures';
import {
  parseLatitude,
  parseListText,
  parseLongitude,
  parsePersonalName,
} from './types';

// Names and places
// ---------------------------------------------------------------------------

/** 7.0 name pieces: repeated tags ({0:M}). */
export function pieces70(out: PersonalNamePieces, tag: string, child: RawNode, ctx: Ctx): void {
  for (const grandchild of child.children) {
    // Full leniency: unexpected children stay generic extensions.
    addExtension(out, grandchild, ctx);
  }
  const text = reqText(child);
  switch (tag) {
    case 'NPFX':
      (out.namePrefixes ??= []).push(text);
      break;
    case 'GIVN':
      (out.givenNames ??= []).push(text);
      break;
    case 'NICK':
      (out.nicknames ??= []).push(text);
      break;
    case 'SPFX':
      (out.surnamePrefixes ??= []).push(text);
      break;
    case 'SURN':
      (out.surnames ??= []).push(text);
      break;
    case 'NSFX':
      (out.nameSuffixes ??= []).push(text);
      break;
  }
}

/**
 * 5.5.1 name pieces: single occurrence ({0:1}), comma-separated values.
 * The GEDCOM 5.5EL specification ("Extended Locations", GenWiki:
 * https://wiki.genealogy.net/GEDCOM_5.5EL) deviates: it writes one GIVN
 * per given name in order ({0:M}) and marks the Rufname (call name) with
 * a `TYPE RUF` child under the GIVN line. Both forms are accepted as a
 * superset: repeated pieces append (the order of the GIVN sequence is
 * kept), and a RUF-marked GIVN returns its name as the call name (the
 * same slot the GEDCOM-L `_RUFNAME` agreement Ruf.B2 fills).
 */
export function pieces551(out: PersonalNamePieces, tag: string, child: RawNode, ctx: Ctx): string | undefined {
  let ruf: string | undefined;
  const type = tag === 'GIVN' ? one(child, 'TYPE') : undefined;
  if (type !== undefined) {
    const value = reqText(type).toUpperCase();
    if (value !== 'RUF') {
      fail('enum.invalid-value', `The NAME TYPE "${value}" under GIVN must be RUF`, type.position);
    }
    ruf = reqText(child);
  }
  for (const grandchild of child.children) {
    if (grandchild === type) {
      continue;
    }
    // Full leniency: unexpected children stay generic extensions.
    addExtension(out, grandchild, ctx);
  }
  const parts = reqText(child).split(',').map((part) => part.trim()).filter((part) => part !== '');
  switch (tag) {
    case 'NPFX':
      out.namePrefixes = [...(out.namePrefixes ?? []), ...parts];
      break;
    case 'GIVN':
      out.givenNames = [...(out.givenNames ?? []), ...parts];
      break;
    case 'NICK':
      out.nicknames = [...(out.nicknames ?? []), ...parts];
      break;
    case 'SPFX':
      out.surnamePrefixes = [...(out.surnamePrefixes ?? []), ...parts];
      break;
    case 'SURN':
      out.surnames = [...(out.surnames ?? []), ...parts];
      break;
    case 'NSFX':
      out.nameSuffixes = [...(out.nameSuffixes ?? []), ...parts];
      break;
  }
  return ruf;
}

export const PIECE_TAGS = ['NPFX', 'GIVN', 'NICK', 'SPFX', 'SURN', 'NSFX'];

export function parsePersonalNameStructure(node: RawNode, ctx: Ctx): PersonalNameStructure {
  const out: PersonalNameStructure = {
    tag: 'NAME',
    payload: parsePersonalName(reqText(node), node.position),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    TYPE: (child) => {
      out.type = parseNameType(child, ctx);
    },
    '_RUFNAME': (child) => {
      out.callName = reqText(child);
    },
    '_KB_NAME': (child) => {
      // OFB-Werkstatt: the name in the church book's spelling (see
      // PersonalNameStructure.nameAsRecorded).
      out.nameAsRecorded = reqText(child);
    },
    '_PRIM': (child) => {
      // Legacy: the primary name mark (see
      // PersonalNameStructure.primary).
      out.primary = parseYNFlag(child, '_PRIM');
    },
    '_MIDN': (child) => {
      // ged4web: the middle name under NAME (see
      // PersonalNameStructure.middleName).
      out.middleName = reqText(child);
    },
    MIDDLE: (child) => {
      // The standard-tag spelling of the middle name (the GenoPro
      // trees write `2 MIDDLE Thomas` under NAME).
      out.middleName = reqText(child);
    },
    '_PGVN': (child) => {
      // ged4web: the preferred given name (`2 _PGVN Esther` under
      // NAME) — the same slot the FH `_USED` carries (see
      // PersonalNameStructure.givenNameUsed).
      out.givenNameUsed = reqText(child);
    },
    '_PATN': (child) => {
      // The patronymic under NAME (see
      // PersonalNameStructure.patronymic).
      out.patronymic = reqText(child);
    },
    CREA: (child) => {
      // MFT7: the name entry's creation date (see
      // PersonalNameStructure.creationDate).
      const created = parseCreationDateLenient(child, ctx);
      if (created === undefined) {
        addExtension(out, child, ctx);
      } else {
        out.creationDate = created;
      }
    },
    '_CRE': (child) => {
      // MFT7: the `_CRE` spelling of the name creation (see
      // PersonalNameStructure.creationDate).
      const created = parseCreationDateLenient(child, ctx);
      if (created === undefined) {
        addExtension(out, child, ctx);
      } else {
        out.creationDate = created;
      }
    },
    '_USED': (child) => {
      // FH: the given name used (see
      // PersonalNameStructure.givenNameUsed).
      out.givenNameUsed = reqText(child);
    },
    '_CENR': (child) => {
      // The MagiKey census link (registry: MagiKey_CENR.yaml,
      // superstructure INDI-NAME): a pointer to the shared census
      // record the name was recorded in. The pointer must resolve.
      (out.censusLinks ??= []).push(reqPtr(child, ctx));
    },
    '_DATE': (child) => {
      // TMG: a date associated with the name (see
      // PersonalNameStructure.date).
      out.date = parseDateStructure(child, ctx);
    },
    'DATE': (child) => {
      // A standard DATE under the NAME — the name's period of use,
      // spelled with the standard tag instead of the TMG `_DATE`
      // (the same slot; written back as `_DATE`).
      out.date = parseDateStructure(child, ctx);
    },
    '_ALIA': (child) => {
      // PRO-GEN: an alias of the name, as pure text (see
      // PersonalNameStructure.aliases).
      (out.aliases ??= []).push(reqText(child));
    },
    ALIA: (child) => {
      // TMG: an alias of the name written with the standard ALIA
      // spelling, with optional SOUR citations (see
      // PersonalNameStructure.aliasLinks).
      const link: AliasTextLink = { tag: 'ALIA', value: reqText(child) };
      dispatch(
        child,
        link,
        {
          SOUR: (grandchild) => {
            (link.citations ??= []).push(parseSourceCitation(grandchild, ctx));
          },
        },
        ctx,
      );
      (out.aliasLinks ??= []).push(link);
    },
    TITL: (child) => {
      // A title carried by the name itself (see
      // PersonalNameStructure.title).
      out.title = reqText(child);
    },
    '_MARNM': (child) => {
      // The married name (see PersonalNameStructure.marriedName).
      out.marriedName = reqText(child);
    },
    '_MARN': (child) => {
      // The Brother's Keeper spelling of the married name.
      out.marriedName = reqText(child);
    },
    '_AKA': (child) => {
      // An "also known as" name variant (see
      // PersonalNameStructure.alsoKnownAs).
      (out.alsoKnownAs ??= []).push(reqText(child));
    },
    '_AKAN': (child) => {
      // The BKW6/PAF5 spelling of _AKA.
      (out.alsoKnownAs ??= []).push(reqText(child));
    },
    '_APID': (child) => {
      // The Ancestry record reference attached to names (see
      // PersonalNameStructure.ancestryPointers).
      (out.ancestryPointers ??= []).push(reqText(child));
    },
    OBJE: (child) => {
      // TMG: exhibits attached to the name (see
      // PersonalNameStructure.media); `_OBJE` is the vendor spelling
      // T2G writes for validators.
      (out.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    '_OBJE': (child) => {
      (out.media ??= []).push(parseMultimediaLink(child, ctx));
    },
  };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      // The 5.5.1 pieces grammar: comma-separated values, repeated
      // pieces appended, a RUF-marked GIVN typed as the call name.
      out.pieces ??= {};
      const ruf = pieces551(out.pieces, tag, child, ctx);
      if (ruf !== undefined) {
        out.callName = ruf;
      }
    };
  }
  handlers["TRAN"] = (child) => {
    (out.translations ??= []).push(parseNameTranslation(child, ctx));
  };
  handlers["NOTE"] = (child) => {
    (out.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  handlers["SOUR"] = (child) => {
    (out.citations ??= []).push(parseSourceCitation(child, ctx));
  };
  // The 7.0 SNOTE spelling and the 5.5.1 FONE/ROMN and the
  // non-underscore vendor spellings (UGNM, NAME_, SECG) are all
  // accepted in any file.
  handlers["SNOTE"] = (child) => {
    // The 7.0 PERSONAL_NAME_STRUCTURE carries <<NOTE_STRUCTURE>>
    // {0:M} (GEDCOM 7.0 §3.2.3); accepted in any file.
    (out.notes ??= []).push(parseNoteStructure(child, ctx));
  };
  handlers["TRAN"] = (child) => {
    (out.translations ??= []).push(parseNameTranslation(child, ctx));
  };
  handlers["FONE"] = (child) => {
    (out.phonetic ??= []).push(parsePhoneticNameVariation(child, ctx));
  };
  handlers["ROMN"] = (child) => {
    (out.romanized ??= []).push(parseRomanizedNameVariation(child, ctx));
  };
  handlers['UGNM'] = (child) => {
    // USM6: the call name (Rufname) — the same slot `_RUFNAME`
    // carries (see the callName note in PersonalNameStructure).
    out.callName = reqText(child);
  };
  handlers['NAME_'] = (child) => {
    // USM6: the surname variants (see
    // PersonalNameStructure.surnameVariants).
    out.surnameVariants = reqText(child);
  };
  handlers['_NAME_'] = (child) => {
    // The underscore write-back spelling of the USM6 NAME_ (the USM6
    // wire spelling is non-underscore; both are recognized).
    out.surnameVariants = reqText(child);
  };
  handlers['SECG'] = (child) => {
    // MFT7: the second and further given names (see
    // PersonalNameStructure.furtherGivenNames).
    out.furtherGivenNames = reqText(child);
  };
  handlers['_SECG'] = (child) => {
    // The underscore write-back spelling of the MFT7 SECG.
    out.furtherGivenNames = reqText(child);
  };
  handlers['_HEB'] = (child) => {
    // phpGedView: the name in Hebrew script (see
    // PersonalNameStructure.hebrewName).
    out.hebrewName = reqText(child);
  };
  dispatch(node, out, handlers, ctx, ['UGNM', 'NAME_', '_NAME_', 'SECG', '_SECG']);
  return out;
}

export function parseNameType(node: RawNode, ctx: Ctx): NameTypeStructure {
  const raw = reqText(node);
  // Both value forms parse: the 7.0 enum values (with the PHRASE child),
  // the lowercase 5.5.1 spellings of the five shared values, and the
  // 5.5.1 arbitrary user-defined value (normalized to OTHER + phrase).
  const upper = raw.toUpperCase();
  let payload: NameTypeStructure['payload'];
  if (upper === 'AKA' || upper === 'BIRTH' || upper === 'IMMIGRANT' || upper === 'MAIDEN' || upper === 'MARRIED') {
    payload = upper;
  } else if (raw === 'OTHER' || raw === 'PROFESSIONAL' || raw.startsWith('_')) {
    payload = raw as NameTypeStructure['payload'];
  } else {
    // The arbitrary user-defined value (or a lowercase OTHER spelling).
    payload = 'OTHER';
  }
  const out: NameTypeStructure = { payload };
  if (payload === 'OTHER' && raw !== 'OTHER') {
    out.phrase = raw;
  }
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseNameTranslation(node: RawNode, ctx: Ctx): NameTranslation {
  // A missing or value-less LANG is tolerated (the full-leniency
  // container rule).
  const langNode = one(node, 'LANG');
  const out: NameTranslation = {
    payload: parsePersonalName(reqText(node), node.position),
    ...(langNode !== undefined && langNode.value.kind === 'text' ? { language: reqText(langNode) } : {}),
  };
  const handlers: Record<string, (child: RawNode) => void> = { LANG: () => undefined };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces70(out.pieces, tag, child, ctx);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parsePhoneticNameVariation(node: RawNode, ctx: Ctx): PhoneticNameVariation {
  // A missing or value-less TYPE is tolerated (the full-leniency
  // container rule).
  const typeNode = one(node, 'TYPE');
  const out: PhoneticNameVariation = {
    payload: parsePersonalName(reqText(node), node.position),
    ...(typeNode !== undefined && typeNode.value.kind === 'text' ? { type: reqText(typeNode) } : {}),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    TYPE: () => undefined,
    NOTE: (child) => {
      // The 5.5.1 NAME_PHONETIC_VARIATION notes (GEDCOM 5.5.1 §2
      // p.55); the 7.0 TRAN has the same slot.
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      // The 5.5.1 NAME_PHONETIC_VARIATION citations (GEDCOM 5.5.1 §2
      // p.55).
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
  };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces551(out.pieces, tag, child, ctx);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseRomanizedNameVariation(node: RawNode, ctx: Ctx): RomanizedNameVariation {
  // A missing or value-less TYPE is tolerated (the full-leniency
  // container rule).
  const typeNode = one(node, 'TYPE');
  const out: RomanizedNameVariation = {
    payload: parsePersonalName(reqText(node), node.position),
    ...(typeNode !== undefined && typeNode.value.kind === 'text' ? { type: reqText(typeNode) } : {}),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    TYPE: () => undefined,
    NOTE: (child) => {
      // The 5.5.1 NAME_ROMANIZED_VARIATION notes (GEDCOM 5.5.1 §2
      // p.56).
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      // The 5.5.1 NAME_ROMANIZED_VARIATION citations (GEDCOM 5.5.1 §2
      // p.56).
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
  };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces551(out.pieces, tag, child, ctx);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parsePlaceStructure(node: RawNode, ctx: Ctx): PlaceStructure {
  const out: PlaceStructure = { tag: 'PLAC', payload: parseListText(reqText(node)) };
  const handlers: Record<string, (child: RawNode) => void> = {
    FORM: (child) => {
      out.form = parseListText(reqText(child));
    },
    MAP: (child) => {
      if (child.value.kind === 'text') {
        // The historical GEDCOM 5.5EL Maidenhead locator: `MAP <code>`
        // with an optional `TYPE MAIDENHEAD` child (superseded by the
        // GEDCOM-L `_MAIDENHEAD` spelling, which normalizes into the
        // same PlaceStructure.maidenhead slot). The
        // text form is accepted in any file. Source: the English
        // GenWiki article "Gedcom 5.5EL":
        // http://wiki-en.genealogy.net/Gedcom_5.5EL.
        const typeNode = one(child, 'TYPE');
        for (const grandchild of child.children) {
          if (grandchild === typeNode) {
            continue;
          }
          // Full leniency: unexpected children stay generic extensions.
          addExtension(out, grandchild, ctx);
        }
        if (typeNode !== undefined) {
          for (const grandchild of typeNode.children) {
            // Full leniency: unexpected children stay generic extensions.
            addExtension(out, grandchild, ctx);
          }
          if (reqText(typeNode).toUpperCase() !== 'MAIDENHEAD') {
            fail('enum.invalid-value', `The MAP TYPE must be MAIDENHEAD, got "${reqText(typeNode)}"`, typeNode.position);
          }
        }
        out.maidenhead = child.value.text;
        return;
      }
      const map = parseMapCoordinates(child, ctx);
      if (map !== undefined) {
        out.map = map;
      }
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      // TMG: citations attached to the PLAC line (see
      // PlaceStructure.citations).
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    '_LOC': (child) => {
      out.location = reqPtr(child, ctx);
    },
    '_VERI': (child) => {
      out.verified = parsePrivacyFlag(child, '_VERI');
    },
    '_GOV': (child) => {
      out.govId = reqText(child);
    },
    '_AON': (child) => {
      // GenPlus: an alternative place name (see
      // PlaceStructure.alternativeNames).
      (out.alternativeNames ??= []).push(reqText(child));
    },
    '_POST': (child) => {
      const entry: PostalCodeStructure = { code: reqText(child) };
      (out.postalCodes ??= []).push(entry);
      dispatch(child, entry, datedSourceHandlers(ctx, entry), ctx);
    },
    '_MAIDENHEAD': (child) => {
      out.maidenhead = reqText(child);
    },
    '_HEB': (child) => {
      // phpGedView: the place name in Hebrew script (see
      // PlaceStructure.hebrewName).
      out.hebrewName = reqText(child);
    },
    '_PID': (child) => {
      // The Swarm family-tree packs: the place's id (see
      // PlaceStructure.placeId).
      out.placeId = reqText(child);
    },
    '_XREF': (child) => {
      // GenoPro: a pointer to the place's card record (see
      // PlaceStructure.placeCard) — kept verbatim, unresolved.
      out.placeCard = child.value.kind === 'pointer' ? child.value.pointer : reqText(child);
    },
    '_COR': (child) => {
      // MFT7: the place coordinates, split into degrees/minutes/seconds
      // plus the direction: _LAD/_LAM/_LAS/_LAN for the latitude,
      // _LOD/_LOM/_LOS/_LON for the longitude (the GenWiki
      // "GEDCOM/_Nutzerdef-Tag" table notes the standard equivalent:
      // "GEDCOM 5.5.1: PLAC.MAP mit UnterTags LATI, LONG"). Normalized
      // into the standard map coordinates and written back as
      // MAP/LATI/LONG.
      const map = parseMftCoordinates(child, ctx, out);
      if (map !== undefined) {
        out.map = map;
      }
    },
    // The the 7.0 LANG/TRAN/EXID/SNOTE spellings are
    // accepted in any file, as are the 5.5.1 FONE/ROMN and the
    // historical GEDCOM 5.5EL POST spelling.
    LANG: (child) => {
      out.language = reqText(child);
    },
    TRAN: (child) => {
      (out.translations ??= []).push(parsePlaceTranslation(child, ctx));
    },
    EXID: (child) => {
      (out.externalIds ??= []).push(parseExternalIdentifier(child, ctx));
    },
    SNOTE: (child) => {
      // The 7.0 PLACE_STRUCTURE carries <<NOTE_STRUCTURE>> {0:M}
      // (GEDCOM 7.0 §3.2.3); accepted in any file.
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    FONE: (child) => {
      (out.phonetic ??= []).push(parsePhoneticPlaceVariation(child, ctx));
    },
    ROMN: (child) => {
      (out.romanized ??= []).push(parseRomanizedPlaceVariation(child, ctx));
    },
    POST: (child) => {
      // The historical GEDCOM 5.5EL agreement wrote the postal code
      // under a place with the standard (non-underscore) POST tag
      // (superseded by the GEDCOM-L `_POST` spelling, which
      // normalizes into the same PlaceStructure.postalCodes slot).
      // Accepted in any file; written back as
      // `_POST`.
      const entry: PostalCodeStructure = { code: reqText(child) };
      (out.postalCodes ??= []).push(entry);
      dispatch(child, entry, datedSourceHandlers(ctx, entry), ctx);
    },
  };
  dispatch(node, out, handlers, ctx, ['FORM', 'MAP']);
  return out;
}

export function parsePlaceTranslation(node: RawNode, ctx: Ctx): PlaceTranslation {
  // A missing or value-less LANG is tolerated (the full-leniency
  // container rule).
  const langNode = one(node, 'LANG');
  const out: PlaceTranslation = {
    payload: parseListText(reqText(node)),
    ...(langNode !== undefined && langNode.value.kind === 'text' ? { language: reqText(langNode) } : {}),
  };
  dispatch(node, out, { LANG: () => undefined }, ctx);
  return out;
}

export function parsePhoneticPlaceVariation(node: RawNode, ctx: Ctx): PhoneticPlaceVariation {
  // A missing or value-less TYPE is tolerated (the full-leniency
  // container rule).
  const typeNode = one(node, 'TYPE');
  const out: PhoneticPlaceVariation = {
    payload: parseListText(reqText(node)),
    ...(typeNode !== undefined && typeNode.value.kind === 'text' ? { type: reqText(typeNode) } : {}),
  };
  for (const child of node.children) {
    if (child.tag !== 'TYPE') {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(out, child, ctx);
    }
  }
  return out;
}

export function parseRomanizedPlaceVariation(node: RawNode, ctx: Ctx): RomanizedPlaceVariation {
  // A missing or value-less TYPE is tolerated (the full-leniency
  // container rule).
  const typeNode = one(node, 'TYPE');
  const out: RomanizedPlaceVariation = {
    payload: parseListText(reqText(node)),
    ...(typeNode !== undefined && typeNode.value.kind === 'text' ? { type: reqText(typeNode) } : {}),
  };
  for (const child of node.children) {
    if (child.tag !== 'TYPE') {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(out, child, ctx);
    }
  }
  return out;
}

export function parseMapCoordinates(node: RawNode, ctx: Ctx): MapCoordinates | undefined {
  noPayload(node);
  const latNode = one(node, 'LATI');
  const lonNode = one(node, 'LONG');
  if (latNode === undefined || lonNode === undefined) {
    fail('structure.missing-required', 'The MAP structure requires LATI and LONG substructures', node.position);
  }
  if (latNode.value.kind === 'absent' || lonNode.value.kind === 'absent') {
    // Bare coordinate lines carry no data; the coordinate-less MAP is
    // dropped silently (the full-leniency container rule).
    return undefined;
  }
  const out: MapCoordinates = {
    latitude: parseLatitude(reqText(latNode), latNode.position),
    longitude: parseLongitude(reqText(lonNode), lonNode.position),
  };
  dispatch(node, out, { LATI: () => undefined, LONG: () => undefined }, ctx);
  return out;
}

/**
 * Parses the MFT7 `_COR` coordinates under a place (see
 * PlaceStructure.map): the latitude degrees/minutes/seconds
 * (`_LAD`/`_LAM`/`_LAS`) with the direction `_LAN` and the longitude
 * (`_LOD`/`_LOM`/`_LOS`) with the direction `_LON`. Normalized into
 * the standard decimal `MapCoordinates`; written back as the standard
 * MAP/LATI/LONG (the GenWiki "GEDCOM/_Nutzerdef-Tag" table notes the
 * equivalent: "GEDCOM 5.5.1: PLAC.MAP mit UnterTags LATI, LONG").
 */
export function parseMftCoordinates(node: RawNode, ctx: Ctx, target: GedcomStructureBase): MapCoordinates | undefined {
  noPayload(node);
  const read = (
    degreesTag: string,
    minutesTag: string,
    secondsTag: string,
    directionTag: string,
    kind: 'latitude' | 'longitude',
  ): { direction: 'N' | 'S' | 'E' | 'W'; degrees: number } | undefined => {
    const degreesNode = one(node, degreesTag);
    if (degreesNode === undefined) {
      fail('structure.missing-required', `The _COR structure requires the ${degreesTag} substructure`, node.position);
    }
    if (degreesNode.value.kind === 'absent') {
      // A bare coordinate line carries no data; the coordinate-less
      // block is dropped silently (the full-leniency container rule).
      return undefined;
    }
    const degrees = Number(reqText(degreesNode));
    if (!Number.isFinite(degrees) || degrees < 0) {
      fail(`${kind}.invalid`, `Invalid ${degreesTag} value "${reqText(degreesNode)}"`, degreesNode.position);
    }
    const minutesNode = one(node, minutesTag);
    const minutes = minutesNode === undefined || minutesNode.value.kind === 'absent' ? 0 : Number(reqText(minutesNode));
    const secondsNode = one(node, secondsTag);
    const seconds = secondsNode === undefined || secondsNode.value.kind === 'absent' ? 0 : Number(reqText(secondsNode));
    if (!Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(seconds) || seconds < 0) {
      fail(`${kind}.invalid`, `Invalid ${degreesTag} minutes or seconds`, node.position);
    }
    const directionNode = one(node, directionTag);
    // The direction is optional in the wild (and a bare direction
    // line is empty, the full-leniency container rule); latitude
    // defaults to North, longitude to East. The GEDKeeper exports
    // write a numeric marker (`_LON 1`, the gedcomimport_samples) —
    // it carries no decodable letter, so the direction defaults the
    // same way (the DMS numbers are the data, the marker is not).
    const rawDirection =
      directionNode === undefined || directionNode.value.kind === 'absent'
        ? undefined
        : reqText(directionNode).toUpperCase();
    let direction = rawDirection === undefined || rawDirection === ''
      ? (kind === 'latitude' ? 'N' : 'E')
      : rawDirection === 'O' ? 'E' : rawDirection;
    if (direction !== 'N' && direction !== 'S' && direction !== 'E' && direction !== 'W') {
      if (/^\d+$/.test(rawDirection as string)) {
        direction = kind === 'latitude' ? 'N' : 'E';
      } else {
        fail('enum.invalid-value', `The ${directionTag} value must be N, S, E or W (or O for Ost), not "${rawDirection as string}"`, (directionNode as RawNode).position);
      }
    }
    const total = degrees + minutes / 60 + seconds / 3600;
    const limit = kind === 'latitude' ? 90 : 180;
    if (total > limit) {
      fail(`${kind}.invalid`, `The ${degreesTag} coordinate ${total} is beyond ${limit} degrees`, node.position);
    }
    return { direction: direction as 'N' | 'S' | 'E' | 'W', degrees: total };
  };
  const latitude = read('_LAD', '_LAM', '_LAS', '_LAN', 'latitude');
  const longitude = read('_LOD', '_LOM', '_LOS', '_LON', 'longitude');
  if (latitude === undefined || longitude === undefined) {
    // A bare coordinate line (see read above).
    return undefined;
  }
  const allowed = new Set(['_LAD', '_LAM', '_LAS', '_LAN', '_LOD', '_LOM', '_LOS', '_LON']);
  for (const child of node.children) {
    if (!allowed.has(child.tag)) {
      // Full leniency: unexpected children stay generic extensions.
      addExtension(target, child, ctx);
    }
  }
  return {
    latitude: { direction: latitude.direction as 'N' | 'S', degrees: latitude.degrees },
    longitude: { direction: longitude.direction as 'E' | 'W', degrees: longitude.degrees },
  };
}

// ---------------------------------------------------------------------------
