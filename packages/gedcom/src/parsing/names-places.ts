/**
 * Parser section: Names and places.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  NAME_TYPE_ENUM_VALUES,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
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
  dispatch,
  noPayload,
  one,
  req,
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
  parsePrivacyFlag,
  parseSourceCitation,
} from './sources-media';
import {
  datedSourceHandlers,
  parseDateStructure,
  parseExternalIdentifier,
  parseNoteStructure,
} from './substructures';
import {
  parseEnum,
  parseLatitude,
  parseListText,
  parseLongitude,
  parsePersonalName,
} from './types';

// Names and places
// ---------------------------------------------------------------------------

/** 7.0 name pieces: repeated tags ({0:M}). */
export function pieces70(out: PersonalNamePieces, tag: string, child: RawNode): void {
  if (child.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under ${tag}`, (child.children[0] as RawNode).position);
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
export function pieces551(out: PersonalNamePieces, tag: string, child: RawNode): string | undefined {
  let ruf: string | undefined;
  if (tag === 'GIVN') {
    const type = one(child, 'TYPE');
    if (child.children.length > (type === undefined ? 0 : 1)) {
      fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under ${tag}`, (child.children[0] as RawNode).position);
    }
    if (type !== undefined) {
      const value = reqText(type).toUpperCase();
      if (value !== 'RUF') {
        fail('enum.invalid-value', `The NAME TYPE "${value}" under GIVN must be RUF`, type.position);
      }
      ruf = reqText(child);
    }
  } else if (child.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(child.children[0] as RawNode).tag} is not allowed under ${tag}`, (child.children[0] as RawNode).position);
  }
  const parts = reqText(child).split(',').map((part) => part.trim());
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
    payload: parsePersonalName(reqText(node), ctx.version, node.position),
  };
  const handlers: Record<string, (child: RawNode) => void> = {
    TYPE: (child) => {
      out.type = parseNameType(child, ctx);
    },
    '_RUFNAME': (child) => {
      out.callName = reqText(child);
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
    '_ALIA': (child) => {
      // PRO-GEN: an alias of the name, as pure text (see
      // PersonalNameStructure.aliases).
      (out.aliases ??= []).push(reqText(child));
    },
    '_APID': (child) => {
      // The Ancestry record reference attached to names (see
      // PersonalNameStructure.ancestryPointers).
      (out.ancestryPointers ??= []).push(reqText(child));
    },
  };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      if (ctx.version === '7.0') {
        pieces70(out.pieces, tag, child);
      } else {
        const ruf = pieces551(out.pieces, tag, child);
        if (ruf !== undefined) {
          out.callName = ruf;
        }
      }
    };
  }
  if (ctx.version === '7.0') {
    handlers["TRAN"] = (child) => {
      (out.translations ??= []).push(parseNameTranslation(child, ctx));
    };
    handlers["NOTE"] = (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
    handlers["SNOTE"] = (child) => {
      // The 7.0 PERSONAL_NAME_STRUCTURE carries <<NOTE_STRUCTURE>>
      // {0:M} (GEDCOM 7.0 §3.2.3); 5.5.1 stays strict.
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
    handlers["SOUR"] = (child) => {
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    };
  } else {
    handlers["FONE"] = (child) => {
      (out.phonetic ??= []).push(parsePhoneticNameVariation(child, ctx));
    };
    handlers["ROMN"] = (child) => {
      (out.romanized ??= []).push(parseRomanizedNameVariation(child, ctx));
    };
    handlers["NOTE"] = (child) => {
      out.pieces ??= {};
      (out.pieces.notes ??= []).push(parseNoteStructure(child, ctx));
    };
    handlers["SOUR"] = (child) => {
      out.pieces ??= {};
      (out.pieces.citations ??= []).push(parseSourceCitation(child, ctx));
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
    handlers['SECG'] = (child) => {
      // MFT7: the second and further given names (see
      // PersonalNameStructure.furtherGivenNames).
      out.furtherGivenNames = reqText(child);
    };
  }
  dispatch(node, out, handlers, ctx, ['UGNM', 'NAME_', 'SECG']);
  return out;
}

export function parseNameType(node: RawNode, ctx: Ctx): NameTypeStructure {
  const raw = reqText(node);
  if (ctx.version === '7.0') {
    const out: NameTypeStructure = { payload: parseEnum(raw, NAME_TYPE_ENUM_VALUES, '7.0', node.position) };
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
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under TYPE`, (node.children[0] as RawNode).position);
  }
  const known = ['AKA', 'BIRTH', 'IMMIGRANT', 'MAIDEN', 'MARRIED'];
  const upper = raw.toUpperCase();
  if (known.includes(upper)) {
    return { payload: upper as 'AKA' | 'BIRTH' | 'IMMIGRANT' | 'MAIDEN' | 'MARRIED' };
  }
  // 5.5.1 arbitrary user-defined value: normalized to OTHER + phrase.
  return { payload: 'OTHER', phrase: raw };
}

