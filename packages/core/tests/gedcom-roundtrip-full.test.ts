import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom70 } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';
import type { RepoFixture } from './helpers';
import { buildKitchenSinkTree } from './kitchen-sink';

function serializeAndParse(fixture: RepoFixture) {
  const dataset = buildGedcomDataset(fixture.repo);
  const serialized = serializeGedcom70(dataset);
  if (!serialized.ok) {
    throw new Error(`serialization failed: ${serialized.error.message}`);
  }
  const reparsed = parse(new TextEncoder().encode(serialized.value));
  if (!reparsed.ok) {
    throw new Error(`reparse failed: ${reparsed.error.message}`);
  }
  if (reparsed.value.kind !== 'dataset') {
    throw new Error('reparse produced no dataset');
  }
  return reparsed.value.dataset;
}

describe('buildGedcomDataset kitchen sink', () => {
  it('exports the full model and re-imports it without loss on the core entities', { timeout: 240_000 }, () => {
    const fixture = makeRepo();
    try {
      buildKitchenSinkTree(fixture);
      const dataset = serializeAndParse(fixture);

      // The dataset itself carries every record kind.
      const tags = dataset.records.map((record) => record.tag);
      expect(tags).toContain('INDI');
      expect(tags).toContain('FAM');
      expect(tags).toContain('SOUR');
      expect(tags).toContain('REPO');
      expect(tags).toContain('SUBM');
      expect(tags).toContain('TITL');
      expect(tags).toContain('SNOTE');
      expect(tags).toContain('_TODO');
      expect(tags).toContain('_TAG');
      // The evidence/research, census and event-definition records stay
      // out of the tree: the export must not carry them.
      expect(tags).not.toContain('_EVID');
      expect(tags).not.toContain('_RDOC');
      expect(tags).not.toContain('_RACT');
      expect(tags).not.toContain('_CENR');
      expect(tags).not.toContain('_EVENT_DEFN');
      // The SUBN record is asserted against the direct dataset in the
      // header test below — the parser folds the submission record away.

      const target = makeRepo();
      try {
        importGedcomDataset(dataset, target.repo);

        const persons = target.repo.listAllPersons();
        expect(persons).toHaveLength(3);
        const ivan = persons.find((entry) => entry.names[0]?.given === 'Ivan');
        expect(ivan?.sex).toBe('M');
        const birth = ivan?.facts.find((fact) => fact.tag === 'BIRT');
        expect(birth?.place).toBe('Moscow, Russia');
        expect(new Set(birth?.flags)).toEqual(new Set(['private', 'preferred']));
        expect(birth?.primary).toBe(true);
        expect(ivan?.names[0]?.date?.component).toEqual(expect.objectContaining({ year: 1923 }));
        expect(ivan?.names[0]?.full).toBe('Dr. Ivan von Petrov Jr.');
        expect(ivan?.names[0]?.language).toBe('ru');
        expect(
          target.repo
            .listIdentifiersFor('person', ivan!.id)
            .map((entry) => entry.namespace)
            .sort(),
        ).toEqual(['daboville', 'exid', 'refn', 'sosa', 'uid']);

        const families = target.repo.listFamilies();
        expect(families).toHaveLength(1);
        expect(families[0]?.partners).toHaveLength(2);
        expect(families[0]?.children).toHaveLength(1);

        const places = target.repo.listPlaces();
        expect(places).toHaveLength(2);
        const moscow = places.find((place) => place.names.some((name) => name.value === 'Moscow'));
        const russia = places.find((place) => place.id !== moscow?.id);
        expect(moscow?.verified).toBe(true);
        expect(moscow?.hierarchy).toEqual([expect.objectContaining({ parentId: russia?.id, type: 'poli' })]);
        expect(moscow?.postalCodes?.[0]?.code).toBe('101000');
        expect(moscow?.names.some((name) => name.kind === 'translation')).toBe(true);

        const media = target.repo.listAllMedia();
        expect(media).toHaveLength(1);
        expect(media[0]?.title).toBe('Portrait');
        expect(media[0]?.files?.[0]?.path).toBe('media/photo.jpg');
        expect(target.repo.listMediaFor('person', ivan!.id)).toHaveLength(1);

        const tasks = target.repo.listTasks();
        expect(tasks.find((task) => task.text === 'Order the birth record')).toMatchObject({
          status: 'closed',
          scheduledAt: new Date(2026, 0, 2).getTime(),
          reminderAt: new Date(2026, 1, 3).getTime(),
          closedAt: new Date(2026, 2, 4).getTime(),
        });
        expect(tasks.find((task) => task.text === 'Visit the cemetery')?.closedAt).toBeUndefined();

        expect(target.repo.listSources()).toHaveLength(1);
        expect(target.repo.listSources()[0]?.texts).toHaveLength(2);
        expect(
          target.repo
            .listSources()[0]
            ?.texts?.map((text) => text.text)
            .sort(),
        ).toEqual(['A note about the source', 'A second transcription'].sort());
        expect(target.repo.listAddresses()[0]?.lines.map((line) => line.value)).toEqual([
          '12 Archive Lane',
          'Building 3',
        ]);
        expect(target.repo.listRepositories()).toHaveLength(1);
        expect(target.repo.listSubmitters()).toHaveLength(1);
        expect(target.repo.listTitles()).toHaveLength(1);
        expect(target.repo.listNotes()).toHaveLength(2);
        expect(target.repo.listTags()).toHaveLength(1);
        expect(target.repo.listAssociations().length).toBeGreaterThan(0);
      } finally {
        cleanupRepo(target);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('exports a synthesized header naming the app as the source', () => {
    const fixture = makeRepo();
    try {
      const dataset = buildGedcomDataset(fixture.repo);
      expect(dataset.header.gedcom).toEqual({ version: '7.0' });
      expect(dataset.header.source).toMatchObject({ payload: 'DORU' });
      const submission = dataset.records.find((record) => record.tag === 'SUBN');
      expect(submission).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps non-numeric month codes and calendar mappings', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [
          {
            id: 'F1',
            personId: 'P1',
            tag: 'BIRT',
            date: { quality: 'exact', component: { calendar: 'french_republican', year: 3, month: 'VEND' } },
          },
          {
            id: 'F2',
            personId: 'P1',
            tag: 'DEAT',
            date: { quality: 'exact', component: { calendar: 'hebrew', year: 5700 } },
          },
          { id: 'F3', personId: 'P1', tag: 'BURI', date: { quality: 'range', end: { year: 1999 } } },
          { id: 'F4', personId: 'P1', tag: 'CHR', date: { quality: 'range', component: { year: 1900 } } },
          { id: 'F5', personId: 'P1', tag: 'OCCU', value: 'x', date: { quality: 'range' } },
        ],
      });
      const dataset = buildGedcomDataset(fixture.repo);
      const serialized = serializeGedcom70(dataset);
      expect(serialized.ok).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
