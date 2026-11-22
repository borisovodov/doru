import { describe, expect, it } from 'vitest';
import type { AssociationRecord, TitleRecord, TaskRecord } from '../src/model/types';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  // Several research records carry foreign keys to persons.
  for (const id of ['P1', 'P2']) {
    fixture.repo.insertPerson({ id, names: [], sex: 'U', facts: [] });
  }
  return { fixture, service };
}

const association = (overrides: Partial<AssociationRecord> = {}): AssociationRecord => ({
  id: 'A1',
  personId: 'P1',
  otherPersonId: 'P2',
  role: 'witness',
  ...overrides,
});

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'T1',
  text: 'Order the birth record',
  priority: 'medium',
  status: 'open',
  createdAt: 1_700_000_000_000,
  ...overrides,
});

const title = (overrides: Partial<TitleRecord> = {}): TitleRecord => ({
  id: 'TL1',
  name: 'The Parish Registers',
  ...overrides,
});

describe('TreeService research layer', () => {
  it('adds, updates, deletes and restores an association', () => {
    const { fixture, service } = makeService();
    try {
      service.addAssociation(association());
      expect(fixture.repo.listAssociations()).toEqual([association()]);
      expect(fixture.repo.listAssociationsFor('P1')).toEqual([association()]);
      expect(fixture.repo.listAssociationsFor('P9')).toEqual([]);

      const after = association({ role: 'godparent', phrase: 'sponsored' });
      service.updateAssociation(association(), after);
      expect(fixture.repo.listAssociations()).toEqual([after]);

      service.deleteAssociation(after);
      expect(fixture.repo.listAssociations()).toEqual([]);

      service.undo();
      expect(fixture.repo.listAssociations()).toEqual([after]);
      service.undo();
      expect(fixture.repo.listAssociations()).toEqual([association()]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('links and unlinks an alias', () => {
    const { fixture, service } = makeService();
    try {
      service.addAlias('P1', 'P2');
      expect(fixture.repo.listAliasesFor('P1')).toEqual([{ id: expect.any(String), aliasId: 'P2' }]);

      const [alias] = fixture.repo.listAliasesFor('P1');
      service.deleteAlias(alias!.id, 'P1', 'P2');
      expect(fixture.repo.listAliasesFor('P1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listAliasesFor('P1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('stores explicit open and medium defaults when a new task has neither', () => {
    const { fixture, service } = makeService();
    try {
      service.addTask({ id: 'T1', text: 'Task' });
      expect(fixture.repo.getTask('T1')).toMatchObject({ status: 'open', priority: 'medium' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('normalizes status and priority on task update', () => {
    const { fixture, service } = makeService();
    try {
      service.addTask(task());
      service.updateTask(task(), task({ status: 'Completed', priority: 'HIGH' }));
      expect(fixture.repo.getTask('T1')).toMatchObject({ status: 'closed', priority: 'high' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps the generated createdAt when a stale draft updates a task', () => {
    const { fixture, service } = makeService();
    try {
      service.addTask({ id: 'T1', text: 'Task' });
      const stored = fixture.repo.getTask('T1')!;
      expect(stored.createdAt).toBeTypeOf('number');

      service.updateTask({ id: 'T1', text: 'Stale' }, { ...stored, text: 'Edited' });
      expect(fixture.repo.getTask('T1')).toMatchObject({ text: 'Edited', createdAt: stored.createdAt });

      service.undo();
      expect(fixture.repo.getTask('T1')).toMatchObject({ text: 'Task', createdAt: stored.createdAt });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a task with its attachments', () => {
    const { fixture, service } = makeService();
    try {
      service.addTask(task());
      expect(fixture.repo.listTasks()).toEqual([task()]);
      expect(service.listTasks()).toEqual([task()]);
      expect(fixture.repo.listTasksFor('person', 'P1')).toEqual([]);
      service.addTask(task({ id: 'T2', targetType: 'person', targetId: 'P1' }));
      expect(fixture.repo.listTasksFor('person', 'P1')).toEqual([
        task({ id: 'T2', targetType: 'person', targetId: 'P1' }),
      ]);

      const after = task({ status: 'closed', closedAt: 1_700_000_100_000 });
      service.updateTask(task(), after);
      expect(fixture.repo.listTasks().find((entry) => entry.id === 'T1')).toMatchObject(after);

      service.updateTask(after, task({ status: 'open' }));
      expect(fixture.repo.getTask('T1')?.closedAt).toBeUndefined();
      service.undo();
      expect(fixture.repo.getTask('T1')?.closedAt).toBe(after.closedAt);

      service.deleteTask(after);
      expect(fixture.repo.listTasks().find((entry) => entry.id === 'T1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.listTasks().find((entry) => entry.id === 'T1')).toMatchObject(after);

      // Repo-level cascade helper.
      fixture.repo.deleteAttachmentsFor('person', 'P1');
      expect(fixture.repo.listTasksFor('person', 'P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds, updates, deletes and restores a title', () => {
    const { fixture, service } = makeService();
    try {
      service.addTitle(title());
      expect(fixture.repo.listTitles()).toEqual([title()]);

      const after = title({ author: 'Ivan Petrov' });
      service.updateTitle(title(), after);
      expect(fixture.repo.listTitles()).toEqual([after]);

      service.deleteTitle(after);
      expect(fixture.repo.listTitles()).toEqual([]);
      service.undo();
      expect(fixture.repo.listTitles()).toEqual([after]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reports the history state and re-applies the last op on redo', () => {
    const { fixture, service } = makeService();
    try {
      expect(service.undo()).toEqual({ canUndo: false, canRedo: false });

      service.addTask(task());
      const after = service.addTask(task({ id: 'T2' }));
      expect(after).toEqual({ canUndo: true, canRedo: false });

      expect(service.undo()).toEqual({ canUndo: true, canRedo: true });
      expect(fixture.repo.listTasks().map((entry) => entry.id)).toEqual(['T1']);

      expect(service.redo()).toEqual({ canUndo: true, canRedo: false });
      expect(fixture.repo.listTasks().map((entry) => entry.id)).toEqual(['T1', 'T2']);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