export function parseNameTranslation(node: RawNode, ctx: Ctx): NameTranslation {
  const out: NameTranslation = {
    payload: parsePersonalName(reqText(node), '7.0', node.position),
    language: reqText(req(node, 'LANG')),
  };
  const handlers: Record<string, (child: RawNode) => void> = { LANG: () => undefined };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces70(out.pieces, tag, child);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parsePhoneticNameVariation(node: RawNode, ctx: Ctx): PhoneticNameVariation {
  const out: PhoneticNameVariation = {
    payload: parsePersonalName(reqText(node), '5.5.1', node.position),
    type: reqText(req(node, 'TYPE')),
  };
  const handlers: Record<string, (child: RawNode) => void> = { TYPE: () => undefined };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces551(out.pieces, tag, child);
    };
  }
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseRomanizedNameVariation(node: RawNode, ctx: Ctx): RomanizedNameVariation {
  const out: RomanizedNameVariation = {
    payload: parsePersonalName(reqText(node), '5.5.1', node.position),
    type: reqText(req(node, 'TYPE')),
  };
  const handlers: Record<string, (child: RawNode) => void> = { TYPE: () => undefined };
  for (const tag of PIECE_TAGS) {
    handlers[tag] = (child) => {
      out.pieces ??= {};
      pieces551(out.pieces, tag, child);
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
      out.map = parseMapCoordinates(child, ctx);
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
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
  };
  if (ctx.version === '7.0') {
    handlers["LANG"] = (child) => {
      out.language = reqText(child);
    };
    handlers["TRAN"] = (child) => {
      (out.translations ??= []).push(parsePlaceTranslation(child, ctx));
    };
    handlers["EXID"] = (child) => {
      (out.externalIds ??= []).push(parseExternalIdentifier(child, ctx));
    };
    handlers["SNOTE"] = (child) => {
      // The 7.0 PLACE_STRUCTURE carries <<NOTE_STRUCTURE>> {0:M}
      // (GEDCOM 7.0 §3.2.3); 5.5.1 stays strict.
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  } else {
    handlers["FONE"] = (child) => {
      (out.phonetic ??= []).push(parsePhoneticPlaceVariation(child));
    };
    handlers["ROMN"] = (child) => {
      (out.romanized ??= []).push(parseRomanizedPlaceVariation(child));
    };
  }
  dispatch(node, out, handlers, ctx, ['FORM', 'MAP']);
  return out;
}

export function parsePlaceTranslation(node: RawNode, ctx: Ctx): PlaceTranslation {
  const out: PlaceTranslation = {
    payload: parseListText(reqText(node)),
    language: reqText(req(node, 'LANG')),
  };
  dispatch(node, out, { LANG: () => undefined }, ctx);
  return out;
}

export function parsePhoneticPlaceVariation(node: RawNode): PhoneticPlaceVariation {
  const out: PhoneticPlaceVariation = {
    payload: parseListText(reqText(node)),
    type: reqText(req(node, 'TYPE')),
  };
  if (node.children.some((child) => child.tag !== 'TYPE')) {
    fail('structure.unknown-tag', 'Unexpected substructure under FONE', node.position);
  }
  return out;
}

export function parseRomanizedPlaceVariation(node: RawNode): RomanizedPlaceVariation {
  const out: RomanizedPlaceVariation = {
    payload: parseListText(reqText(node)),
    type: reqText(req(node, 'TYPE')),
  };
  if (node.children.some((child) => child.tag !== 'TYPE')) {
    fail('structure.unknown-tag', 'Unexpected substructure under ROMN', node.position);
  }
  return out;
}

export function parseMapCoordinates(node: RawNode, ctx: Ctx): MapCoordinates {
  noPayload(node);
  const latNode = req(node, 'LATI');
  const lonNode = req(node, 'LONG');
  const out: MapCoordinates = {
    latitude: parseLatitude(reqText(latNode), latNode.position),
    longitude: parseLongitude(reqText(lonNode), lonNode.position),
  };
  dispatch(node, out, { LATI: () => undefined, LONG: () => undefined }, ctx);
  return out;
}

// ---------------------------------------------------------------------------
