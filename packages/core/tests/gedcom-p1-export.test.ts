import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom551, serializeGedcom70, type GedcomDataset, type IndividualRecord } from '@doru/gedcom';
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
  it('round-trips family non-events, godparents, source certainty, place metadata and tasks', () => {
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
      repo.insertTask({
        id: 'T1',
        text: 'Free task',
        targets: [],
        status: 'waiting',
        createdAt: new Date(2026, 10, 17).getTime(),
      });
      repo.insertTask({
        id: 'T2',
        text: 'Attached task',
        targets: [{ id: 'TL2', taskId: 'T2', targetType: 'person', targetId: 'P1' }],
        status: 'waiting',
        createdAt: new Date(2026, 10, 18).getTime(),
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
          // 5.5.1 has no place-card record: the identifiers have no slot and
          // only the 7.0 `_PLAC` record can carry them.
          expect(text).toContain('1 REFN PLACE-1');
        }
        expect(text).toContain(`_TCDT ${new Date(2026, 10, 17).toISOString()}`);
        expect(text).toContain(`_TCDT ${new Date(2026, 10, 18).toISOString()}`);
        expect(text).toContain('_TSTS Waiting');
        expect(text).toContain('STAT Waiting');

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
          }

          const tasks = target.repo.listTasks();
          const freeTask = tasks.find((task) => task.text === 'Free task')!;
          const attachedTask = tasks.find((task) => task.text === 'Attached task')!;
          expect(freeTask).toMatchObject({
            createdAt: new Date(2026, 10, 17).getTime(),
          });
          expect(freeTask.targets).toEqual([]);
          expect(attachedTask).toMatchObject({
            createdAt: new Date(2026, 10, 18).getTime(),
            targets: [expect.objectContaining({ targetType: 'person', targetId: person.id })],
          });
        } finally {
          cleanupRepo(target);
        }
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
  it('does not export task identifiers as _UID', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertTask({ id: 'T1', text: 'Free task', targets: [] });
      repo.insertTask({
        id: 'T2',
        text: 'Attached task',
        targets: [{ id: 'TL2', taskId: 'T2', targetType: 'person', targetId: 'P1' }],
      });
      repo.insertIdentifier({
        id: 'TI1',
        targetType: 'task',
        targetId: 'T1',
        namespace: 'uid',
        value: 'free-task-uid',
      });
      repo.insertIdentifier({
        id: 'TI2',
        targetType: 'task',
        targetId: 'T2',
        namespace: 'uid',
        value: 'attached-task-uid',
      });

      for (const serialize of [serializeGedcom70, serializeGedcom551]) {
        const serialized = serialize(buildGedcomDataset(repo));
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        expect(serialized.value).not.toContain('free-task-uid');
        expect(serialized.value).not.toContain('attached-task-uid');
        expect(serialized.value).not.toMatch(/^1 _UID /m);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('omits task timestamps outside the Date range instead of throwing', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const outside = 8_640_000_000_000_001;
      const expandedYear = new Date(0);
      expandedYear.setUTCFullYear(10_000, 0, 1);
      expandedYear.setUTCHours(0, 0, 0, 0);
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertTask({ id: 'T1', text: 'Free task', targets: [], createdAt: outside, remindAt: outside });
      repo.insertTask({
        id: 'T2',
        text: 'Attached task',
        targets: [{ id: 'TL2', taskId: 'T2', targetType: 'person', targetId: 'P1' }],
        createdAt: expandedYear.getTime(),
        remindAt: outside,
      });

      for (const serialize of [serializeGedcom70, serializeGedcom551]) {
        const serialized = serialize(buildGedcomDataset(repo));
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        expect(serialized.value).not.toContain('_TCDT');
        expect(serialized.value).not.toContain('_TSDT');
        expect(serialized.value).not.toContain('_RDATE');
        expect(serialized.value).not.toContain('_CDATE');
        expect(serialized.value).not.toContain('+010000');
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('omits zoned task instants from GEDCOM 5.5.1 but keeps them in 7.0', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const createdAt = Date.UTC(2026, 0, 1, 8, 0);
      const remindAt = Date.UTC(2026, 1, 3, 10, 0);
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertTask({
        id: 'T1',
        text: 'Attached task',
        targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' }],
        status: 'closed',
        createdAt,
        remindAt,
      });

      const dataset = buildGedcomDataset(repo);
      const serialized70 = serializeGedcom70(dataset);
      expect(serialized70.ok).toBe(true);
      if (!serialized70.ok) {
        return;
      }
      const individual70 = parseDataset(serialized70.value).records.find(
        (record): record is IndividualRecord => record.tag === 'INDI',
      );
      expect(individual70?.todos?.[0]).toMatchObject({
        createdDate: expect.any(String),
        reminderDate: { time: { utc: true } },
      });

      const serialized551 = serializeGedcom551(dataset);
      expect(serialized551.ok).toBe(true);
      if (!serialized551.ok) {
        return;
      }
      const individual551 = parseDataset(serialized551.value).records.find(
        (record): record is IndividualRecord => record.tag === 'INDI',
      );
      const task = individual551?.todos?.[0];
      expect(task?.createdDate).toBeDefined();
      expect(task?.date).toBeUndefined();
      expect(task?.reminderDate).toBeUndefined();
      expect(task?.closedDate).toBeUndefined();
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
