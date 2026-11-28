import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom551, serializeGedcom70, type GedcomDataset } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

function parseDataset(text: string): GedcomDataset {
  const result = parse(new TextEncoder().encode(text));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  return result.value.dataset;
}

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @U1@ SUBM',
  '1 NAME Researcher One',
  '0 @U2@ SUBM',
  '1 NAME Researcher Two',
  '0 @I1@ INDI',
  '1 NAME Child /One/',
  '1 SEX F',
  '2 SOUR @S1@',
  '3 PAGE Sex evidence',
  '1 ISDEAD Y',
  '1 ANCI @U1@',
  '1 DESI @U2@',
  '1 SUBM @U1@',
  '1 FAMC @F1@',
  '2 PEDI adopted',
  '2 STAT proven',
  '3 PHRASE documented',
  '2 NOTE FAMC note',
  '1 FAMS @F2@',
  '2 NOTE FAMS note',
  '1 BIRT',
  '2 DATE 1 JAN 2000',
  '2 FAMC @F1@',
  '1 ADOP',
  '2 DATE 2 FEB 2001',
  '2 FAMC @F1@',
  '3 ADOP BOTH',
  '4 PHRASE both parents',
  '1 CHR',
  '2 DATE 3 MAR 2000',
  '2 FAMC @F1@',
  '1 WILL',
  '2 TEXT last will text',
  '0 @I2@ INDI',
  '1 NAME Spouse /Two/',
  '1 FAMS @F2@',
  '0 @I3@ INDI',
  '1 NAME Parent /One/',
  '1 FAMS @F1@',
  '0 @I4@ INDI',
  '1 NAME Parent /Two/',
  '1 FAMS @F1@',
  '0 @F1@ FAM',
  '1 HUSB @I3@',
  '1 WIFE @I4@',
  '1 CHIL @I1@',
  '0 @F2@ FAM',
  '1 HUSB @I2@',
  '1 WIFE @I1@',
  '0 @S1@ SOUR',
  '1 TITL Sex source',
  '0 TRLR',
].join('\n');

describe('P1 schema v5 GEDCOM structures', () => {
  it('imports and round-trips submitter kinds, death status, person citations, link details, event families and will text', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(GEDCOM), fixture.repo);
      const person = fixture.repo.listAllPersons().find((entry) => entry.names[0]?.given === 'Child')!;
      expect(person.deathStatus).toBe('dead');

      const submitterLinks = fixture.repo.listSubmitterLinksFor('person', person.id);
      expect(submitterLinks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'contributor' }),
          expect.objectContaining({ kind: 'ancestor_interest' }),
          expect.objectContaining({ kind: 'descendant_interest' }),
        ]),
      );
      expect(fixture.repo.listCitationRecordsFor('person', person.id)).toHaveLength(1);

      const families = fixture.repo.listFamilies();
      const childFamily = families.find((entry) =>
        (entry.childLinks ?? []).some((link) => link.childId === person.id),
      )!;
      const childLink = (childFamily.childLinks ?? []).find((link) => link.childId === person.id)!;
      expect(childLink.statusPhrase).toBe('documented');
      expect(fixture.repo.listNotesFor('family_child', childLink.id).map((note) => note.text)).toEqual(['FAMC note']);

      const spouseFamily = families.find((entry) =>
        (entry.partnerLinks ?? []).some((link) => link.personId === person.id),
      )!;
      const partnerLink = (spouseFamily.partnerLinks ?? []).find((link) => link.personId === person.id)!;
      expect(fixture.repo.listNotesFor('family_partner', partnerLink.id).map((note) => note.text)).toEqual([
        'FAMS note',
      ]);

      const birth = person.facts.find((fact) => fact.tag === 'BIRT')!;
      expect(birth.familyLinks?.[0]?.familyId).toBe(childFamily.id);
      const adoption = person.facts.find((fact) => fact.tag === 'ADOP')!;
      expect(adoption.familyLinks?.[0]).toMatchObject({
        familyId: childFamily.id,
        adoptedBy: 'BOTH',
        phrase: 'both parents',
      });
      const christening = person.facts.find((fact) => fact.tag === 'CHR')!;
      expect(christening.familyLinks?.[0]?.familyId).toBe(childFamily.id);
      const will = person.facts.find((fact) => fact.tag === 'WILL')!;
      expect(fixture.repo.listNotesFor('fact', will.id).map((note) => note.text)).toEqual(['last will text']);

      for (const [serialize, is70] of [
        [serializeGedcom70, true],
        [serializeGedcom551, false],
      ] as const) {
        const serialized = serialize(buildGedcomDataset(fixture.repo));
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        const text = serialized.value;
        expect(text).toContain('1 ISDEAD Y');
        const ancestorInterest = text.match(/^1 ANCI (@U\d+@)$/m)?.[1];
        const descendantInterest = text.match(/^1 DESI (@U\d+@)$/m)?.[1];
        expect(ancestorInterest).toBeDefined();
        expect(descendantInterest).toBeDefined();
        expect(ancestorInterest).not.toBe(descendantInterest);
        expect(text).toContain('1 SEX F');
        expect(text).toContain('1 SOUR @S1@');
        expect(text).toContain('2 PAGE Sex evidence');
        if (is70) {
          expect(text).toContain('3 PHRASE documented');
          expect(text).toContain('4 PHRASE both parents');
        }
        expect(text).toContain('2 NOTE FAMC note');
        expect(text).toContain('2 NOTE FAMS note');
        expect(text).toContain('3 ADOP BOTH');
        expect(text).toContain('2 NOTE last will text');

        const target = makeRepo();
        try {
          importGedcomDataset(parseDataset(text), target.repo);
          const imported = target.repo.listAllPersons().find((entry) => entry.names[0]?.given === 'Child')!;
          expect(imported.deathStatus).toBe('dead');
          const links = target.repo.listSubmitterLinksFor('person', imported.id);
          const submitterLabel = new Map(
            target.repo
              .listSubmitters()
              .map((submitter) => [submitter.id, submitter.name === 'Researcher One' ? 'U1' : 'U2']),
          );
          expect(links.map((link) => `${link.kind}:${submitterLabel.get(link.submitterId)}`).sort()).toEqual([
            'ancestor_interest:U1',
            'contributor:U1',
            'descendant_interest:U2',
          ]);
          expect(target.repo.listCitationRecordsFor('person', imported.id)).toHaveLength(1);
          expect(imported.facts.find((fact) => fact.tag === 'ADOP')?.familyLinks?.[0]).toMatchObject({
            adoptedBy: 'BOTH',
            ...(is70 ? { phrase: 'both parents' } : {}),
          });
          expect(target.repo.listNotesFor('fact', imported.facts.find((fact) => fact.tag === 'WILL')!.id)).toHaveLength(
            1,
          );
        } finally {
          cleanupRepo(target);
        }
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
