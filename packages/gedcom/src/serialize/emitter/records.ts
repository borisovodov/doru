/**
 * Serializer section: the record emitters (FAM, INDI, OBJE, REPO, notes, sources, citations).
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  AddressStructure,
  AssociationStructure,
  CallNumberStructure,
  ChangeDate,
  CreationDate,
  DatePeriodStructure,
  ExtensionStructure,
  FamilyEventDetail,
  IndividualEventDetail,
  LdsOrdinanceDetail,
  MediaFile,
  MultimediaLink,
  NonEventStructure,
  NoteStructure,
  NoteTranslation,
  PersonalNameStructure,
  PlaceStructure,
  SourceCitation,
  SourceText,
  TodoStructure,
} from '../../structures';
import {
  formatDateValue551,
  formatDateValue70,
} from '../format';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';
import {
  commonRecordFields,
  emitGdoSubmitters,
} from './document';
import {
  emitFamilyDetail,
  emitFamilyEvent,
  emitIndividualDetail,
  emitIndividualEvent,
  emitLdsDetail,
} from './events';
import {
  emitMedia,
  emitMediaFile,
  emitPersonalName,
  emitPlace,
} from './names-places';
import {
  emitAddress,
  emitAssociation,
  emitDate,
  emitDateExact,
  emitExtensions,
  emitNoteStructure,
  emitRelocatedCitation,
  emitSourceCitation,
  mergedAddress,
} from './structures';
import {
  famcStat,
  pedigree,
  ptr,
  restrictionList,
  sex,
} from './values';
import type {
  DateStructure,
  SourcePublicationDetails,
} from '../../structures';

export function emitFamily(w: Writer, version: Version, rec: {
  tag: 'FAM';
  restriction?: Array<string | `_${string}`>;
  attributes?: Array<{ tag: string; payload?: string | number; type?: string; detail?: FamilyEventDetail; childCountCertain?: boolean; extensions?: ExtensionStructure[] }>;
  events?: Array<{ tag: string; payload?: true | string; type?: string; detail?: FamilyEventDetail; extensions?: ExtensionStructure[] }>;
  nonEvents?: NonEventStructure[];
  husband?: { partner: string; phrase?: string; preferred?: boolean; name?: PersonalNameStructure; civilStatus?: string; marriageNumber?: number; extensions?: ExtensionStructure[] };
  wife?: { partner: string; phrase?: string; preferred?: boolean; name?: PersonalNameStructure; civilStatus?: string; marriageNumber?: number; extensions?: ExtensionStructure[] };
  children?: Array<{ child: string; phrase?: string; preferred?: boolean; multiplicity?: string; fatherRelation?: string; motherRelation?: string; extensions?: ExtensionStructure[] }>;
  associations?: AssociationStructure[];
  submitters?: string[];
  spouseSealings?: Array<{ tag: 'SLGS'; detail?: LdsOrdinanceDetail; extensions?: ExtensionStructure[] }>;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  media?: MultimediaLink[];
  todos?: TodoStructure[];
  witnesses?: string[];
  marriageStatuses?: Array<{
    payload: string;
    date?: DateStructure;
    place?: PlaceStructure;
    notes?: NoteStructure[];
    citations?: SourceCitation[];
    extensions?: ExtensionStructure[];
  }>;
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  updatedAt?: string;
  createdAt?: string;
  marriageBeginningStatus?: string;
  marriageEndingStatus?: string;
  unionKind?: string;
  sameSexUnion?: true;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'FAM', { xref: rec.xref });
  if (rec.updatedAt !== undefined) {
    w.line(1, '_UPD', { value: rec.updatedAt });
  }
  if (rec.createdAt !== undefined) {
    // GenPlus: the record creation date (see FamilyRecord.createdAt).
    w.line(1, '_CREAT', { value: rec.createdAt });
  }
  if (rec.marriageStatuses !== undefined) {
    // The marriage statuses (see MarriageStatusStructure): the bare
    // status line of Legacy/AQ/Ages!/GDO/webtrees, or the full
    // GEDCOM-L FAM F7 STATUS_STRUCTURE with DATE/PLAC/NOTE/SOUR.
    for (const status of rec.marriageStatuses) {
      w.line(1, '_STAT', { value: status.payload });
      if (status.date !== undefined) {
        emitDate(w, version, 2, 'DATE', status.date);
      }
      if (status.place !== undefined) {
        emitPlace(w, version, 2, status.place);
      }
      for (const note of status.notes ?? []) {
        emitNoteStructure(w, version, 2, note);
      }
      for (const citation of status.citations ?? []) {
        emitSourceCitation(w, version, 2, citation);
      }
      emitExtensions(w, version, 2, status);
    }
  }
  if (rec.marriageBeginningStatus !== undefined) {
    // FTW: the status at the beginning of the marriage.
    w.line(1, '_MSTAT', { value: rec.marriageBeginningStatus });
  }
  if (rec.marriageEndingStatus !== undefined) {
    // FTW: the status at the end of the marriage.
    w.line(1, '_MEND', { value: rec.marriageEndingStatus });
  }
  if (version === '5.5.1' && rec.unionKind !== undefined) {
    // USM6: the kind of relationship the partners are in (see
    // FamilyRecord.unionKind); 7.0 cannot spell the non-underscore tag.
    w.line(1, 'UTYP', { value: rec.unionKind });
  }
  if (rec.restriction !== undefined) {
    w.line(1, 'RESN', { value: restrictionList(w, version, rec.restriction) });
  }
  for (const attribute of rec.attributes ?? []) {
    if (attribute.tag === 'NCHI') {
      w.line(1, 'NCHI', { value: String(attribute.payload) });
      if (version === '7.0') {
        // 5.5.1 NCHI is a bare count under FAM_RECORD: the TYPE and the
        // FAMILY_EVENT_DETAIL are dropped there (see
        // FamilyChildCountAttribute).
        emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      } else {
        if (attribute.childCountCertain !== undefined) {
          // USM6: the child count certainty marker (see
          // FamilyChildCountAttribute.childCountCertain); 7.0 cannot
          // spell the non-underscore tag.
          w.line(2, 'SURE', { value: attribute.childCountCertain ? '1' : '0' });
        }
        emitExtensions(w, version, 2, attribute);
      }
      continue;
    }
    if (attribute.tag === 'RESI') {
      if (version === '7.0') {
        w.line(1, 'RESI', { value: (attribute.payload as string) ?? '' });
        emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      } else {
        w.line(1, 'RESI');
        emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      }
      emitExtensions(w, version, 2, attribute);
      continue;
    }
    // FAM.FACT is 7.0-only; dropped.
    if (version !== '7.0') {
      continue;
    }
    w.line(1, 'FACT', { value: (attribute.payload as string) ?? '' });
    if (attribute.type !== undefined) {
      w.line(2, 'TYPE', { value: attribute.type });
    }
    emitFamilyDetail(w, version, 2, attribute.detail, undefined);
    emitExtensions(w, version, 2, attribute);
  }
  for (const event of rec.events ?? []) {
    emitFamilyEvent(w, version, event);
  }
  if (version === '7.0') {
    for (const nonEvent of rec.nonEvents ?? []) {
      w.line(1, 'NO', { value: nonEvent.payload });
      if (nonEvent.date !== undefined) {
        const dateValue = formatDateValue70(nonEvent.date.value ?? { kind: 'period' });
        if (dateValue !== undefined) {
          w.line(2, 'DATE', { value: dateValue });
        }
        if (nonEvent.date.phrase !== undefined) {
          w.line(3, 'PHRASE', { value: nonEvent.date.phrase });
        }
      }
      for (const note of nonEvent.notes ?? []) {
        emitNoteStructure(w, version, 2, note);
      }
      for (const citation of nonEvent.citations ?? []) {
        emitSourceCitation(w, version, 2, citation);
      }
    }
  } else {
    for (const nonEvent of rec.nonEvents ?? []) {
      // The Ahnenblatt negative; only a bare FAM NO MARR survives
      // prepareFor551, everything else was dropped.
      if (nonEvent.payload === 'MARR') {
        w.line(1, '_MARR', { value: 'N' });
      }
    }
  }
  if (rec.sameSexUnion === true) {
    w.line(1, '_TYPE', { value: 'same-sex' });
  }
  for (const todo of rec.todos ?? []) {
    emitTodoStructure(w, version, 1, todo);
  }
  for (const witness of rec.witnesses ?? []) {
    // The GEDCOM-L ASSO A4 witnesses of the family (see
    // FamilyRecord.witnesses); GES2000's combined godparents and
    // witnesses (`_GODT`) type into the same slot and are written
    // back as `_WITN`.
    w.line(1, '_WITN', { value: witness });
  }
  if (rec.husband !== undefined) {
    ptr(w, version, 1, 'HUSB', rec.husband.partner);
    if (version === '7.0' && rec.husband.phrase !== undefined) {
      // The 7.0 HUSB.PHRASE; 5.5.1 has no PHRASE slot (dropped — see
      // FamilyPartnerLink.phrase).
      w.line(2, 'PHRASE', { value: rec.husband.phrase });
    }
    if (rec.husband.preferred === true) {
      w.line(2, '_PREF', { value: 'Y' });
    }
    if (rec.husband.name !== undefined) {
      // GES2000: the partner's married name (see FamilyPartnerLink.name);
      // written back as `_NAM` (neither standard has a NAME slot under
      // HUSB/WIFE).
      emitPersonalName(w, version, 2, rec.husband.name, '_NAM');
    }
    if (rec.husband.civilStatus !== undefined) {
      // GES2000: the civil status at the time of the marriage (see
      // FamilyPartnerLink.civilStatus).
      w.line(2, '_ZVST', { value: rec.husband.civilStatus });
    }
    if (rec.husband.marriageNumber !== undefined) {
      // GES2000: the ordinal number of the marriage (see
      // FamilyPartnerLink.marriageNumber).
      w.line(2, '_NR', { value: String(rec.husband.marriageNumber) });
    }
    emitExtensions(w, version, 2, rec.husband);
  }
  if (rec.wife !== undefined) {
    ptr(w, version, 1, 'WIFE', rec.wife.partner);
    if (version === '7.0' && rec.wife.phrase !== undefined) {
      // The 7.0 WIFE.PHRASE; 5.5.1 has no PHRASE slot (dropped).
      w.line(2, 'PHRASE', { value: rec.wife.phrase });
    }
    if (rec.wife.preferred === true) {
      w.line(2, '_PREF', { value: 'Y' });
    }
    if (rec.wife.name !== undefined) {
      // GES2000: the partner's married name (see FamilyPartnerLink.name);
      // written back as `_NAM`.
      emitPersonalName(w, version, 2, rec.wife.name, '_NAM');
    }
    if (rec.wife.civilStatus !== undefined) {
      w.line(2, '_ZVST', { value: rec.wife.civilStatus });
    }
    if (rec.wife.marriageNumber !== undefined) {
      w.line(2, '_NR', { value: String(rec.wife.marriageNumber) });
    }
    emitExtensions(w, version, 2, rec.wife);
  }
  for (const child of rec.children ?? []) {
    ptr(w, version, 1, 'CHIL', child.child);
    if (version === '7.0' && child.phrase !== undefined) {
      // The 7.0 CHIL.PHRASE; 5.5.1 has no PHRASE slot (dropped — see
      // FamilyChildLink.phrase).
      w.line(2, 'PHRASE', { value: child.phrase });
    }
    if (child.preferred === true) {
      w.line(2, '_PREF', { value: 'Y' });
    }
    if (child.multiplicity !== undefined) {
      w.line(2, '_STAT', { value: child.multiplicity });
    }
    if (version === '5.5.1') {
      // The 7.0 side of the pair (INDI.FAMC.PEDI) is filled by prepareFor70.
      if (child.fatherRelation !== undefined) {
        w.line(2, '_FREL', { value: child.fatherRelation });
      }
      if (child.motherRelation !== undefined) {
        w.line(2, '_MREL', { value: child.motherRelation });
      }
    }
    emitExtensions(w, version, 2, child);
  }
  for (const association of rec.associations ?? []) {
    if (version === '7.0') {
      emitAssociation(w, version, 1, association);
    } else {
      // 5.5.1 FAM has no ASSO slot; the German _ASSO form carries it.
      emitAssociation(w, version, 1, association, '_ASSO');
    }
  }
  for (const submitter of rec.submitters ?? []) {
    ptr(w, version, 1, 'SUBM', submitter);
  }
  for (const sealing of rec.spouseSealings ?? []) {
    w.line(1, 'SLGS');
    emitLdsDetail(w, version, 2, sealing.detail, 'SLGS');
    emitExtensions(w, version, 2, sealing);
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitIndividual(w: Writer, version: Version, rec: {
  tag: 'INDI';
  restriction?: Array<string | `_${string}`>;
  names?: PersonalNameStructure[];
  sex?: string;
  attributes?: Array<{ tag: string; payload?: string | number; type?: string; detail?: IndividualEventDetail; childCountCertain?: boolean; primary?: boolean; extensions?: ExtensionStructure[] }>;
  events?: Array<{ tag: string; payload?: true | string; type?: string; detail?: IndividualEventDetail; familyChild?: string; adoptionFamily?: { family: string; adoption?: { payload: string; phrase?: string } }; extensions?: ExtensionStructure[] }>;
  nonEvents?: NonEventStructure[];
  ordinances?: Array<{ tag: string; detail?: LdsOrdinanceDetail; familyChild?: string; extensions?: ExtensionStructure[] }>;
  childFamilies?: Array<{ family: string; primary?: boolean; preferred?: boolean; pedigree?: { payload: string; phrase?: string }; status?: { payload: string; phrase?: string }; fatherRelation?: string; motherRelation?: string; fatherChildStatus?: string; motherChildStatus?: string; parentalRelationKind?: string; notes?: NoteStructure[]; extensions?: ExtensionStructure[] }>;
  spouseFamilies?: Array<{ family: string; preferred?: boolean; notes?: NoteStructure[]; extensions?: ExtensionStructure[] }>;
  submitters?: string[];
  associations?: AssociationStructure[];
  aliases?: Array<{ individual: string; phrase?: string; extensions?: ExtensionStructure[] }>;
  ancestorInterests?: string[];
  descendantInterests?: string[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  media?: MultimediaLink[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  recordFileNumber?: string;
  ancestralFileNumber?: string;
  updatedAt?: string;
  createdAt?: string;
  url?: string;
  sosaNumber?: string;
  familySearchId?: string;
  marks?: string[];
  todos?: TodoStructure[];
  canSign?: boolean;
  bookmarked?: boolean;
  startPerson?: boolean;
  adoptedByFather?: boolean;
  adoptedByMother?: boolean;
  godparents?: string[];
  witnesses?: string[];
  webTags?: Array<{ name?: string; url: string; extensions?: ExtensionStructure[] }>;
  recordFlags?: Array<{ tag: string; name: string }>;
  internetSearch?: { mhrm?: string; mhsm?: string; mhav?: string; researchDate?: string; searchDate?: string };
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'INDI', { xref: rec.xref });
  if (rec.updatedAt !== undefined) {
    w.line(1, '_UPD', { value: rec.updatedAt });
  }
  if (rec.createdAt !== undefined) {
    // GenPlus: the record creation date (see IndividualRecord.createdAt).
    w.line(1, '_CREAT', { value: rec.createdAt });
  }
  if (rec.url !== undefined) {
    w.line(1, '_URL', { value: rec.url });
  }
  if (rec.sosaNumber !== undefined) {
    w.line(1, '_SOSA', { value: rec.sosaNumber });
  }
  if (rec.familySearchId !== undefined) {
    w.line(1, '_FSFTID', { value: rec.familySearchId });
  }
  if (version === '5.5.1' && rec.canSign !== undefined) {
    // USM6: whether the person can sign (see IndividualRecord.canSign);
    // 7.0 cannot spell the non-underscore tag.
    w.line(1, 'SIGN', { value: rec.canSign ? '1' : '0' });
  }
  if (rec.bookmarked === true) {
    // MFT7: the person is bookmarked (see IndividualRecord.bookmarked).
    w.line(1, '_BKM', { value: 'Y' });
  }
  if (rec.startPerson === true) {
    // MFT7: the start person (see IndividualRecord.startPerson).
    w.line(1, '_STP', { value: 'Y' });
  }
  if (rec.adoptedByFather === true) {
    // BKW6+: adopted by the father (see IndividualRecord.adoptedByFather).
    w.line(1, '_ADPF', { value: 'Y' });
  }
  if (rec.adoptedByMother === true) {
    // BKW6+: adopted by the mother (see IndividualRecord.adoptedByMother).
    w.line(1, '_ADPM', { value: 'Y' });
  }
  for (const godparent of rec.godparents ?? []) {
    // The GEDCOM-L ASSO A4 godparents of the individual (see
    // IndividualRecord.godparents).
    w.line(1, '_GODP', { value: godparent });
  }
  for (const witness of rec.witnesses ?? []) {
    // The GEDCOM-L ASSO A4 witnesses of the individual (see
    // IndividualRecord.witnesses).
    w.line(1, '_WITN', { value: witness });
  }
  for (const webTag of rec.webTags ?? []) {
    // RootsMagic: an external web link (see IndividualRecord.webTags).
    w.line(1, '_WEBTAG');
    if (webTag.name !== undefined) {
      w.line(2, 'NAME', { value: webTag.name });
    }
    w.line(2, 'URL', { value: webTag.url });
    emitExtensions(w, version, 2, webTag);
  }
  if (rec.recordFlags !== undefined) {
    // FH: the record flags (see IndividualRecord.recordFlags).
    w.line(1, '_FLGS');
    for (const flag of rec.recordFlags) {
      w.line(2, flag.tag, { value: flag.name });
    }
  }
  if (rec.internetSearch !== undefined) {
    // Ahnenblatt: the internet-search details block (see
    // IndividualRecord.internetSearch / InternetSearchStructure).
    w.line(1, '_INET');
    if (rec.internetSearch.mhrm !== undefined) {
      w.line(2, '_MHRM', { value: rec.internetSearch.mhrm });
    }
    if (rec.internetSearch.mhsm !== undefined) {
      w.line(2, '_MHSM', { value: rec.internetSearch.mhsm });
    }
    if (rec.internetSearch.mhav !== undefined) {
      w.line(2, '_MHAV', { value: rec.internetSearch.mhav });
    }
    if (rec.internetSearch.researchDate !== undefined) {
      w.line(2, '_RDATE', { value: rec.internetSearch.researchDate });
    }
    if (rec.internetSearch.searchDate !== undefined) {
      w.line(2, '_SDATE', { value: rec.internetSearch.searchDate });
    }
  }
  for (const todo of rec.todos ?? []) {
    emitTodoStructure(w, version, 1, todo);
  }
  if (rec.marks !== undefined) {
    rec.marks.forEach((mark, index) => {
      if (mark !== '') {
        w.line(1, index === 0 ? '_TAG' : `_TAG${index + 1}`, { value: mark });
      }
    });
  }
  if (rec.restriction !== undefined) {
    w.line(1, 'RESN', { value: restrictionList(w, version, rec.restriction) });
  }
  for (const name of rec.names ?? []) {
    emitPersonalName(w, version, 1, name);
  }
  if (rec.sex !== undefined) {
    const value = sex(w, version, rec.sex);
    if (value !== undefined) {
      w.line(1, 'SEX', { value });
    }
  }
  for (const attribute of rec.attributes ?? []) {
    const payload = attribute.payload;
    if (version === '5.5.1' && attribute.tag === 'RESI' && payload !== undefined) {
      // The 5.5.1 INDI.RESI takes no payload (GEDCOM 5.5.1 §2 p.33
      // "n RESI {1:1}"; the residence is carried by the detail's
      // ADDR/PLAC): a 7.0 Text payload is dropped on 5.5.1 output (see
      // IndividualResidenceAttribute.payload).
      w.line(1, attribute.tag);
    } else {
      w.line(1, attribute.tag, payload === undefined ? {} : { value: String(payload) });
    }
    emitIndividualDetail(w, version, 2, attribute.detail, attribute.type);
    if (attribute.tag === 'OCCU' && attribute.primary === true) {
      // Ahnenblatt: the primary occupation flag (see
      // OccupationAttribute.primary).
      w.line(2, '_PRIM', { value: 'Y' });
    }
    if (version === '5.5.1' && attribute.tag === 'NCHI' && attribute.childCountCertain !== undefined) {
      // USM6: the child count certainty marker (see
      // IndividualChildCountAttribute.childCountCertain); 7.0 cannot
      // spell the non-underscore tag.
      w.line(2, 'SURE', { value: attribute.childCountCertain ? '1' : '0' });
    }
    emitExtensions(w, version, 2, attribute);
  }
  for (const event of rec.events ?? []) {
    emitIndividualEvent(w, version, event);
  }
  if (version === '7.0') {
    for (const nonEvent of rec.nonEvents ?? []) {
      w.line(1, 'NO', { value: nonEvent.payload });
      if (nonEvent.date !== undefined) {
        const dateValue = formatDateValue70(nonEvent.date.value ?? { kind: 'period' });
        if (dateValue !== undefined) {
          w.line(2, 'DATE', { value: dateValue });
        }
        if (nonEvent.date.phrase !== undefined) {
          w.line(3, 'PHRASE', { value: nonEvent.date.phrase });
        }
      }
      for (const note of nonEvent.notes ?? []) {
        emitNoteStructure(w, version, 2, note);
      }
      for (const citation of nonEvent.citations ?? []) {
        emitSourceCitation(w, version, 2, citation);
      }
    }
  } else {
    for (const nonEvent of rec.nonEvents ?? []) {
      // The BKW vendor negatives; only bare NO MARR / NO DEAT survive
      // prepareFor551, everything else was dropped.
      w.line(1, nonEvent.payload === 'MARR' ? '_NMAR' : '_NLIV');
    }
  }
  for (const ordinance of rec.ordinances ?? []) {
    w.line(1, ordinance.tag);
    emitLdsDetail(w, version, 2, ordinance.detail, ordinance.tag);
    if (ordinance.familyChild !== undefined) {
      ptr(w, version, 2, 'FAMC', ordinance.familyChild);
    }
    emitExtensions(w, version, 2, ordinance);
  }
  for (const link of rec.childFamilies ?? []) {
    ptr(w, version, 1, 'FAMC', link.family);
    if (link.primary === true) {
      w.line(2, '_PRIMARY', { value: 'Y' });
    }
    if (link.preferred === true) {
      w.line(2, '_PREF', { value: 'Y' });
    }
    if (link.fatherChildStatus !== undefined) {
      // AQ: the child's status on the father's side (see
      // ChildFamilyLink.fatherChildStatus).
      w.line(2, '_HUSB', { value: link.fatherChildStatus });
    }
    if (link.motherChildStatus !== undefined) {
      // AQ: the child's status on the mother's side (see
      // ChildFamilyLink.motherChildStatus).
      w.line(2, '_WIFE', { value: link.motherChildStatus });
    }
    if (version === '5.5.1' && link.parentalRelationKind !== undefined) {
      // USM6: the parent–child relation kind (see
      // ChildFamilyLink.parentalRelationKind); 7.0 cannot spell the
      // non-underscore tag.
      w.line(2, 'MTYP', { value: link.parentalRelationKind });
    }
    if (link.pedigree !== undefined) {
      const value = pedigree(w, version, link.pedigree.payload);
      if (value !== undefined) {
        w.line(2, 'PEDI', { value });
        if (version === '7.0' && link.pedigree.phrase !== undefined) {
          // The 7.0 PEDI.PHRASE; 5.5.1 has no PHRASE slot anywhere
          // (dropped — see PedigreeStructure.phrase).
          w.line(3, 'PHRASE', { value: link.pedigree.phrase });
        }
      }
    }
    if (link.status !== undefined) {
      w.line(2, 'STAT', { value: famcStat(w, version, link.status.payload) });
      if (version === '7.0' && link.status.phrase !== undefined) {
        // The 7.0 STAT.PHRASE; 5.5.1 has no PHRASE slot (dropped — see
        // FamilyChildStatusStructure.phrase).
        w.line(3, 'PHRASE', { value: link.status.phrase });
      }
    }
    if (version === '5.5.1') {
      // The AGES! position of the relation tags (under INDI.FAMC);
      // 7.0 drops them after the prepareFor70 PEDI projection.
      if (link.fatherRelation !== undefined) {
        w.line(2, '_FREL', { value: link.fatherRelation });
      }
      if (link.motherRelation !== undefined) {
        w.line(2, '_MREL', { value: link.motherRelation });
      }
    }
    for (const note of link.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
    emitExtensions(w, version, 2, link);
  }
  for (const link of rec.spouseFamilies ?? []) {
    ptr(w, version, 1, 'FAMS', link.family);
    if (link.preferred === true) {
      w.line(2, '_PREF', { value: 'Y' });
    }
    for (const note of link.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
    emitExtensions(w, version, 2, link);
  }
  for (const submitter of rec.submitters ?? []) {
    ptr(w, version, 1, 'SUBM', submitter);
  }
  for (const association of rec.associations ?? []) {
    emitAssociation(w, version, 1, association);
  }
  for (const alias of rec.aliases ?? []) {
    ptr(w, version, 1, 'ALIA', alias.individual);
    if (version === '7.0' && alias.phrase !== undefined) {
      // The 7.0 ALIA.PHRASE; 5.5.1 has no PHRASE slot (dropped — see
      // AliasLink.phrase).
      w.line(2, 'PHRASE', { value: alias.phrase });
    }
    emitExtensions(w, version, 2, alias);
  }
  for (const submitter of rec.ancestorInterests ?? []) {
    ptr(w, version, 1, 'ANCI', submitter);
  }
  for (const submitter of rec.descendantInterests ?? []) {
    ptr(w, version, 1, 'DESI', submitter);
  }
  if (rec.recordFileNumber !== undefined && version === '5.5.1') {
    w.line(1, 'RFN', { value: rec.recordFileNumber });
  }
  if (rec.ancestralFileNumber !== undefined && version === '5.5.1') {
    w.line(1, 'AFN', { value: rec.ancestralFileNumber });
  }
  commonRecordFields(w, version, rec, 1);
}

/** Emits the Legacy `_TODO` record (see TodoRecord). */
export function emitTodoRecord(w: Writer, _version: Version, rec: {
  tag: '_TODO';
  payload: string;
  category?: string;
  closedDate?: string;
  locality?: string;
  reminderDate?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, '_TODO', { xref: rec.xref, value: rec.payload });
  if (rec.category !== undefined) {
    w.line(1, '_CAT', { value: rec.category });
  }
  if (rec.closedDate !== undefined) {
    w.line(1, '_CDATE', { value: rec.closedDate });
  }
  if (rec.locality !== undefined) {
    w.line(1, '_LOCL', { value: rec.locality });
  }
  if (rec.reminderDate !== undefined) {
    w.line(1, '_RDATE', { value: rec.reminderDate });
  }
  emitExtensions(w, _version, 1, rec);
}

