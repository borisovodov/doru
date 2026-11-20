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
        expect(text).toContain('1 _QUAY 2');
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
          const freeTask = todos.find((todo) => todo.text === 'Free task')!;
          const attachedTask = todos.find((todo) => todo.text === 'Attached task')!;
          expect(freeTask).toMatchObject({
            createdDate: { quality: 'exact', component: { year: 2026, month: 11, day: 17 } },
            repositoryId: repository.id,
          });
          expect(freeTask.targetType).toBeUndefined();
          expect(freeTask.targetId).toBeUndefined();
          expect(attachedTask).toMatchObject({
            createdDate: { quality: 'exact', component: { year: 2026, month: 11, day: 18 } },
            repositoryId: repository.id,
            targetType: 'person',
            targetId: person.id,
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
      repo.insertTodo({
        id: 'T2',
        text: 'Approximate task',
        createdDate: { quality: 'about', component: { year: 1900 }, text: 'circa' },
      });
      repo.insertTodo({
        id: 'T3',
        text: 'End-only task',
        createdDate: { quality: 'range', end: { year: 1900 } },
      });
      repo.insertTodo({
        id: 'T4',
        text: 'Unknown text task',
        createdDate: { quality: 'unknown', text: '1900' },
      });
      repo.insertTodo({
        id: 'T5',
        text: 'Julian task',
        createdDate: {
          quality: 'about',
          modifier: 'CAL',
          component: { calendar: 'julian', year: 1900, month: 1, day: 1 },
          time: { hour: 12, minute: 0 },
        },
      });
      repo.insertTodo({
        id: 'T6',
        text: 'Yearless task',
        createdDate: { quality: 'exact', component: { month: 5, day: 3 } },
      });
      repo.insertTodo({
        id: 'T7',
        text: 'Day-only task',
        createdDate: { quality: 'exact', component: { year: 1900, day: 15 } },
      });
      repo.insertTodo({
        id: 'T8',
        text: 'Julian leap task',
        createdDate: { quality: 'exact', component: { calendar: 'julian', year: 1900, month: 2, day: 29 } },
      });
      repo.insertTodo({
        id: 'T9',
        text: 'Text-only approximate task',
        createdDate: { quality: 'about', text: 'circa spring' },
      });
      repo.insertTodo({
        id: 'T10',
        text: 'Long-year task',
        createdDate: { quality: 'exact', component: { year: 10000 } },
      });
      const serialized = serializeGedcom70(buildGedcomDataset(repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toContain('_TCDT 0999-11-17');
      expect(serialized.value).toContain('_TCDT about:1900|circa');
      expect(serialized.value).toContain('_TCDT range:..1900');
      expect(serialized.value).toContain('_TCDT unknown:|1900');
      expect(serialized.value).toContain('_TCDT json:');

      const target = makeRepo();
      try {
        importGedcomDataset(parseDataset(serialized.value), target.repo);
        expect(target.repo.listTodos().find((todo) => todo.text === 'Ancient task')?.createdDate).toMatchObject({
          quality: 'exact',
          component: { year: 999, month: 11, day: 17 },
        });
        expect(target.repo.listTodos().find((todo) => todo.text === 'Approximate task')?.createdDate).toMatchObject({
          quality: 'about',
          component: { year: 1900 },
          text: 'circa',
        });
        expect(target.repo.listTodos().find((todo) => todo.text === 'End-only task')?.createdDate).toMatchObject({
          quality: 'range',
          end: { year: 1900 },
        });
        expect(target.repo.listTodos().find((todo) => todo.text === 'Unknown text task')?.createdDate).toMatchObject({
          quality: 'unknown',
          text: '1900',
        });
        expect(target.repo.listTodos().find((todo) => todo.text === 'Julian task')?.createdDate).toMatchObject({
          quality: 'about',
          modifier: 'CAL',
          component: { calendar: 'julian', year: 1900, month: 1, day: 1 },
          time: { hour: 12, minute: 0 },
        });
        expect(target.repo.listTodos().find((todo) => todo.text === 'Yearless task')?.createdDate).toMatchObject({
          quality: 'exact',
          component: { month: 5, day: 3 },
        });
        expect(target.repo.listTodos().find((todo) => todo.text === 'Day-only task')?.createdDate).toMatchObject({
          quality: 'exact',
          component: { year: 1900, day: 15 },
        });
        expect(target.repo.listTodos().find((todo) => todo.text === 'Julian leap task')?.createdDate).toMatchObject({
          quality: 'exact',
          component: { calendar: 'julian', year: 1900, month: 2, day: 29 },
        });
        expect(
          target.repo.listTodos().find((todo) => todo.text === 'Text-only approximate task')?.createdDate,
        ).toMatchObject({ quality: 'about', text: 'circa spring' });
        expect(target.repo.listTodos().find((todo) => todo.text === 'Long-year task')?.createdDate).toMatchObject({
          quality: 'exact',
          component: { year: 10000 },
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

  it('round-trips a phrase-only adoption link without leaving a marker note', () => {
    const fixture = makeRepo();
    const target = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertFamily({ id: 'F1', partners: [], children: ['P1'] });
      repo.updatePerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          {
            id: 'ADOP1',
            personId: 'P1',
            tag: 'ADOP',
            familyLinks: [{ id: 'FF1', familyId: 'F1', phrase: 'raised together', position: 0 }],
          },
        ],
      });
      const serialized = serializeGedcom70(buildGedcomDataset(repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toContain('_DORU_ADOP raised together');

      importGedcomDataset(parseDataset(serialized.value), target.repo);
      const child = target.repo.listAllPersons().find((entry) => entry.facts.some((fact) => fact.tag === 'ADOP'))!;
      const fact = child.facts.find((entry) => entry.tag === 'ADOP')!;
      expect(fact.familyLinks?.[0]?.phrase).toBe('raised together');
      expect(target.repo.listAttachmentsFor('fact', fact.id).noteLinks).toEqual([]);
    } finally {
      cleanupRepo(fixture);
      cleanupRepo(target);
    }
  });

  it('round-trips metadata on a disproven child link', () => {
    const fixture = makeRepo();
    const target = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'C1', names: [], sex: 'U', facts: [] });
      repo.insertFamily({
        id: 'F1',
        partners: ['P1'],
        children: ['C1'],
        childLinks: [
          {
            id: 'CL1',
            childId: 'C1',
            status: 'disproven',
            statusPhrase: 'not the father',
            multiplicity: 'TWIN',
            preferred: true,
          },
        ],
      });
      const serialized = serializeGedcom70(buildGedcomDataset(repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toMatch(/1 CHIL @I\d+@\r?\n(?:2 .*\r?\n)*?2 _STAT TWIN/);

      importGedcomDataset(parseDataset(serialized.value), target.repo);
      const family = target.repo.listFamilies()[0]!;
      const link = family.childLinks?.[0];
      expect(link).toMatchObject({ status: 'disproven', multiplicity: 'TWIN', preferred: true });
    } finally {
      cleanupRepo(fixture);
      cleanupRepo(target);
    }
  });

  it('uses the structured task date when its phrase has trailing whitespace', () => {
    const fixture = makeRepo();
    const target = makeRepo();
    try {
      fixture.repo.insertTodo({
        id: 'T1',
        text: 'Task',
        createdDate: { quality: 'exact', component: { year: 1900 }, text: 'recorded ' },
      });
      const serialized = serializeGedcom70(buildGedcomDataset(fixture.repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toContain('json:');
      importGedcomDataset(parseDataset(serialized.value), target.repo);
      expect(target.repo.listTodos()[0]?.createdDate).toMatchObject({ quality: 'exact', text: 'recorded ' });
    } finally {
      cleanupRepo(fixture);
      cleanupRepo(target);
    }
  });

  it('moves an imported wife-only adoption marker with the exported slot', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(
        parseDataset(
          [
            '0 HEAD',
            '1 GEDC',
            '2 VERS 7.0',
            '0 @I1@ INDI',
            '1 NAME Child /Example/',
            '1 ADOP',
            '2 FAMC @F1@',
            '3 ADOP WIFE',
            '0 @I2@ INDI',
            '1 NAME Wife /Example/',
            '0 @F1@ FAM',
            '1 WIFE @I2@',
            '1 CHIL @I1@',
            '0 TRLR',
          ].join('\n'),
        ),
        fixture.repo,
      );
      const child = fixture.repo.listAllPersons().find((person) => person.names[0]?.given === 'Child')!;
      expect(child.facts[0]?.familyLinks?.[0]?.adoptedBy).toBe('HUSB');

      const serialized = serializeGedcom70(buildGedcomDataset(fixture.repo));
      expect(serialized.ok).toBe(true);
      if (serialized.ok) {
        expect(serialized.value).toMatch(/1 ADOP\r?\n2 FAMC @F1@\r?\n3 ADOP HUSB/);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
