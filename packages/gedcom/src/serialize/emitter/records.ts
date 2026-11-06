/**
 * Serializer section: the record emitters (FAM, INDI, OBJE, REPO, notes, sources, citations).
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  AddressStructure,
  AncestryClone,
  CallNumberStructure,
  ChangeDate,
  CreationDate,
  DatePeriodStructure,
  ExtensionStructure,
  FamilyRecord,
  IndividualRecord,
  MediaFile,
  MultimediaLink,
  NoteStructure,
  NoteTranslation,
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
import type {
  PublishedSiteRecord,
} from '../../structures';
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
import type {
  AgeStructure,
} from '../../structures';
import {
  emitAge,
} from './structures';

export function emitFamily(w: Writer, version: Version, rec: FamilyRecord): void {
  w.line(0, 'FAM', { xref: rec.xref });
  if (rec.updatedAt !== undefined) {
    w.line(1, '_UPD', { value: rec.updatedAt });
  }
  if (rec.myHeritageId !== undefined) {
    // MyHeritage: the family's tree identifier (see
    // FamilyRecord.myHeritageId).
    w.line(1, '_MHID', { value: rec.myHeritageId });
  }
  if (rec.confidence !== undefined) {
    // The confidence level of the family record (see
    // FamilyRecord.confidence).
    w.line(1, '_CONF', { value: rec.confidence });
  }
  if (rec.current === true) {
    // The current-family flag (see FamilyRecord.current).
    w.line(1, '_CURRENT', { value: 'Y' });
  }
  if (rec.primary === true) {
    // The primary-family flag (see FamilyRecord.primary).
    w.line(1, '_PRIMARY', { value: 'Y' });
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
    // FamilyRecord.unionKind); 7.0 cannot spell the tag. The 5.5.1
    // output uses the underscore spelling `_UTYP` — the USM6 wire
    // spelling `UTYP` is a non-underscore vendor tag, and 5.5.1
    // requires user-defined tags to begin with an underscore. Both
    // spellings are recognized on input.
    w.line(1, '_UTYP', { value: rec.unionKind });
  }
  if (rec.unionStatus !== undefined) {
    // Heredis: the union status of the couple (see
    // FamilyRecord.unionStatus).
    w.line(1, '_UST', { value: rec.unionStatus });
  }
  if (rec.geditcomId !== undefined) {
    // GEDitCOM II: the record's id (see FamilyRecord.geditcomId).
    w.line(1, '_GCID', { value: rec.geditcomId });
  }
  if (rec.sequenceNumber !== undefined) {
    // The exporter's running number (see FamilyRecord.sequenceNumber).
    w.line(1, 'NUMB', { value: rec.sequenceNumber });
  }
  if (rec.familyTreeSystemId !== undefined) {
    // The Swarm family-tree packs: the family's FamilySearch tree id
    // (see FamilyRecord.familyTreeSystemId).
    w.line(1, '_FTSID', { value: rec.familyTreeSystemId });
  }
  if (rec.preferred === true) {
    // Legacy: the preferred family (see FamilyRecord.preferred).
    w.line(1, '_PREF', { value: 'Y' });
  }
  if (rec.marks !== undefined) {
    rec.marks.forEach((mark, index) => {
      if (mark !== '') {
        // Legacy: the family's tag marks, Tag 2 through Tag 9 (see
        // FamilyRecord.marks).
        w.line(1, `_TAG${index + 2}`, { value: mark });
      }
    });
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
          // spell the tag. Written as the underscore spelling `_SURE`
          // (the USM6 wire spelling `SURE` is non-underscore; both are
          // recognized on input).
          w.line(2, '_SURE', { value: attribute.childCountCertain ? '1' : '0' });
        }
        emitExtensions(w, version, 2, attribute);
      }
      continue;
    }
    if (attribute.tag === 'RESI') {
      if (version === '7.0') {
        w.line(1, 'RESI', { value: attribute.payload ?? '' });
        emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      } else {
        // 5.5.1 FAM.RESI has no payload in the standard grammar; the
        // GEDCOM-L addendum gives it an optional residence descriptor
        // (see FamilyResidenceAttribute.payload), which is written back
        // when present.
        w.line(1, 'RESI', attribute.payload === undefined ? {} : { value: String(attribute.payload) });
        emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      }
      emitExtensions(w, version, 2, attribute);
      continue;
    }
    // FAM.FACT is 7.0-only; dropped.
    if (version !== '7.0') {
      continue;
    }
    w.line(1, 'FACT', { value: attribute.payload ?? '' });
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
        emitExtensions(w, version, 3, nonEvent.date);
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
      for (const entry of child.pedigrees ?? []) {
        // The pedigree under FAM.CHIL (see FamilyChildLink.pedigrees);
        // 7.0 projects it onto INDI.FAMC.PEDI in prepareFor70 and the
        // 7.0 emitter never writes the CHIL-position lines. The PHRASE
        // of the pedigree has no 5.5.1 slot and is dropped.
        w.line(2, 'PEDI', { value: entry.pedigree.payload });
        if (entry.parent !== undefined) {
          ptr(w, version, 3, '_PARENT', entry.parent);
        }
        emitExtensions(w, version, 3, entry.pedigree);
        emitExtensions(w, version, 3, entry);
      }
    }
    for (const note of child.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
    for (const sealing of child.sealings ?? []) {
      // The child's sealing under the CHIL link (see
      // FamilyChildLink.sealings).
      w.line(2, 'SLGC');
      emitLdsDetail(w, version, 3, sealing.detail, 'SLGC');
      emitExtensions(w, version, 3, sealing);
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
  for (const sealing of rec.childSealings ?? []) {
    // The child sealing under the FAM record (see
    // ChildSealingOrdinance).
    w.line(1, 'SLGC');
    emitLdsDetail(w, version, 2, sealing.detail, 'SLGC');
    emitExtensions(w, version, 2, sealing);
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitIndividual(w: Writer, version: Version, rec: IndividualRecord): void {
  w.line(0, 'INDI', { xref: rec.xref });
  if (rec.updatedAt !== undefined) {
    w.line(1, '_UPD', { value: rec.updatedAt });
  }
  if (rec.ageAsRecorded !== undefined) {
    // OFB-Werkstatt: the age as stated in the entry (see
    // IndividualRecord.ageAsRecorded).
    w.line(1, '_ALTER_KB', { value: rec.ageAsRecorded });
  }
  if (rec.deathCauseAsRecorded !== undefined) {
    // OFB-Werkstatt: the cause of death in the church book's wording
    // (see IndividualRecord.deathCauseAsRecorded).
    w.line(1, '_TODURSACHE', { value: rec.deathCauseAsRecorded });
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
  if (rec.myHeritageId !== undefined) {
    // MyHeritage: the person's tree identifier (see
    // IndividualRecord.myHeritageId).
    w.line(1, '_MHID', { value: rec.myHeritageId });
  }
  if (rec.filiation !== undefined) {
    // Heredis: the person's filiation — their child status relative
    // to the recorded parents (see IndividualRecord.filiation).
    w.line(1, '_FIL', { value: rec.filiation });
  }
  if (rec.ancestryMemberTreeId !== undefined) {
    // RootsMagic: the Ancestry Member Tree reference (see
    // IndividualRecord.ancestryMemberTreeId).
    w.line(1, '_AMTID', { value: rec.ancestryMemberTreeId });
  }
  for (const pointer of rec.ancestryPointers ?? []) {
    // Ancestry: the record-level Ancestry reference (see
    // IndividualRecord.ancestryPointers).
    w.line(1, '_APID', { value: pointer });
  }
  if (rec.familyTreeSystemId !== undefined) {
    // The Swarm family-tree packs: the person's FamilySearch tree id
    // (see IndividualRecord.familyTreeSystemId).
    w.line(1, '_FTSID', { value: rec.familyTreeSystemId });
  }
  if (version === '5.5.1' && rec.address !== undefined) {
    // PAF: the person's contact address directly under the INDI
    // record (see IndividualRecord.address); 7.0 has no INDI address
    // position.
    emitAddress(w, version, 1, rec.address);
  }
  if (rec.geditcomId !== undefined) {
    // GEDitCOM II: the record's id (see IndividualRecord.geditcomId).
    w.line(1, '_GCID', { value: rec.geditcomId });
  }
  if (rec.sequenceNumber !== undefined) {
    // The exporter's running number (see
    // IndividualRecord.sequenceNumber).
    w.line(1, 'NUMB', { value: rec.sequenceNumber });
  }
  if (rec.sosaDAboville !== undefined) {
    // Ancestris: the Sosa–d'Aboville number (see
    // IndividualRecord.sosaDAboville).
    w.line(1, '_SOSADABOVILLE', { value: rec.sosaDAboville });
  }
  for (const occurrence of rec.occurrences ?? []) {
    // The glamberson gedcom-occurrences links (see
    // IndividualRecord.occurrences).
    ptr(w, version, 1, '_OCREF', occurrence);
  }
  for (const treeTag of rec.treeTags ?? []) {
    // MyHeritage: a pointer to a tree tag applied to the person (see
    // IndividualRecord.treeTags).
    ptr(w, version, 1, '_MTTAG', treeTag);
  }
  if (version === '5.5.1' && rec.canSign !== undefined) {
    // USM6: whether the person can sign (see IndividualRecord.canSign);
    // 7.0 cannot spell the tag. Written as the underscore spelling
    // `_SIGN` (the USM6 wire spelling `SIGN` is non-underscore, and
    // Heredis writes a signature under the same tag; both spellings
    // are recognized on input — see the parser's lenient rule).
    w.line(1, '_SIGN', { value: rec.canSign ? '1' : '0' });
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
    emitExtensions(w, version, 2, rec.internetSearch);
  }
  for (const todo of rec.todos ?? []) {
    emitTodoStructure(w, version, 1, todo);
  }
  if (rec.correspondence !== undefined) {
    // FO7: the correspondence entry block (see
    // IndividualRecord.correspondence / CorrespondenceStructure).
    w.line(1, '_CORR');
    if (rec.correspondence.reason !== undefined) {
      w.line(2, 'REAS', { value: rec.correspondence.reason });
    }
    if (rec.correspondence.response !== undefined) {
      w.line(2, 'RESP', { value: rec.correspondence.response });
    }
    if (rec.correspondence.replyStatus !== undefined) {
      w.line(2, 'RPLY', { value: rec.correspondence.replyStatus });
    }
    emitExtensions(w, version, 2, rec.correspondence);
  }
  if (rec.marks !== undefined) {
    rec.marks.forEach((mark, index) => {
      if (mark !== '') {
        w.line(1, index === 0 ? '_TAG' : `_TAG${index + 1}`, { value: mark });
      }
    });
  }
  for (const address of rec.email ?? []) {
    // BKW/FO/PAF: the individual's e-mail address under INDI (see
    // IndividualRecord.email).
    w.line(1, '_EMAIL', { value: address });
  }
  for (const number of rec.phone ?? []) {
    // The INDI-level phone number (see IndividualRecord.phone).
    w.line(1, 'PHON', { value: number });
  }
  for (const number of rec.fax ?? []) {
    // The INDI-level fax number (see IndividualRecord.fax).
    w.line(1, 'FAX', { value: number });
  }
  if (rec.deceased !== undefined) {
    // GenoPro: the person's vital flag (see IndividualRecord.deceased).
    w.line(1, 'ISDEAD', { value: rec.deceased ? 'Y' : 'N' });
  }
  for (const link of rec.webLinks ?? []) {
    // The web-link block under INDI (see IndividualRecord.webLinks).
    w.line(1, '_WLNK');
    if (link.title !== undefined) {
      w.line(2, 'TITL', { value: link.title });
    }
    if (link.url !== undefined) {
      w.line(2, 'NOTE', { value: link.url });
    }
    emitExtensions(w, version, 2, link);
  }
  for (const entity of rec.occupations ?? []) {
    ptr(w, version, 1, 'OCCUPATIONS', entity);
  }
  for (const entity of rec.educations ?? []) {
    ptr(w, version, 1, 'EDUCATIONS', entity);
  }
  for (const entity of rec.contacts ?? []) {
    ptr(w, version, 1, 'CONTACTS', entity);
  }
  for (const entity of rec.marriages ?? []) {
    ptr(w, version, 1, 'UNIONS', entity);
  }
  for (const entity of rec.twins ?? []) {
    ptr(w, version, 1, 'TWINS', entity);
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
    if (attribute.tag === 'OCCU' && attribute.asRecorded !== undefined) {
      // OFB-Werkstatt: the church-book wording of the occupation (see
      // OccupationAttribute.asRecorded).
      w.line(2, '_BERUF_KB', { value: attribute.asRecorded });
    }
    if (version === '5.5.1' && attribute.tag === 'NCHI' && attribute.childCountCertain !== undefined) {
      // USM6: the child count certainty marker (see
      // IndividualChildCountAttribute.childCountCertain); 7.0 cannot
      // spell the tag. Written as the underscore spelling `_SURE`
      // (both spellings are recognized on input).
      w.line(2, '_SURE', { value: attribute.childCountCertain ? '1' : '0' });
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
        emitExtensions(w, version, 3, nonEvent.date);
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
    if (version === '5.5.1' && ordinance.tag === 'INIL') {
      // Ancestry.com Family Trees spells the initiatory ordinance
      // `_INIT` (see the INDI `_INIT` handler in
      // parsing/family-individual.ts); 5.5.1 has no INIL tag.
      w.line(1, '_INIT');
    } else {
      w.line(1, ordinance.tag);
    }
    emitLdsDetail(w, version, 2, ordinance.detail, ordinance.tag);
    if (ordinance.tag === 'SLGC' && ordinance.familyChild !== undefined) {
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
      // tag. Written as the underscore spelling `_MTYP` (both
      // spellings are recognized on input).
      w.line(2, '_MTYP', { value: link.parentalRelationKind });
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
    for (const profile of link.profileLinks ?? []) {
      // The Swarm family-tree packs: a FamilySearch profile link
      // attached to the FAMC link (see ProfileLink).
      w.line(2, '_PLINK', { value: profile.individual, pointer: profile.individual !== undefined });
      if (profile.familyTreeId !== undefined) {
        w.line(3, '_FTSID', { value: profile.familyTreeId });
      }
      if (profile.pedigree !== undefined) {
        const value = pedigree(w, version, profile.pedigree.payload);
        if (value !== undefined) {
          w.line(3, 'PEDI', { value });
          if (version === '7.0' && profile.pedigree.phrase !== undefined) {
            w.line(4, 'PHRASE', { value: profile.pedigree.phrase });
          }
        } else if (profile.pedigree.phrase !== undefined) {
          // OTHER cannot be spelled; the phrase is the value.
          w.line(3, 'PEDI', { value: profile.pedigree.phrase });
        }
      }
      for (const citation of profile.citations ?? []) {
        emitSourceCitation(w, version, 3, citation);
      }
      emitExtensions(w, version, 3, profile);
    }
    emitExtensions(w, version, 2, link);
  }
  for (const link of rec.spouseFamilies ?? []) {
    ptr(w, version, 1, 'FAMS', link.family);
    if (link.preferred === true) {
      w.line(2, '_PREF', { value: 'Y' });
    }
    if (link.date !== undefined) {
      // The date of the family link itself (see SpouseFamilyLink.date).
      emitDate(w, version, 2, 'DATE', link.date);
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
  title?: string;
  status?: string;
  priority?: string;
  scheduledDate?: string;
  createdDate?: string;
  uids?: string[];
  changed?: ChangeDate;
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
  if (rec.title !== undefined) {
    // My Family Tree: the task's title (see TodoRecord.title).
    w.line(1, '_TTIL', { value: rec.title });
  }
  if (rec.status !== undefined) {
    // My Family Tree: the task's status (see TodoRecord.status).
    w.line(1, '_TSTS', { value: rec.status });
  }
  if (rec.priority !== undefined) {
    // My Family Tree: the task's priority (see TodoRecord.priority).
    w.line(1, '_TPTY', { value: rec.priority });
  }
  if (rec.scheduledDate !== undefined) {
    // My Family Tree: the scheduled date (see TodoRecord.scheduledDate).
    w.line(1, '_TSDT', { value: rec.scheduledDate });
  }
  if (rec.createdDate !== undefined) {
    // My Family Tree: the creation date (see TodoRecord.createdDate).
    w.line(1, '_TCDT', { value: rec.createdDate });
  }
  for (const uid of rec.uids ?? []) {
    // My Family Tree: the unique identifier (see TodoRecord.uids).
    w.line(1, '_UID', { value: uid });
  }
  if (rec.changed !== undefined) {
    // My Family Tree: the change stamp (see TodoRecord.changed).
    w.line(1, 'CHAN');
    emitDateExact(w, _version, 2, 'DATE', rec.changed.date, rec.changed.date.time);
    for (const note of rec.changed.notes ?? []) {
      emitNoteStructure(w, _version, 2, note);
    }
    if (rec.changed.user !== undefined) {
      w.line(2, '_WT_USER', { value: rec.changed.user });
    }
    emitExtensions(w, _version, 2, rec.changed);
  }
  emitExtensions(w, _version, 1, rec);
}

/** Emits the Legacy `_EVENT_DEFN` record (see EventDefinitionRecord). */
export function emitEventDefinition(w: Writer, version: Version, rec: {
  tag: '_EVENT_DEFN';
  eventType?: string;
  kind?: string;
  title?: string;
  witnessRoles?: Array<{ role: string; sentences?: string[]; sentence?: string; defaultRole?: boolean; extensions?: ExtensionStructure[] }>;
  includeNotes?: boolean;
  confidentialFlag?: boolean;
  dateType?: string;
  descriptionFlag?: string;
  placeType?: string;
  potentialProblemsExcluded?: string;
  abbreviation?: string;
  sentence?: string;
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
  if (rec.kind !== undefined) {
    // The event kind code (see EventDefinitionRecord.kind).
    w.line(1, 'TYPE', { value: rec.kind });
  }
  if (rec.title !== undefined) {
    // The display title (see EventDefinitionRecord.title).
    w.line(1, 'TITL', { value: rec.title });
  }
  if (rec.abbreviation !== undefined) {
    // The GEDCOM 5.5.5 draft / RootsMagic abbreviation (see
    // EventDefinitionRecord.abbreviation).
    w.line(1, 'ABBR', { value: rec.abbreviation });
  }
  if (rec.sentence !== undefined) {
    // The GEDCOM 5.5.5 draft / RootsMagic sentence template (see
    // EventDefinitionRecord.sentence).
    w.line(1, 'SENT', { value: rec.sentence });
  }
  for (const role of rec.witnessRoles ?? []) {
    // The per-role sentence sets (see WitnessRoleSentenceSet).
    w.line(1, 'ROLE', { value: role.role });
    (role.sentences ?? []).forEach((sentence, index) => {
      if (sentence !== '') {
        w.line(2, index === 0 ? '_SEN1' : `_SEN${index + 1}`, { value: sentence });
      }
    });
    if (role.sentence !== undefined) {
      // The GEDCOM 5.5.5 draft / RootsMagic role sentence template
      // (see WitnessRoleSentenceSet.sentence).
      w.line(2, 'SENT', { value: role.sentence });
    }
    if (role.defaultRole === true) {
      w.line(2, '_DEF', { value: 'Y' });
    }
    emitExtensions(w, version, 2, role);
  }
  if (rec.includeNotes === true) {
    // The include-notes flag (see EventDefinitionRecord.includeNotes).
    w.line(1, '_INC_NOTES');
  }
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

/** Emits the MyHeritage `_PUBLISH` record (see PublishedSiteRecord). */
export function emitPublishedSiteRecord(w: Writer, version: Version, rec: PublishedSiteRecord): void {
  w.line(0, '_PUBLISH', { xref: rec.xref });
  if (rec.siteAddress !== undefined) {
    w.line(1, '_SITEADDRESS', { value: rec.siteAddress });
  }
  if (rec.siteName !== undefined) {
    w.line(1, '_SITENAME', { value: rec.siteName });
  }
  if (rec.siteId !== undefined) {
    w.line(1, '_SITEID', { value: rec.siteId });
  }
  if (rec.username !== undefined) {
    w.line(1, '_USERNAME', { value: rec.username });
  }
  if (rec.disabled === true) {
    w.line(1, '_DISABLED', { value: 'Y' });
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits the GDO `_ALIA` duplicate-candidate record (see
 *  DuplicateCandidateRecord). */
export function emitDuplicateCandidateRecord(w: Writer, version: Version, rec: {  tag: '_ALIA';
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
  if (rec.locality !== undefined) {
    // Legacy: the location of the task (see TodoStructure.locality).
    w.line(level + 1, '_LOCL', { value: rec.locality });
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
  emitExtensions(w, version, level + 1, rec);
}

export function emitMultimedia(w: Writer, version: Version, rec: {
  tag: 'OBJE';
  restriction?: Array<string | `_${string}`>;
  files: MediaFile[];
  embeddedForm?: string;
  embeddedBlob?: string;
  date?: DateStructure;
  place?: string;
  primary?: boolean;
  scrapbook?: boolean;
  slideshow?: boolean;
  objectType?: string;
  soundFile?: string;
  createdAt?: string;
  keywords?: string;
  filePath?: string;
  mediaNote?: string;
  objectId?: string;
  user?: string;
  userEncrypted?: boolean;
  origin?: string;
  attachment?: boolean;
  metadata?: string;
  description?: string;
  master?: boolean;
  masterLinkId?: string;
  cutout?: boolean;
  primaryCutout?: boolean;
  parentPhoto?: boolean;
  personalPhoto?: boolean;
  parentRecordId?: string;
  author?: string;
  title?: string;
  clones?: AncestryClone[];
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
  if (version !== '7.0') {
    if (rec.embeddedForm !== undefined) {
      // The GEDCOM 5.5/5.5.1 record-level format (see
      // MultimediaRecord.embeddedForm); 7.0 has no record-level FORM.
      w.line(1, 'FORM', { value: rec.embeddedForm });
    }
    if (rec.embeddedBlob !== undefined) {
      // The embedded content of the 5.5/5.5.1 shape (see
      // MultimediaRecord.embeddedBlob), written back as the CONT lines.
      w.line(1, 'BLOB');
      for (const blobLine of rec.embeddedBlob.split('\n')) {
        w.line(2, 'CONT', { value: blobLine });
      }
    }
  }
  if (rec.date !== undefined) {
    emitDate(w, version, 1, '_DATE', rec.date);
  }
  if (rec.place !== undefined) {
    // Ancestry.com Family Trees: the place of the media object, written
    // with the standard PLAC tag (see MultimediaRecord.place); written
    // back as `_PLAC`.
    w.line(1, '_PLAC', { value: rec.place });
  }
  if (rec.primary === true) {
    // Legacy/AQ/FO/PAF: the record-level preferred-media mark (see
    // MultimediaRecord.primary).
    w.line(1, '_PRIM', { value: 'Y' });
  }
  if (rec.scrapbook === true) {
    w.line(1, '_SCBK', { value: 'Y' });
  }
  if (rec.slideshow === true) {
    w.line(1, '_SSHOW', { value: 'Y' });
  }
  if (rec.objectType !== undefined) {
    w.line(1, '_TYPE', { value: rec.objectType });
  }
  if (rec.soundFile !== undefined) {
    w.line(1, '_SOUND', { value: rec.soundFile });
  }
  if (rec.createdAt !== undefined) {
    // Ancestry.com Family Trees: the creation date of the media object
    // (see MultimediaRecord.createdAt).
    w.line(1, '_CREA', { value: rec.createdAt });
  }
  if (rec.keywords !== undefined) {
    // FH: the media object's keywords (see MultimediaRecord.keywords).
    w.line(1, '_KEYS', { value: rec.keywords });
  }
  if (rec.filePath !== undefined) {
    // FH: the path of the media file (see MultimediaRecord.filePath).
    w.line(1, '_FILE', { value: rec.filePath });
  }
  if (rec.mediaNote !== undefined) {
    // FH: a media note (see MultimediaRecord.mediaNote).
    w.line(1, '_NOTE', { value: rec.mediaNote });
  }
  if (rec.objectId !== undefined) {
    // Ancestry.com Family Trees: the media object's identifier (see
    // MultimediaRecord.objectId).
    w.line(1, '_OID', { value: rec.objectId });
  }
  if (rec.user !== undefined) {
    // Ancestry.com Family Trees: the user token of the media object's
    // creator, with the _ENCR encrypted flag beneath (see
    // MultimediaRecord.user / userEncrypted).
    w.line(1, '_USER', { value: rec.user });
    if (rec.userEncrypted === true) {
      w.line(2, '_ENCR', { value: '1' });
    }
  }
  if (rec.origin !== undefined) {
    // Ancestry.com Family Trees: the origin of the media object (see
    // MultimediaRecord.origin).
    w.line(1, '_ORIG', { value: rec.origin });
  }
  if (rec.attachment === true) {
    // Ancestry.com Family Trees: the attachment flag (see
    // MultimediaRecord.attachment).
    w.line(1, '_ATL', { value: 'Y' });
  }
  if (rec.metadata !== undefined) {
    // Ancestry.com Family Trees: the media metadata XML block (see
    // MultimediaRecord.metadata).
    w.line(1, '_META', { value: rec.metadata });
  }
  if (rec.description !== undefined) {
    // Ancestry.com Family Trees: the media object's description (see
    // MultimediaRecord.description).
    w.line(1, '_DSCR', { value: rec.description });
  }
  if (rec.master === true) {
    // Ancestry.com Family Trees: the master (original) media object
    // mark with the _LKID link id beneath (see
    // MultimediaRecord.master / masterLinkId).
    w.line(1, '_MSER');
    if (rec.masterLinkId !== undefined) {
      w.line(2, '_LKID', { value: rec.masterLinkId });
    }
  }
  if (rec.cutout === true) {
    // MyHeritage: the cutout flag (see MultimediaRecord.cutout).
    w.line(1, '_CUTOUT', { value: 'Y' });
  }
  if (rec.primaryCutout === true) {
    // MyHeritage: the primary cutout mark (see
    // MultimediaRecord.primaryCutout).
    w.line(1, '_PRIM_CUTOUT', { value: 'Y' });
  }
  if (rec.parentPhoto === true) {
    // MyHeritage: the parent-photo flag (see
    // MultimediaRecord.parentPhoto).
    w.line(1, '_PARENTPHOTO', { value: 'Y' });
  }
  if (rec.personalPhoto === true) {
    // MyHeritage: the personal-photo flag (see
    // MultimediaRecord.personalPhoto).
    w.line(1, '_PERSONALPHOTO', { value: 'Y' });
  }
  if (rec.parentRecordId !== undefined) {
    // MyHeritage: the parent's record id (see
    // MultimediaRecord.parentRecordId).
    w.line(1, '_PARENTRIN', { value: rec.parentRecordId });
  }
  if (rec.author !== undefined) {
    // ged4web: the media author under the OBJE record (see
    // MultimediaRecord.author).
    w.line(1, 'AUTH', { value: rec.author });
  }
  if (rec.title !== undefined) {
    // The media object's title at the record level (see
    // MultimediaRecord.title).
    w.line(1, 'TITL', { value: rec.title });
  }
  for (const clone of rec.clones ?? []) {
    // Ancestry.com Family Trees: a clone of this media object in
    // another tree/person (see AncestryClone).
    w.line(1, '_CLON');
    if (clone.treeId !== undefined) {
      w.line(2, '_TID', { value: clone.treeId });
    }
    if (clone.personId !== undefined) {
      w.line(2, '_PID', { value: clone.personId });
    }
    if (clone.objectId !== undefined) {
      w.line(2, '_OID', { value: clone.objectId });
    }
    if (clone.user !== undefined) {
      w.line(2, '_USER', { value: clone.user });
      if (clone.userEncrypted === true) {
        w.line(3, '_ENCR', { value: '1' });
      }
    }
    if (clone.date !== undefined) {
      w.line(2, '_DATE', { value: clone.date });
    }
    emitExtensions(w, version, 2, clone);
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
    emitExtensions(w, version, 2, translation);
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
  geditcomId?: string;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'NOTE', { xref: rec.xref, value: rec.payload });
  if (rec.geditcomId !== undefined) {
    // GEDitCOM II: the record's id (see NoteRecord.geditcomId).
    w.line(1, '_GCID', { value: rec.geditcomId });
  }
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
  authorExtensions?: ExtensionStructure[];
  title?: string;
  titlRef?: string;
  titleExtensions?: ExtensionStructure[];
  date?: DateStructure;
  place?: PlaceStructure;
  abbreviation?: string;
  abbreviationExtensions?: ExtensionStructure[];
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
  template?: { templateId?: string; fields: Array<{ name: string; value?: string }>; extensions?: ExtensionStructure[] };
  fullFootnote?: string;
  subsequentCitationFormat?: string;
  bibliography?: string;
  medium?: string;
  titleItalic?: boolean;
  publicationParenthesized?: boolean;
  titleQuoted?: boolean;
  sourceType?: string;
  masterListing?: boolean;
  citationDetailIncluded?: boolean;
  citationIncluded?: boolean;
  citationDetailTextIncluded?: boolean;
  citationDetailNotesIncluded?: boolean;
  quality?: { source?: string; information?: string; evidence?: string; extensions?: ExtensionStructure[] };
  url?: string;
  confidence?: string;
  accessDate?: string;
  certainty?: string;
  updatedAt?: string;
  ancestryPointers?: string[];
  familyTreeSystemId?: string;
  webTags?: Array<{ name?: string; url?: string; extensions?: ExtensionStructure[] }>;
  files?: Array<{ tag: 'FILE'; payload: string; extensions?: ExtensionStructure[] }>;
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
        emitExtensions(w, version, 4, event.date);
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
    if (rec.authorExtensions !== undefined) {
      emitExtensions(w, version, 2, { extensions: rec.authorExtensions });
    }
  }
  if (rec.title !== undefined) {
    w.line(1, 'TITL', { value: rec.title });
    if (rec.titleExtensions !== undefined) {
      emitExtensions(w, version, 2, { extensions: rec.titleExtensions });
    }
  }
  if (rec.titlRef !== undefined) {
    // The Ancestris pointer form of the title (see SourceRecord.titlRef).
    w.line(1, 'TITL', { value: rec.titlRef, pointer: true });
  }
  if (rec.date !== undefined) {
    // Canvas Roots: the date of the source record itself (see
    // SourceRecord.date).
    emitDate(w, version, 1, 'DATE', rec.date);
  }
  if (rec.place !== undefined) {
    // Canvas Roots: the place of the source record itself (see
    // SourceRecord.place).
    emitPlace(w, version, 1, rec.place);
  }
  if (rec.abbreviation !== undefined) {
    w.line(1, 'ABBR', { value: rec.abbreviation });
    if (rec.abbreviationExtensions !== undefined) {
      emitExtensions(w, version, 2, { extensions: rec.abbreviationExtensions });
    }
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
      emitExtensions(w, version, 2, rec.publicationDetails);
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
    emitExtensions(w, version, 2, rec.text);
  }
  for (const citation of rec.repositoryCitations ?? []) {
    emitRepositoryCitation(w, version, 1, citation);
  }
  if (rec.fullFootnote !== undefined) {
    w.line(1, '_FULL', { value: rec.fullFootnote });
  }
  if (rec.subsequentCitationFormat !== undefined) {
    // RootsMagic: the subsequent-citation format under the SOUR record
    // (see SourceRecord.subsequentCitationFormat).
    w.line(1, '_SUBQ', { value: rec.subsequentCitationFormat });
  }
  if (rec.bibliography !== undefined) {
    // RootsMagic: the bibliography entry under the SOUR record (see
    // SourceRecord.bibliography).
    w.line(1, '_BIBL', { value: rec.bibliography });
  }
  if (rec.medium !== undefined) {
    // Legacy: the media type of the source (see SourceRecord.medium);
    // written back as the underscore spelling `_MEDI` — neither
    // standard has a MEDI slot under the SOUR record, and 7.0 §1.5
    // requires extension tags to be underscore-prefixed.
    w.line(1, '_MEDI', { value: rec.medium });
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
    emitExtensions(w, version, 2, rec.quality);
  }
  if (rec.url !== undefined) {
    // The web address of the source (see SourceRecord.url).
    w.line(1, '_URL', { value: rec.url });
  }
  if (rec.confidence !== undefined) {
    // The confidence level of the source (see SourceRecord.confidence).
    w.line(1, '_CONF', { value: rec.confidence });
  }
  if (rec.accessDate !== undefined) {
    // The date the source was accessed (see SourceRecord.accessDate).
    w.line(1, '_ACC', { value: rec.accessDate });
  }
  if (rec.certainty !== undefined && version !== '7.0') {
    // Heredis: the record-level certainty assessment (see
    // SourceRecord.certainty); 7.0 drops it (a non-underscore tag in
    // the position does not spell a valid 7.0 file).
    w.line(1, 'QUAY', { value: rec.certainty });
  }
  if (rec.updatedAt !== undefined) {
    // MyHeritage: the record's last-updated timestamp (see
    // SourceRecord.updatedAt).
    w.line(1, '_UPD', { value: rec.updatedAt });
  }
  for (const pointer of rec.ancestryPointers ?? []) {
    // Ancestry: the record-level Ancestry reference (see
    // SourceRecord.ancestryPointers).
    w.line(1, '_APID', { value: pointer });
  }
  if (rec.familyTreeSystemId !== undefined) {
    // The Swarm family-tree packs: the source's FamilySearch tree id
    // (see SourceRecord.familyTreeSystemId).
    w.line(1, '_FTSID', { value: rec.familyTreeSystemId });
  }
  for (const webTag of rec.webTags ?? []) {
    // RootsMagic: an external web link under the SOUR record (see
    // SourceRecord.webTags).
    w.line(1, '_WEBTAG');
    if (webTag.name !== undefined) {
      w.line(2, 'NAME', { value: webTag.name });
    }
    w.line(2, 'URL', { value: webTag.url });
    emitExtensions(w, version, 2, webTag);
  }
  for (const file of rec.files ?? []) {
    // A media file attached directly to the source record (see
    // SourceRecord.files).
    w.line(1, 'FILE', { value: file.payload });
    emitExtensions(w, version, 2, file);
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
    emitExtensions(w, version, 2, rec.template);
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
  extensions?: ExtensionStructure[];
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
    emitExtensions(w, version, level + 2, callNumber);
  }
  emitExtensions(w, version, level + 1, citation);
}


/** Emits the GEDKeeper `_GRP` record (see GroupRecord). */
export function emitGroupRecord(w: Writer, version: Version, rec: {
  tag: '_GRP';
  name?: string;
  notes?: NoteStructure[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, '_GRP', { xref: rec.xref });
  if (rec.name !== undefined) {
    w.line(1, 'NAME', { value: rec.name });
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits the MyHeritage `_MTTAG` tree-tag record (see TreeTagRecord). */
export function emitTreeTagRecord(w: Writer, version: Version, rec: {
  tag: '_MTTAG';
  name?: string;
  automatedRecordId?: string;
  visible?: boolean;
  category?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, '_MTTAG', { xref: rec.xref });
  if (rec.name !== undefined) {
    w.line(1, 'NAME', { value: rec.name });
  }
  if (rec.automatedRecordId !== undefined) {
    w.line(1, 'RIN', { value: rec.automatedRecordId });
  }
  if (rec.visible !== undefined) {
    w.line(1, '_VISI', { value: rec.visible ? '1' : '0' });
  }
  if (rec.category !== undefined) {
    ptr(w, version, 1, '_MTCAT', rec.category);
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits the MyHeritage `_MTCAT` tree-category record (see TreeCategoryRecord). */
export function emitTreeCategoryRecord(w: Writer, version: Version, rec: {
  tag: '_MTCAT';
  name?: string;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, '_MTCAT', { xref: rec.xref });
  if (rec.name !== undefined) {
    w.line(1, 'NAME', { value: rec.name });
  }
  if (rec.automatedRecordId !== undefined) {
    w.line(1, 'RIN', { value: rec.automatedRecordId });
  }
  emitExtensions(w, version, 1, rec);
}

/** The shared fields of the GenoPro entity records. */
type GenoProEntityShape = {
  tag: string;
  xref?: string;
  place?: PlaceStructure;
  dateStart?: DateStructure;
  dateEnd?: DateStructure;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  extensions?: ExtensionStructure[];
};

/** Emits the shared GenoPro entity fields under the record line. */
function emitGenoProEntityFields(w: Writer, version: Version, rec: GenoProEntityShape): void {
  if (rec.place !== undefined) {
    emitPlace(w, version, 1, rec.place);
  }
  if (rec.dateStart !== undefined) {
    emitDate(w, version, 1, 'DATESTART', rec.dateStart);
  }
  if (rec.dateEnd !== undefined) {
    emitDate(w, version, 1, 'DATEEND', rec.dateEnd);
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  for (const citation of rec.citations ?? []) {
    emitSourceCitation(w, version, 1, citation);
  }
}

/** Emits the GenoPro entity records (Occupation/Education/Contact/
 *  Marriage/Twin). */
export function emitGenoProRecord(w: Writer, version: Version, rec: GenoProEntityShape & {
  company?: string;
  industry?: string;
  title?: string;
  duration?: string;
  institution?: string;
  type?: string;
  date?: DateStructure;
  kind?: string;
  family?: string;
}): void {
  w.line(0, rec.tag, { xref: rec.xref });
  if (rec.company !== undefined) {
    w.line(1, 'COMPANY', { value: rec.company });
  }
  if (rec.industry !== undefined) {
    w.line(1, 'INDUSTRY', { value: rec.industry });
  }
  if (rec.title !== undefined) {
    w.line(1, 'TITL', { value: rec.title });
  }
  if (rec.duration !== undefined) {
    w.line(1, 'DURATION', { value: rec.duration });
  }
  if (rec.institution !== undefined) {
    w.line(1, 'INSTITUTION', { value: rec.institution });
  }
  if (rec.type !== undefined) {
    w.line(1, 'TYPE', { value: rec.type });
  }
  if (rec.date !== undefined) {
    emitDate(w, version, 1, 'DATE', rec.date);
  }
  if (rec.kind !== undefined) {
    w.line(1, 'TWINLINK', { value: rec.kind });
  }
  if (rec.family !== undefined) {
    w.line(1, 'FAMILY', { value: rec.family, pointer: rec.family.startsWith('@') });
  }
  emitGenoProEntityFields(w, version, rec);
  emitExtensions(w, version, 1, rec);
}

/** Emits the Ancestris `TITL` record (see TitleRecord). */
export function emitTitleRecord(w: Writer, version: Version, rec: {
  tag: 'TITL';
  xref?: string;
  payload?: string;
  changeDate?: ChangeDate;
  author?: string;
  publisher?: string;
  series?: string;
  abbreviation?: string;
  repository?: string;
  sequenceNumber?: string;
  callNumber?: string;
  extensions?: ExtensionStructure[];
}): void {
  w.line(0, 'TITL', { xref: rec.xref, value: rec.payload });
  if (rec.changeDate !== undefined) {
    w.line(1, 'CHAN');
    emitDateExact(w, version, 2, 'DATE', rec.changeDate.date, rec.changeDate.date.time);
    for (const note of rec.changeDate.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
    for (const citation of rec.changeDate.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
    if (rec.changeDate.user !== undefined) {
      w.line(2, '_WT_USER', { value: rec.changeDate.user });
    }
    emitExtensions(w, version, 2, rec.changeDate);
  }
  if (rec.author !== undefined) {
    // A pointer to the author's INDI record, or free text (see
    // TitleRecord.author).
    w.line(1, 'AUTH', { value: rec.author, pointer: rec.author.startsWith('@') && rec.author.endsWith('@') });
  }
  if (rec.publisher !== undefined) {
    w.line(1, 'PUBL', { value: rec.publisher });
  }
  if (rec.series !== undefined) {
    w.line(1, 'SERS', { value: rec.series });
  }
  if (rec.abbreviation !== undefined) {
    w.line(1, 'ABBR', { value: rec.abbreviation });
  }
  if (rec.repository !== undefined) {
    w.line(1, 'REPO', { value: rec.repository, pointer: true });
  }
  if (rec.sequenceNumber !== undefined) {
    w.line(1, 'NUMB', { value: rec.sequenceNumber });
  }
  if (rec.callNumber !== undefined) {
    w.line(1, 'CALN', { value: rec.callNumber });
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits the `_OCUR` occurrence record (see OccurrenceRecord). */
export function emitOccurrenceRecord(w: Writer, version: Version, rec: {
  tag: '_OCUR';
  xref?: string;
  type?: string;
  date?: DateStructure;
  place?: PlaceStructure;
  participants?: Array<{ tag: '_PART'; individual: string; role?: string; age?: AgeStructure; notes?: NoteStructure[]; extensions?: ExtensionStructure[] }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  extensions?: ExtensionStructure[];
}): void {
  w.line(0, '_OCUR', { xref: rec.xref });
  if (rec.type !== undefined) {
    w.line(1, 'TYPE', { value: rec.type });
  }
  if (rec.date !== undefined) {
    emitDate(w, version, 1, 'DATE', rec.date);
  }
  if (rec.place !== undefined) {
    emitPlace(w, version, 1, rec.place);
  }
  for (const participant of rec.participants ?? []) {
    ptr(w, version, 1, '_PART', participant.individual);
    if (participant.role !== undefined) {
      w.line(2, 'ROLE', { value: participant.role });
    }
    if (participant.age !== undefined) {
      emitAge(w, version, 2, participant.age);
    }
    for (const note of participant.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
    emitExtensions(w, version, 2, participant);
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  for (const citation of rec.citations ?? []) {
    emitSourceCitation(w, version, 1, citation);
  }
  emitExtensions(w, version, 1, rec);
}