/** Emits the Legacy `_EVENT_DEFN` record (see EventDefinitionRecord). */
export function emitEventDefinition(w: Writer, version: Version, rec: {
  tag: '_EVENT_DEFN';
  eventType?: string;
  confidentialFlag?: boolean;
  dateType?: string;
  descriptionFlag?: string;
  placeType?: string;
  potentialProblemsExcluded?: string;
  sentences?: string[];
  pafSentences?: {
    male?: string;
    female?: string;
    unknown?: string;
    maleDateOnly?: string;
    malePlaceOnly?: string;
    maleDateAndPlace?: string;
    femaleDateOnly?: string;
    femalePlaceOnly?: string;
    femaleDateAndPlace?: string;
    unknownDateOnly?: string;
    unknownPlaceOnly?: string;
    unknownDateAndPlace?: string;
  };
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, '_EVENT_DEFN', { xref: rec.xref, value: rec.eventType });
  if (rec.confidentialFlag !== undefined) {
    w.line(1, '_CONF_FLAG', { value: rec.confidentialFlag ? 'Y' : 'N' });
  }
  if (rec.dateType !== undefined) {
    w.line(1, '_DATE_TYPE', { value: rec.dateType });
  }
  if (rec.descriptionFlag !== undefined) {
    w.line(1, '_DESC_FLAG', { value: rec.descriptionFlag });
  }
  if (rec.placeType !== undefined) {
    w.line(1, '_PLACE_TYPE', { value: rec.placeType });
  }
  if (rec.potentialProblemsExcluded !== undefined) {
    w.line(1, '_PP_EXCLUDE', { value: rec.potentialProblemsExcluded });
  }
  (rec.sentences ?? []).forEach((sentence, index) => {
    if (sentence !== '') {
      w.line(1, index === 0 ? '_SEN1' : `_SEN${index + 1}`, { value: sentence });
    }
  });
  const paf = rec.pafSentences;
  if (paf !== undefined) {
    const order: Array<[keyof NonNullable<typeof paf>, string]> = [
      ['male', '_SENM'],
      ['female', '_SENF'],
      ['unknown', '_SENU'],
      ['maleDateOnly', '_SENDOM'],
      ['malePlaceOnly', '_SENPOM'],
      ['maleDateAndPlace', '_SENDPM'],
      ['femaleDateOnly', '_SENDOF'],
      ['femalePlaceOnly', '_SENPOF'],
      ['femaleDateAndPlace', '_SENDPF'],
      ['unknownDateOnly', '_SENDOU'],
      ['unknownPlaceOnly', '_SENPOU'],
      ['unknownDateAndPlace', '_SENDPU'],
    ];
    for (const [field, tag] of order) {
      const value = paf[field];
      if (value !== undefined) {
        w.line(1, tag, { value });
      }
    }
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits the GDO `_ALIA` duplicate-candidate record (see
 *  DuplicateCandidateRecord). */
export function emitDuplicateCandidateRecord(w: Writer, version: Version, rec: {
  tag: '_ALIA';
  xref?: string;
  caption?: string;
  individual?: string;
  assessment?: string;
  status?: string;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  extensions?: ExtensionStructure[];
}): void {
  w.line(0, '_ALIA', { xref: rec.xref });
  if (rec.caption !== undefined) {
    w.line(1, '_CPT', { value: rec.caption });
  }
  if (rec.individual !== undefined) {
    ptr(w, version, 1, '_INDI', rec.individual);
  }
  if (rec.assessment !== undefined) {
    w.line(1, '_QUAY', { value: rec.assessment });
  }
  if (rec.status !== undefined) {
    w.line(1, '_STAT', { value: rec.status });
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  for (const citation of rec.citations ?? []) {
    emitSourceCitation(w, version, 1, citation);
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits the `_TODO` substructure under INDI/FAM (see TodoStructure). */
export function emitTodoStructure(w: Writer, version: Version, level: number, rec: TodoStructure): void {
  w.line(level, '_TODO', rec.payload === undefined ? {} : { value: rec.payload });
  if (rec.description !== undefined) {
    w.line(level + 1, 'DESC', { value: rec.description });
  }
  if (rec.category !== undefined) {
    // GEDCOM-L E1: the category of the task (see TodoStructure.category).
    w.line(level + 1, '_CAT', { value: rec.category });
  }
  if (rec.priority !== undefined) {
    w.line(level + 1, 'PRTY', { value: rec.priority });
  }
  if (rec.type !== undefined) {
    // GEDCOM-L E1: the type of the task (see TodoStructure.type).
    w.line(level + 1, 'TYPE', { value: rec.type });
  }
  if (rec.date !== undefined) {
    emitDate(w, version, level + 1, 'DATE', rec.date);
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  if (rec.data !== undefined) {
    // GEDCOM-L E1: the details of the solution (see TodoStructure.data).
    w.line(level + 1, 'DATA', { value: rec.data });
  }
  if (rec.status !== undefined) {
    w.line(level + 1, 'STAT', { value: rec.status });
  }
  if (rec.closedDate !== undefined) {
    // GEDCOM-L E1: the completion date (see TodoStructure.closedDate).
    emitDate(w, version, level + 1, '_CDATE', rec.closedDate);
  }
  if (rec.reminderDate !== undefined) {
    // GEDCOM-L E1: the reminder date (see TodoStructure.reminderDate).
    emitDate(w, version, level + 1, '_RDATE', rec.reminderDate);
  }
  if (rec.repository !== undefined) {
    // GEDCOM-L E1: a pointer to a repository record (see
    // TodoStructure.repository).
    ptr(w, version, level + 1, 'REPO', rec.repository);
  }
  for (const uid of rec.uids ?? []) {
    // GEDCOM-L E1: unique identifiers of the task (see TodoStructure.uids).
    w.line(level + 1, '_UID', { value: uid });
  }
}

export function emitMultimedia(w: Writer, version: Version, rec: {
  tag: 'OBJE';
  restriction?: Array<string | `_${string}`>;
  files: MediaFile[];
  date?: DateStructure;
  objectType?: string;
  soundFile?: string;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'OBJE', { xref: rec.xref });
  if (rec.restriction !== undefined && version === '7.0') {
    w.line(1, 'RESN', { value: restrictionList(w, version, rec.restriction) });
  }
  for (const file of rec.files) {
    emitMediaFile(w, version, 1, file);
  }
  if (rec.date !== undefined) {
    emitDate(w, version, 1, '_DATE', rec.date);
  }
  if (rec.objectType !== undefined) {
    w.line(1, '_TYPE', { value: rec.objectType });
  }
  if (rec.soundFile !== undefined) {
    w.line(1, '_SOUND', { value: rec.soundFile });
  }
  emitGdoSubmitters(w, version, 1, rec.submitters);
  commonRecordFields(w, version, rec, 1);
}

export function emitRepository(w: Writer, version: Version, rec: {
  tag: 'REPO';
  name: string;
  address?: AddressStructure;
  phone?: string[];
  email?: string[];
  fax?: string[];
  www?: string[];
  notes?: NoteStructure[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  dates?: DateStructure[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'REPO', { xref: rec.xref });
  w.line(1, 'NAME', { value: rec.name });
  for (const date of rec.dates ?? []) {
    // The community _DATE extension under REPO (registry: _DATE.yaml).
    emitDate(w, version, 1, '_DATE', date);
  }
  const address = mergedAddress(w, version, rec.address, rec);
  if (address !== undefined) {
    emitAddress(w, version, 1, address);
  }
  if (version === '7.0') {
    // The 5.5.1-position contacts inside ADDR are relocated here.
    for (const value of rec.phone ?? rec.address?.phone ?? []) {
      w.line(1, 'PHON', { value });
    }
    for (const value of rec.email ?? rec.address?.email ?? []) {
      w.line(1, 'EMAIL', { value });
    }
    for (const value of rec.fax ?? rec.address?.fax ?? []) {
      w.line(1, 'FAX', { value });
    }
    for (const value of rec.www ?? rec.address?.www ?? []) {
      w.line(1, 'WWW', { value });
    }
  } else if (address === undefined) {
    // 5.5.1 REPO carries only the ADDRESS_STRUCTURE (GEDCOM 5.5.1 §2
    // p.27): PHON and FAX have no 5.5.1 slot without an address block
    // and are dropped, while the Family Historian spellings
    // `_EMAIL`/`_WEB` carry the record-level e-mail and web address
    // (see RepositoryRecord.email/www).
    for (const value of rec.email ?? []) {
      w.line(1, '_EMAIL', { value });
    }
    for (const value of rec.www ?? []) {
      w.line(1, '_WEB', { value });
    }
  }
  emitGdoSubmitters(w, version, 1, rec.submitters);
  commonRecordFields(w, version, rec, 1);
}

export function emitSharedNote(w: Writer, version: Version, rec: {
  tag: 'SNOTE';
  payload: string;
  mediaType?: string;
  language?: string;
  translations?: NoteTranslation[];
  citations?: SourceCitation[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SNOTE', { xref: rec.xref, value: rec.payload });
  if (rec.mediaType !== undefined) {
    w.line(1, 'MIME', { value: rec.mediaType });
  }
  if (rec.language !== undefined) {
    w.line(1, 'LANG', { value: rec.language });
  }
  for (const translation of rec.translations ?? []) {
    w.line(1, 'TRAN', { value: translation.payload });
    if (translation.mediaType !== undefined) {
      w.line(2, 'MIME', { value: translation.mediaType });
    }
    if (translation.language !== undefined) {
      w.line(2, 'LANG', { value: translation.language });
    }
  }
  emitGdoSubmitters(w, version, 1, rec.submitters);
  commonRecordFields(w, version, rec, 1);
}

export function emitNoteRecord(w: Writer, version: Version, rec: {
  tag: 'NOTE';
  payload: string;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  citations?: SourceCitation[];
  changeDate?: ChangeDate;
  automatedRecordId?: string;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'NOTE', { xref: rec.xref, value: rec.payload });
  emitGdoSubmitters(w, version, 1, rec.submitters);
  commonRecordFields(w, version, rec, 1);
}

/** A SNOTE record projected onto 5.5.1: a NOTE record (MIME/LANG/TRAN, UID, EXID and CREA are dropped). */

export function emitSharedNoteAs551(w: Writer, version: Version, rec: {
  tag: 'SNOTE';
  payload: string;
  citations?: SourceCitation[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  changeDate?: ChangeDate;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'NOTE', { xref: rec.xref, value: rec.payload });
  emitGdoSubmitters(w, version, 1, rec.submitters);
  commonRecordFields(w, version, rec, 1);
}

/** A 5.5.1 NOTE record projected onto 7.0: a SNOTE record (RIN is dropped). */

export function emitNoteRecordAs70(w: Writer, version: Version, rec: {
  tag: 'NOTE';
  payload: string;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  citations?: SourceCitation[];
  changeDate?: ChangeDate;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SNOTE', { xref: rec.xref, value: rec.payload });
  emitGdoSubmitters(w, version, 1, rec.submitters);
  commonRecordFields(w, version, rec, 1);
}

export function emitSource(w: Writer, version: Version, rec: {
  tag: 'SOUR';
  data?: {
    events?: Array<{ payload: Array<string | `_${string}`>; userDefined?: string[]; date?: DatePeriodStructure; place?: PlaceStructure; extensions?: ExtensionStructure[] }>;
    agency?: string;
    notes?: NoteStructure[];
    extensions?: ExtensionStructure[];
  };
  author?: string;
  title?: string;
  abbreviation?: string;
  publication?: string;
  publicationDetails?: SourcePublicationDetails;
  text?: SourceText;
  repositoryCitations?: Array<{ repository: string; notes?: NoteStructure[]; callNumbers?: CallNumberStructure[] }>;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  media?: MultimediaLink[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  template?: { templateId?: string; fields: Array<{ name: string; value?: string }> };
  fullFootnote?: string;
  titleItalic?: boolean;
  publicationParenthesized?: boolean;
  titleQuoted?: boolean;
  sourceType?: string;
  masterListing?: boolean;
  citationDetailIncluded?: boolean;
  citationIncluded?: boolean;
  citationDetailTextIncluded?: boolean;
  citationDetailNotesIncluded?: boolean;
  quality?: { source?: string; information?: string; evidence?: string };
  evidenceAvailable?: boolean;
  volumeYear?: string;
  submitters?: string[];
  relocatedCitations?: SourceCitation[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SOUR', { xref: rec.xref });
  if (rec.data !== undefined) {
    w.line(1, 'DATA');
    for (const event of rec.data.events ?? []) {
      if (version === '7.0') {
        if (event.payload.length === 0) {
          // The EVEN carried only 5.5.1 user-defined values; 7.0 has
          // no slot for them and an empty List payload would be
          // invalid — the whole structure (payload, DATE and PLAC) is
          // dropped.
          continue;
        }
        w.line(2, 'EVEN', { value: event.payload.join(', ') });
      } else {
        w.line(2, 'EVEN', { value: [...event.payload, ...(event.userDefined ?? [])].join(', ') });
      }
      if (event.date !== undefined) {
        const dateValue =
          version === '7.0'
            ? formatDateValue70(event.date.value ?? { kind: 'period' })
            : formatDateValue551(event.date.value ?? { kind: 'period' });
        if (dateValue !== undefined) {
          w.line(3, 'DATE', { value: dateValue });
        }
        if (event.date.phrase !== undefined) {
          w.line(4, 'PHRASE', { value: event.date.phrase });
        }
      }
      if (event.place !== undefined) {
        if (version === '7.0') {
          emitPlace(w, version, 3, event.place);
        } else {
          // 5.5.1 spells this position as the bare
          // SOURCE_JURISDICTION_PLACE (GEDCOM 5.5.1 §2 p.27: "PLAC
          // <SOURCE_JURISDICTION_PLACE> {0:1}"): FORM/MAP/NOTE and the
          // other 7.0 place substructures have no slot there and are
          // dropped on 5.5.1 output (see SourceDataEvent.place).
          w.line(3, 'PLAC', { value: event.place.payload.join(', ') });
        }
      }
      emitExtensions(w, version, 3, event);
    }
    if (rec.data.agency !== undefined) {
      w.line(2, 'AGNC', { value: rec.data.agency });
    }
    for (const note of rec.data.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
    emitExtensions(w, version, 2, rec.data);
  }
  if (rec.author !== undefined) {
    w.line(1, 'AUTH', { value: rec.author });
  }
  if (rec.title !== undefined) {
    w.line(1, 'TITL', { value: rec.title });
  }
  if (rec.abbreviation !== undefined) {
    w.line(1, 'ABBR', { value: rec.abbreviation });
  }
  if (rec.publication !== undefined) {
    w.line(1, 'PUBL', { value: rec.publication });
    if (version === '7.0' && rec.publicationDetails !== undefined) {
      // The Ancestry publication details (registry: Ancestry_PUBL_DATE /
      // Ancestry_PUBL_PLAC yaml); 5.5.1 has no slot for them.
      if (rec.publicationDetails.date !== undefined) {
        emitDateExact(w, version, 2, 'DATE', rec.publicationDetails.date, rec.publicationDetails.date.time);
      }
      if (rec.publicationDetails.place !== undefined) {
        w.line(2, 'PLAC', { value: rec.publicationDetails.place });
      }
    }
  }
  if (rec.text !== undefined) {
    w.line(1, 'TEXT', { value: rec.text.payload });
    if (version === '7.0') {
      if (rec.text.mediaType !== undefined) {
        w.line(2, 'MIME', { value: rec.text.mediaType });
      }
      if (rec.text.language !== undefined) {
        w.line(2, 'LANG', { value: rec.text.language });
      }
    }
  }
  for (const citation of rec.repositoryCitations ?? []) {
    emitRepositoryCitation(w, version, 1, citation);
  }
  if (rec.fullFootnote !== undefined) {
    w.line(1, '_FULL', { value: rec.fullFootnote });
  }
  if (rec.titleItalic === true) {
    // Legacy / AQ: the source title prints in italics (see
    // SourceRecord.titleItalic).
    w.line(1, '_ITALIC', { value: 'Y' });
  }
  if (rec.publicationParenthesized === true) {
    w.line(1, '_PAREN', { value: 'Y' });
  }
  if (rec.titleQuoted === true) {
    w.line(1, '_QUOTED', { value: 'Y' });
  }
  if (rec.sourceType !== undefined) {
    // FH: the source record type (see SourceRecord.sourceType).
    w.line(1, '_TYPE', { value: rec.sourceType });
  }
  if (rec.masterListing === true) {
    // AQ: the source appears in the Master listing (see
    // SourceRecord.masterListing).
    w.line(1, '_MASTER', { value: 'Y' });
  }
  if (rec.citationDetailIncluded !== undefined) {
    // Legacy: include/exclude the citation detail on reports (see
    // SourceRecord.citationDetailIncluded).
    w.line(1, '_TAG', { value: rec.citationDetailIncluded ? 'YES' : 'NO' });
  }
  if (rec.citationIncluded !== undefined) {
    w.line(1, '_TAG2', { value: rec.citationIncluded ? 'YES' : 'NO' });
  }
  if (rec.citationDetailTextIncluded !== undefined) {
    w.line(1, '_TAG3', { value: rec.citationDetailTextIncluded ? 'YES' : 'NO' });
  }
  if (rec.citationDetailNotesIncluded !== undefined) {
    w.line(1, '_TAG4', { value: rec.citationDetailNotesIncluded ? 'YES' : 'NO' });
  }
  if (rec.quality !== undefined) {
    // MFT7: the source-quality block (see SourceRecord.quality).
    w.line(1, '_QUAL');
    if (rec.quality.source !== undefined) {
      w.line(2, '_SOUR', { value: rec.quality.source });
    }
    if (rec.quality.information !== undefined) {
      w.line(2, '_INFO', { value: rec.quality.information });
    }
    if (rec.quality.evidence !== undefined) {
      w.line(2, '_EVID', { value: rec.quality.evidence });
    }
  }
  if (rec.evidenceAvailable === true) {
    // PC-AHNEN: evidence of the event is available (see
    // SourceRecord.evidenceAvailable).
    w.line(1, '_URKU', { value: 'Y' });
  }
  if (rec.volumeYear !== undefined) {
    // GenPlus: the volume year of the source (see SourceRecord.volumeYear).
    w.line(1, '_JAG', { value: rec.volumeYear });
  }
  if (rec.template !== undefined) {
    w.line(1, '_TMPLT');
    if (rec.template.templateId !== undefined) {
      w.line(2, 'TID', { value: rec.template.templateId });
    }
    for (const field of rec.template.fields) {
      w.line(2, 'FIELD');
      w.line(3, 'NAME', { value: field.name });
      if (field.value !== undefined) {
        w.line(3, 'VALUE', { value: field.value });
      }
    }
  }
  for (const relocated of rec.relocatedCitations ?? []) {
    // The relocated _SOUR citations under the SOUR record (registry:
    // _SOUR.yaml): written back under the record in both versions.
    emitRelocatedCitation(w, version, 1, relocated);
  }
  emitGdoSubmitters(w, version, 1, rec.submitters);
  commonRecordFields(w, version, rec, 1);
}

export function emitRepositoryCitation(w: Writer, version: Version, level: number, citation: {
  repository: string;
  notes?: NoteStructure[];
  callNumbers?: CallNumberStructure[];
}): void {
  if (version === '7.0') {
    ptr(w, version, level, 'REPO', citation.repository);
  } else if (citation.repository === '@VOID@') {
    w.line(level, 'REPO');
  } else {
    ptr(w, version, level, 'REPO', citation.repository);
  }
  for (const note of citation.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const callNumber of citation.callNumbers ?? []) {
    w.line(level + 1, 'CALN', { value: callNumber.payload });
    if (callNumber.medium !== undefined) {
      emitMedia(w, version, level + 2, callNumber.medium);
    }
  }
}

