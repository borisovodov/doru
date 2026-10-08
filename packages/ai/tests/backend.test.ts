import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '@doru/core';
import { TreeMcpBackend } from '../src/backend';
import { cleanupAiFixture, makeAiFixture } from './helpers';

const ivan: PersonRecord = { id: '@I1@', names: [{ given: 'Ivan', surname: 'Ivanov' }], sex: 'M' };

describe('TreeMcpBackend', () => {
  it('queries, reports stats, and edits through ops with the agent actor', async () => {
    const fixture = makeAiFixture();
    try {
      const queue = fixture.queue;
      const backend = new TreeMcpBackend(fixture.repo, queue, 'agent:test/model#abc');

      fixture.repo.insertPerson(ivan);

      expect(await backend.invoke('tree_query', { query: 'ivan' })).toEqual([ivan]);
      expect(await backend.invoke('tree_stats', {})).toEqual({ persons: 1, families: 0 });

      await backend.invoke('tree_edit', {
        op: {
          kind: 'person.add',
          person: { id: '@I2@', names: [], sex: 'U' },
        },
      });
      expect(fixture.repo.countPersons()).toBe(2);
      expect(queue.canUndo()).toBe(true);
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('renders pedigree data', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson(ivan);
      fixture.repo.insertPerson({ id: '@P2@', names: [], sex: 'F' });
      fixture.repo.insertFamily({ id: '@F1@', parents: ['@P2@'], children: ['@I1@'] });
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue, 'agent:test');

      const result = (await backend.invoke('charts_render', { personId: '@I1@', kind: 'pedigree' })) as {
        root: { parents: Array<{ id: string }> };
      };
      expect(result.root.parents.map((parent) => parent.id)).toEqual(['@P2@']);
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('rejects unknown tools and invalid edits', async () => {
    const fixture = makeAiFixture();
    try {
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue, 'agent:test');
      await expect(backend.invoke('nope', {})).rejects.toThrow('Unknown tool');
      await expect(backend.invoke('tree_edit', { op: { kind: 'person.destroy' } })).rejects.toThrow(
        'Unsupported op kind',
      );
    } finally {
      cleanupAiFixture(fixture);
    }
  });
});
