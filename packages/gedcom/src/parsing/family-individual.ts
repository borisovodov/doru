/**
 * Parser section: Family and individual records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  RESTRICTION_ENUM_VALUES,
  SEX_ENUM_VALUES,
} from '../enumerations';
import type {
  FamilyRecord,
  IndividualRecord,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  noPayload,
  reqPtr,
  reqText,
} from './context';
import {
  SEX_551,
  parseAliasLink,
  parseChildFamilyLink,
  parseFamilyChildCount,
  parseFamilyChildLink,
  parseFamilyEvent,
  parseFamilyFact,
  parseFamilyPartnerLink,
  parseFamilyResidence,
  parseFamilyResidence551,
  parseIndividualAttribute,
  parseIndividualEvent,
  parseIndividualOrdinance,
  parseSpouseFamilyLink,
  parseSpouseSealing,
} from './events';
import type {
  RawNode,
} from './lines';
import {
  parsePersonalNameStructure,
} from './names-places';
import {
  parseMultimediaLink,
  parseSourceCitation,
} from './sources-media';
import {
  parseAssociation,
  parseChangeDate,
  parseCreationDate,
  parseExternalIdentifier,
  parseNonEvent,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
} from './types';

// ---------------------------------------------------------------------------

export const FAMILY_EVENT_TAGS = ['ANUL', 'CENS', 'DIV', 'DIVF', 'ENGA', 'MARB', 'MARC', 'MARL', 'MARR', 'MARS', 'EVEN'];
export const INDIVIDUAL_EVENT_TAGS = [
  'ADOP', 'BAPM', 'BARM', 'BASM', 'BIRT', 'BLES', 'BURI', 'CENS', 'CHR', 'CHRA', 'CONF', 'CREM',
  'DEAT', 'EMIG', 'FCOM', 'GRAD', 'IMMI', 'NATU', 'ORDN', 'PROB', 'RETI', 'WILL', 'EVEN',
];
export const INDIVIDUAL_ATTRIBUTE_TAGS = [
  'CAST', 'DSCR', 'EDUC', 'IDNO', 'NATI', 'NCHI', 'NMR', 'OCCU', 'PROP', 'RELI', 'RESI', 'SSN', 'TITL', 'FACT',
];

export function parseFamilyRecord(node: RawNode, ctx: Ctx): FamilyRecord {
  noPayload(node);
  const rec: FamilyRecord = { tag: 'FAM', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    RESN: (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, ctx.version, child.position);
    },
    HUSB: (child) => {
      rec.husband = parseFamilyPartnerLink(child, ctx);
    },
    WIFE: (child) => {
      rec.wife = parseFamilyPartnerLink(child, ctx);
    },
    CHIL: (child) => {
      (rec.children ??= []).push(parseFamilyChildLink(child, ctx));
    },
    SUBM: (child) => {
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    SLGS: (child) => {
      (rec.spouseSealings ??= []).push(parseSpouseSealing(child, ctx));
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (rec.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
  };
  if (ctx.version === '7.0') {
    handlers["NCHI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyChildCount(child));
    };
    handlers["RESI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyResidence(child, ctx));
    };
    handlers["FACT"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyFact(child, ctx));
    };
    handlers["NO"] = (child) => {
      (rec.nonEvents ??= []).push(parseNonEvent(child, ctx));
    };
    handlers["ASSO"] = (child) => {
      (rec.associations ??= []).push(parseAssociation(child, ctx));
    };
    handlers["CREA"] = (child) => {
      rec.creationDate = parseCreationDate(child, ctx);
    };
    handlers["UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
    for (const tag of FAMILY_EVENT_TAGS) {
      handlers[tag] = (child) => {
        (rec.events ??= []).push(parseFamilyEvent(child, ctx, tag));
      };
    }
  } else {
    handlers['_UID'] = (child) => {
      // The vendor extension.
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["NCHI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyChildCount(child));
    };
    for (const tag of FAMILY_EVENT_TAGS) {
      handlers[tag] = (child) => {
        (rec.events ??= []).push(parseFamilyEvent(child, ctx, tag));
      };
    }
    handlers["RESI"] = (child) => {
      (rec.attributes ??= []).push(parseFamilyResidence551(child, ctx));
    };
    handlers["RIN"] = (child) => {
      rec.automatedRecordId = reqText(child);
    };
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0' ? ['RESN', 'HUSB', 'WIFE', 'CHAN', 'CREA'] : ['RESN', 'NCHI', 'HUSB', 'WIFE', 'CHAN', 'RIN'],
  );
  return rec;
}

export function parseIndividualRecord(node: RawNode, ctx: Ctx): IndividualRecord {
  noPayload(node);
  const rec: IndividualRecord = { tag: 'INDI', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    RESN: (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, ctx.version, child.position);
    },
    NAME: (child) => {
      (rec.names ??= []).push(parsePersonalNameStructure(child, ctx));
    },
    SEX: (child) => {
      const table = (ctx.version === '7.0' ? SEX_ENUM_VALUES : SEX_551) as Readonly<
        Record<'M' | 'F' | 'U' | 'X', string>
      >;
      rec.sex = parseEnum(reqText(child), table, ctx.version, child.position);
    },
    FAMC: (child) => {
      (rec.childFamilies ??= []).push(parseChildFamilyLink(child, ctx));
    },
    FAMS: (child) => {
      (rec.spouseFamilies ??= []).push(parseSpouseFamilyLink(child, ctx));
    },
    SUBM: (child) => {
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    ASSO: (child) => {
      (rec.associations ??= []).push(parseAssociation(child, ctx));
    },
    ALIA: (child) => {
      (rec.aliases ??= []).push(parseAliasLink(child, ctx));
    },
    ANCI: (child) => {
      (rec.ancestorInterests ??= []).push(reqPtr(child, ctx));
    },
    DESI: (child) => {
      (rec.descendantInterests ??= []).push(reqPtr(child, ctx));
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (rec.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (rec.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
  };
  const eventTags = INDIVIDUAL_EVENT_TAGS;
  const attributeTags = INDIVIDUAL_ATTRIBUTE_TAGS;
  if (ctx.version === '7.0') {
    handlers["NO"] = (child) => {
      (rec.nonEvents ??= []).push(parseNonEvent(child, ctx));
    };
    handlers["CREA"] = (child) => {
      rec.creationDate = parseCreationDate(child, ctx);
    };
    handlers["UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
    for (const tag of ['BAPL', 'CONL', 'ENDL', 'INIL', 'SLGC']) {
      handlers[tag] = (child) => {
        (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, tag));
      };
    }
  } else {
    handlers['_UID'] = (child) => {
      // The vendor extension.
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["RIN"] = (child) => {
      rec.automatedRecordId = reqText(child);
    };
    handlers["RFN"] = (child) => {
      rec.recordFileNumber = reqText(child);
    };
    handlers["AFN"] = (child) => {
      rec.ancestralFileNumber = reqText(child);
    };
    for (const tag of ['BAPL', 'CONL', 'ENDL', 'SLGC']) {
      handlers[tag] = (child) => {
        (rec.ordinances ??= []).push(parseIndividualOrdinance(child, ctx, tag));
      };
    }
  }
  for (const tag of eventTags) {
    handlers[tag] = (child) => {
      (rec.events ??= []).push(parseIndividualEvent(child, ctx, tag));
    };
  }
  for (const tag of attributeTags) {
    handlers[tag] = (child) => {
      (rec.attributes ??= []).push(parseIndividualAttribute(child, ctx, tag));
    };
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0' ? ['RESN', 'SEX', 'CHAN', 'CREA'] : ['RESN', 'SEX', 'CHAN', 'RIN', 'RFN', 'AFN'],
  );
  return rec;
}
