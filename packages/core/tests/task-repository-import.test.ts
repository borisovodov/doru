import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom70, type GedcomDataset } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @R1@ REPO',
  '1 NAME State Archive',
  '0 @TD1@ _TODO Check the archive',
  '1 REPO @R1@',
  '0 @TD2@ _TODO Unresolved repository',
  '1 REPO @R9@',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 _TODO Person task',
  '2 REPO @R1@',
  '0 TRLR',
].join('\n');

function parseDataset(text: string): GedcomDataset {
  const result = parse(new TextEncoder().encode(text));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  return result.value.dataset;
}

describe('GEDCOM task repository import', () => {
  it('turns _TODO.REPO into a repository target', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      importGedcomDataset(parseDataset(GEDCOM), repo);

      const repository = repo.listRepositories()[0]!;
      const tasks = repo.listTasks();

      // The record form becomes a repository-only task.
      const recordTask = tasks.find((task) => task.text === 'Check the archive')!;
      expect(recordTask.targets).toEqual([
        expect.objectContaining({ targetType: 'repository', targetId: repository.id }),
      ]);

      // An unresolved pointer does not create a dangling target.
      const unresolved = tasks.find((task) => task.text === 'Unresolved repository')!;
      expect(unresolved.targets).toEqual([]);

      // The INDI structure keeps its person target and gains the repository.
      const person = repo.listAllPersons()[0]!;
      const personTask = tasks.find((task) => task.text === 'Person task')!;
      expect(personTask.targets).toHaveLength(2);
      expect(personTask.targets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ targetType: 'person', targetId: person.id }),
          expect.objectContaining({ targetType: 'repository', targetId: repository.id }),
        ]),
      );

      expect(repo.listTasksFor('person', person.id)).toEqual([expect.objectContaining({ id: personTask.id })]);
      expect(repo.listTasksFor('repository', repository.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: recordTask.id }),
          expect.objectContaining({ id: personTask.id }),
        ]),
      );
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deliberately omits repository-only tasks from export', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      importGedcomDataset(parseDataset(GEDCOM), repo);

      const serialized = serializeGedcom70(buildGedcomDataset(repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }

      // The record-form task has only a repository target, and Dóru does not
      // write _TODO.REPO, so the task disappears from the export.
      expect(serialized.value).not.toContain('Check the archive');
      // The unresolved task is free-standing and still exports as a record.
      expect(serialized.value).toContain('Unresolved repository');
      // The person task is embedded under its person and survives.
      expect(serialized.value).toContain('Person task');
    } finally {
      cleanupRepo(fixture);
    }
  });
});
