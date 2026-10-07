import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '@doru/core';
import { TreeMcpBackend } from '../src/backend';
import { cleanupAiFixture, makeAiFixture } from './helpers';

const ivan: PersonRecord = { id: '@I1@', names: [{ given: 'Ivan', surname: 'Ivanov' }], sex: 'M' };

describe('TreeMcpBackend', () => {
  it('queries, reports stats, and edits through ops with the agent actor', () => {
    const fixture = makeAiFixture();
    try {
      const audited: string[] = [];
      const queue = fixture.queue;
      const backend = new TreeMcpBackend(fixture.repo, queue, 'agent:test/model#abc');

      void audited;
      fixture.repo.insertPerson(ivan);

      void backend.invoke('tree.query', { query: 'ivan' }).then((result) => {
        expect(result).toEqual([ivan]);
      });

      void backend.invoke('tree.stats', {}).then((result) => {
        expect(result).toEqual({ persons: 1, families: 0 });
      });

      void backend
        .invoke('tree.edit', {
          op: {
            kind: 'person.add',
            person: { id: '@I2@', names: [], sex: 'U' },
          },
        })
        .then(() => {
          expect(fixture.repo.countPersons()).toBe(2);
          expect(queue.canUndo()).toBe(true);
        });
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

      const result = (await backend.invoke('charts.render', { personId: '@I1@', kind: 'pedigree' })) as {
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
      await expect(backend.invoke('tree.edit', { op: { kind: 'person.destroy' } })).rejects.toThrow(
        'Unsupported op kind',
      );
    } finally {
      cleanupAiFixture(fixture);
    }
  });
});
