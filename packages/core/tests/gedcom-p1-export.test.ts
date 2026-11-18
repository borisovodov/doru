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

describe('P1 GEDCOM export gaps', () => {
  it('round-trips family non-events, godparents, source certainty, place metadata and todos', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertRepository({ id: 'R1', name: 'State Archive' });
      repo.insertSource({ id: 'S1', title: 'Register', certainty: '2' });
      repo.insertPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }],
      });
      repo.insertIdentifier({
        id: 'PI1',
        targetType: 'place',
        targetId: 'PL1',
        namespace: 'refn',
        type: 'register',
        value: 'PLACE-1',
      });
      repo.insertChange({
        id: 'PC1',
        targetType: 'place',
        targetId: 'PL1',
        kind: 'changed',
        date: { quality: 'exact', component: { year: 2020 } },
      });
      repo.insertPerson({
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan' }],
        sex: 'M',
        facts: [
          {
            id: 'F1',
            personId: 'P1',
            tag: 'BIRT',
            participants: [
              { id: 'PT1', value: 'Godparent Name', role: 'GODP', position: 0 },
              { id: 'PT2', value: 'Witness Name', role: 'WITN', position: 1 },
            ],
          },
        ],
      });
      repo.insertFamily({ id: 'FAM1', partners: ['P1'], children: [] });
      repo.insertFact({
        id: 'FM1',
        familyId: 'FAM1',
        tag: 'MARR',
        date: { quality: 'exact', component: { year: 1890 } },
        flags: ['preferred', 'private'],
        primary: true,
        participants: [
          { id: 'FP1', value: 'Family Godparent', role: 'GODP', position: 0 },
          { id: 'FP2', value: 'Family Witness', role: 'WITN', position: 1 },
        ],
      });
      repo.insertFact({
        id: 'FN1',
        familyId: 'FAM1',
        tag: 'MARR',
        negation: true,
        date: { quality: 'exact', component: { year: 1900 } },
      });
      repo.addSourceCitation('S1', 'fact', 'FN1');
      repo.insertNote({ id: 'NF1', text: 'family non-event note', targetType: 'fact', targetId: 'FN1' });
      repo.insertTodo({
        id: 'T1',
        text: 'Free task',
        createdDate: { quality: 'exact', component: { year: 2026, month: 11, day: 17 } },
        repositoryId: 'R1',
      });
      repo.insertTodo({
        id: 'T2',
        text: 'Attached task',
        targetType: 'person',
        targetId: 'P1',
        createdDate: { quality: 'exact', component: { year: 2026, month: 11, day: 18 } },
        repositoryId: 'R1',
      });

      for (const [serialize, hasPlaceCards, hasNonEvents] of [
        [serializeGedcom70, true, true],
        [serializeGedcom551, false, false],
      ] as const) {
        const serialized = serialize(buildGedcomDataset(repo));
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        const text = serialized.value;
        expect(text).toContain('_GODP Godparent Name');
        expect(text).toContain('_WITN Witness Name');
        expect(text).toContain('_GODP Family Godparent');
        expect(text).toContain('_WITN Family Witness');
        expect(text).toContain('_FLGS');
        expect(text).toContain('__PREFERRED Preferred');
        expect(text).toContain('__PRIVATE Private');
        expect(text).toContain('1 QUAY 2');
        if (hasPlaceCards) {
          // 5.5.1 has no place-card record: the identifiers and CHAN have
          // no slot and only the 7.0 `_PLAC` record can carry them.
          expect(text).toContain('1 REFN PLACE-1');
          expect(text).toContain('1 CHAN');
        }
        expect(text).toContain('_TCDT 2026-11-17');
        expect(text).toContain('_TCDT 2026-11-18');
        expect(text).toContain('REPO @R1@');

        const target = makeRepo();
        try {
          importGedcomDataset(parseDataset(text), target.repo);
          const person = target.repo.listAllPersons().find((entry) => entry.names[0]?.given === 'Ivan')!;
          const birth = person.facts.find((fact) => fact.tag === 'BIRT')!;
          expect(birth.participants).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ value: 'Godparent Name', role: 'GODP' }),
              expect.objectContaining({ value: 'Witness Name', role: 'WITN' }),
            ]),
          );

          const family = target.repo.listFamilies()[0]!;
          const marriage = target.repo
            .listFactsForFamily(family.id)
            .find((fact) => fact.tag === 'MARR' && fact.date?.component?.year === 1890)!;
          expect(marriage.flags).toEqual(expect.arrayContaining(['preferred', 'private']));
          expect(marriage.primary).toBe(true);
          expect(marriage.participants).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ value: 'Family Godparent', role: 'GODP' }),
              expect.objectContaining({ value: 'Family Witness', role: 'WITN' }),
            ]),
          );

          if (hasNonEvents) {
            const nonEvent = target.repo.listFactsForFamily(family.id).find((fact) => fact.negation === true)!;
            expect(target.repo.listCitationRecordsFor('fact', nonEvent.id)).toHaveLength(1);
            expect(target.repo.listNotesFor('fact', nonEvent.id).map((entry) => entry.text)).toEqual([
              'family non-event note',
            ]);
          }

          expect(target.repo.listSources()[0]?.certainty).toBe('2');

          if (hasPlaceCards) {
            const place = target.repo.listPlaces()[0]!;
            expect(target.repo.listIdentifiersFor('place', place.id)).toEqual(
              expect.arrayContaining([expect.objectContaining({ namespace: 'refn', value: 'PLACE-1' })]),
            );
            expect(target.repo.listChangesFor('place', place.id).some((entry) => entry.kind === 'changed')).toBe(true);
          }

          const repository = target.repo.listRepositories()[0]!;
          const todos = target.repo.listTodos();
          expect(todos.find((todo) => todo.text === 'Free task')).toMatchObject({
            createdDate: { quality: 'exact', component: { year: 2026, month: 11, day: 17 } },
            repositoryId: repository.id,
          });
          expect(todos.find((todo) => todo.text === 'Attached task')).toMatchObject({
            createdDate: { quality: 'exact', component: { year: 2026, month: 11, day: 18 } },
            repositoryId: repository.id,
          });
        } finally {
          cleanupRepo(target);
        }
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
  it('pads task years below 1000 when exporting _TCDT', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertTodo({
        id: 'T1',
        text: 'Ancient task',
        createdDate: { quality: 'exact', component: { year: 999, month: 11, day: 17 } },
      });
      const serialized = serializeGedcom70(buildGedcomDataset(repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toContain('_TCDT 0999-11-17');

      const target = makeRepo();
      try {
        importGedcomDataset(parseDataset(serialized.value), target.repo);
        expect(target.repo.listTodos()[0]?.createdDate).toMatchObject({
          quality: 'exact',
          component: { year: 999, month: 11, day: 17 },
        });
      } finally {
        cleanupRepo(target);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('ties the adoption marker to the exported partner slot', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'P2', names: [], sex: 'F', facts: [] });
      repo.insertPerson({ id: 'P3', names: [], sex: 'F', facts: [] });
      repo.insertFamily({ id: 'F1', partners: ['P2'], children: ['P1'] });
      repo.insertFamily({ id: 'F2', partners: ['P2', 'P3'], children: ['P1'] });
      repo.updatePerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          {
            id: 'ADOP1',
            personId: 'P1',
            tag: 'ADOP',
            familyLinks: [{ id: 'FF1', familyId: 'F1', adoptedBy: 'WIFE', position: 0 }],
          },
          {
            id: 'ADOP2',
            personId: 'P1',
            tag: 'ADOP',
            familyLinks: [{ id: 'FF2', familyId: 'F2', adoptedBy: 'WIFE', position: 0 }],
          },
        ],
      });

      for (const serialize of [serializeGedcom70, serializeGedcom551]) {
        const serialized = serialize(buildGedcomDataset(repo));
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        const adoptionEvents = [
          ...serialized.value.matchAll(/(?:^|\n)1 ADOP\r?\n([\s\S]*?)(?=\r?\n1 |\r?\n0 |$)/g),
        ].map((match) => match[0]);
        const singlePartner = adoptionEvents.find((event) => event.includes('FAMC @F1@'));
        const twoPartners = adoptionEvents.find((event) => event.includes('FAMC @F2@'));
        expect(singlePartner).toContain('ADOP HUSB');
        expect(twoPartners).toContain('ADOP WIFE');
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
