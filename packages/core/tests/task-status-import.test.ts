import { describe, expect, it } from 'vitest';
import { parse } from '@doru/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @T1@ _TODO Record task',
  '1 _TSTS Completed',
  '1 _TPTY HIGH',
  '0 @T2@ _TODO Second record task',
  '1 _TSTS INPROGRESS',
  '1 _TPTY 8',
  '0 @T3@ _TODO Unknown task',
  '1 _TSTS needs review',
  '1 _TPTY needs review',
  '0 @T4@ _TODO Missing status task',
  '0 @T5@ _TASK',
  '1 _TDSC Payload only',
  '1 _TTIL Ignored title',
  '1 _TSTS Completed',
  '1 _TSDT 2026-01-02',
  '1 _TRDT 2026-02-03',
  '1 _CDATE 2026-03-04',
  '0 @I1@ INDI',
  '1 NAME Test /Person/',
  '1 _TODO Attached task',
  '2 STAT InProgress',
  '2 PRTY 1',
  '2 TYPE 0',
  '2 DATA Solution details',
  '0 TRLR',
].join('\n');

function parseDataset(text: string) {
  const result = parse(new TextEncoder().encode(text));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  return result.value.dataset;
}

describe('GEDCOM task status and priority import', () => {
  it('maps known spellings and normalizes unknown/missing values', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(GEDCOM), fixture.repo);
      const tasks = fixture.repo.listTasks();

      expect(tasks.find((task) => task.text === 'Record task')).toMatchObject({
        status: 'closed',
        priority: 'high',
      });
      expect(tasks.find((task) => task.text === 'Second record task')).toMatchObject({
        status: 'in-progress',
        priority: 'low',
      });
      expect(tasks.find((task) => task.text === 'Unknown task')).toMatchObject({
        status: 'open',
        priority: 'medium',
      });
      expect(tasks.find((task) => task.text === 'Missing status task')).toMatchObject({
        status: 'open',
        priority: 'medium',
      });
      expect(tasks.find((task) => task.text === 'Attached task')).toMatchObject({
        status: 'in-progress',
        priority: 'high',
      });
      const titled = tasks.find((task) => task.text === 'Payload only')!;
      expect(titled).toMatchObject({
        scheduledAt: new Date(2026, 0, 2).getTime(),
        reminderAt: new Date(2026, 1, 3).getTime(),
        closedAt: new Date(2026, 2, 4).getTime(),
      });
      expect(titled).not.toHaveProperty('title');
      expect(titled).not.toHaveProperty('type');
      expect(tasks.find((task) => task.text === 'Attached task')).not.toHaveProperty('type');
      expect(tasks.find((task) => task.text === 'Attached task')).not.toHaveProperty('data');
    } finally {
      cleanupRepo(fixture);
    }
  });
});
