import { describe, expect, it } from 'vitest';
import { TreeMcpBackend } from '../src/backend';
import { cleanupAiFixture, makeAiFixture } from './helpers';

describe('TreeMcpBackend coverage', () => {
  it('fetches a person with their families and reports unknown ids', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson({ id: '@I1@', names: [], sex: 'U', facts: [] });
      fixture.repo.insertPerson({ id: '@I2@', names: [], sex: 'U', facts: [] });
      fixture.repo.insertFamily({ id: '@F1@', partners: ['@I1@', '@I2@'], children: [] });
      const backend = new TreeMcpBackend(fixture.service);

      const found = (await backend.invoke('tree_get', { personId: '@I1@' })) as {
        found: boolean;
        families: unknown[];
      };
      expect(found.found).toBe(true);
      expect(found.families).toHaveLength(1);

      expect(await backend.invoke('tree_get', { personId: 'nope' })).toEqual({ found: false });
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('rejects adding a duplicate person id and unsupported op shapes', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson({ id: '@I1@', names: [], sex: 'U', facts: [] });
      const backend = new TreeMcpBackend(fixture.service);

      await expect(
        backend.invoke('tree_edit', { op: { kind: 'person.add', person: { id: '@I1@', names: [], sex: 'U' } } }),
      ).rejects.toThrow('already exists');
      await expect(backend.invoke('tree_edit', {})).rejects.toThrow('requires an "op" object');
      await expect(backend.invoke('tree_edit', { op: { kind: 'person.add', person: { names: [] } } })).rejects.toThrow(
        'an "id" is required',
      );
      await expect(backend.invoke('tree_edit', { op: { kind: 'person.add', person: null } })).rejects.toThrow(
        'an "id" is required',
      );
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('updates a person through tree_edit with normalization', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson({ id: '@I1@', names: [], sex: 'U', facts: [] });
      const backend = new TreeMcpBackend(fixture.service);

      await backend.invoke('tree_edit', {
        op: {
          kind: 'person.update',
          before: { id: '@I1@', names: [], sex: 'U', facts: [] },
          after: { id: '@I1@', names: [{ given: 'Ivan' }], sex: 'M', facts: 'not an array' },
        },
      });
      const person = fixture.repo.getPerson('@I1@');
      expect(person?.sex).toBe('M');
      expect(person?.names[0]).toMatchObject({ given: 'Ivan', id: expect.any(String) });
      expect(person?.facts).toEqual([]);
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('adds relatives as child, spouse and parent', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson({ id: '@A@', names: [], sex: 'U', facts: [] });
      const backend = new TreeMcpBackend(fixture.service);

      await backend.invoke('tree_add_relative', {
        relation: 'child',
        anchorId: '@A@',
        person: { id: '@K@', names: [], sex: 'U' },
      });
      expect(fixture.repo.getFamily(fixture.repo.listFamilies()[0]!.id)?.children).toEqual(['@K@']);

      await backend.invoke('tree_add_relative', {
        relation: 'spouse',
        anchorId: '@A@',
        person: { id: '@S@', names: [], sex: 'U' },
      });
      const family = fixture.repo.getFamily(fixture.repo.listFamilies()[0]!.id)!;
      expect(family.partners).toEqual(['@A@', '@S@']);

      await backend.invoke('tree_add_relative', {
        relation: 'parent',
        anchorId: '@K@',
        person: { id: '@F@', names: [], sex: 'U' },
      });
      const parentFamily = fixture.repo
        .listFamilies()
        .find((entry) => entry.partners.includes('@F@'));
      expect(parentFamily?.children).toEqual(['@K@']);

      expect(
        await backend.invoke('tree_add_relative', {
          relation: 'child',
          anchorId: 'missing',
          person: { id: '@X@', names: [], sex: 'U' },
        }),
      ).toEqual({ ok: false, error: 'Unknown anchor person: missing' });

      await expect(
        backend.invoke('tree_add_relative', {
          relation: 'child',
          anchorId: '@A@',
          person: { id: '@K@', names: [], sex: 'U' },
        }),
      ).rejects.toThrow('already exists');
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('adds sources and notes with validation', async () => {
    const fixture = makeAiFixture();
    try {
      const backend = new TreeMcpBackend(fixture.service);

      await expect(backend.invoke('sources_add', {})).rejects.toThrow('requires a "title"');
      await expect(backend.invoke('notes_write', {})).rejects.toThrow('requires "text"');

      const source = (await backend.invoke('sources_add', {
        title: 'The Book',
        author: 'A.',
        targetType: 'person',
        targetId: '@P@',
      })) as { ok: boolean; id: string };
      expect(source.ok).toBe(true);
      expect(fixture.repo.listSources()[0]).toMatchObject({ title: 'The Book', author: 'A.' });

      const note = (await backend.invoke('notes_write', {
        text: 'a note',
        targetType: 'person',
        targetId: '@P@',
      })) as { ok: boolean; id: string };
      expect(note.ok).toBe(true);
      expect(fixture.repo.listNotesFor('person', '@P@')[0]?.text).toBe('a note');
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('filters tree_query by sex and normalizes wildcard queries', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson({ id: '@M@', names: [{ id: 'N1', given: 'Ivan' }], sex: 'M', facts: [] });
      fixture.repo.insertPerson({ id: '@F@', names: [{ id: 'N2', given: 'Maria' }], sex: 'F', facts: [] });
      const backend = new TreeMcpBackend(fixture.service);

      const males = (await backend.invoke('tree_query', { query: 'iv', sex: 'M' })) as Array<{ id: string }>;
      expect(males.map((entry) => entry.id)).toEqual(['@M@']);

      const all = (await backend.invoke('tree_query', { query: 'iv' })) as Array<{ id: string }>;
      expect(all.map((entry) => entry.id)).toEqual(['@M@']);

      const none = (await backend.invoke('tree_query', { query: 'iv*', limit: 10 })) as Array<{ id: string }>;
      expect(none.map((entry) => entry.id)).toEqual(['@M@']);
    } finally {
      cleanupAiFixture(fixture);
    }
  });
});
