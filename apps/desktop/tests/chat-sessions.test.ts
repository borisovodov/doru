import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatSessionsStore } from '../src/main/chat-sessions';

function makeStore(): { store: ChatSessionsStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'doru-chat-sessions-'));
  return { store: new ChatSessionsStore(join(dir, 'sessions')), dir };
}

describe('ChatSessionsStore', () => {
  it('creates, lists and titles sessions from the first exchange', () => {
    const { store, dir } = makeStore();
    try {
      expect(store.list('p1')).toEqual([]);

      const created = store.create('p1');
      expect(created.title).toBe('');
      expect(store.list('p1')).toHaveLength(1);

      store.appendExchange('p1', created.id, {
        user: 'Find everyone born in Pskov before 1850',
        assistant: { role: 'assistant', content: 'Done.', steps: [{ type: 'toolCall', name: 'tree_query', arguments: {} }] },
      });
      const sessions = store.list('p1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.title).toBe('Find everyone born in Pskov before 1850');
      expect(sessions[0]?.updatedAt).toBeGreaterThanOrEqual(sessions[0]!.createdAt);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the first user message as the title across turns', () => {
    const { store, dir } = makeStore();
    try {
      const created = store.create('p1');
      store.appendExchange('p1', created.id, { user: 'First question', assistant: { role: 'assistant', content: 'A' } });
      store.appendExchange('p1', created.id, { user: 'Second question', assistant: { role: 'assistant', content: 'B' } });
      expect(store.list('p1')[0]?.title).toBe('First question');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reconstructs the transcript from the JSONL file', () => {
    const { store, dir } = makeStore();
    try {
      const created = store.create('p1');
      store.appendExchange('p1', created.id, {
        user: 'hello',
        assistant: { role: 'assistant', content: 'hi', steps: [{ type: 'toolResult', name: 'tree_stats', result: { persons: 2 } }] },
      });
      store.appendExchange('p1', created.id, {
        user: 'again',
        assistant: { role: 'assistant', content: '', error: 'boom' },
      });
      expect(store.transcript('p1', created.id)).toEqual([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi', steps: [{ type: 'toolResult', name: 'tree_stats', result: { persons: 2 } }] },
        { role: 'user', content: 'again' },
        { role: 'assistant', content: '', error: 'boom' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('removes sessions and separates projects', () => {
    const { store, dir } = makeStore();
    try {
      const a = store.create('/trees/a.doru');
      const b = store.create('/trees/b.doru');
      store.appendExchange('/trees/a.doru', a.id, { user: 'q', assistant: { role: 'assistant', content: 'x' } });
      expect(store.list('/trees/b.doru')).toHaveLength(1);
      expect(store.list('/trees/b.doru')[0]?.title).toBe('');

      store.remove('/trees/a.doru', a.id);
      expect(store.list('/trees/a.doru')).toEqual([]);
      expect(store.transcript('/trees/a.doru', a.id)).toEqual([]);
      expect(store.list('/trees/b.doru')).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores corrupted JSONL lines without losing the rest', () => {
    const { store, dir } = makeStore();
    try {
      const created = store.create('p1');
      store.appendExchange('p1', created.id, { user: 'hello', assistant: { role: 'assistant', content: 'hi' } });
      const file = join(dir, 'sessions');
      // Find the session jsonl and corrupt one line.
      const sessionDir = join(file, readdirSync(file)[0] ?? '');
      const jsonl = join(sessionDir, `${created.id}.jsonl`);
      const lines = readFileSync(jsonl, 'utf8').split('\n');
      lines[0] = '{{{{ not json';
      writeFileSync(jsonl, lines.join('\n'));
      const transcript = store.transcript('p1', created.id);
      expect(transcript).toEqual([{ role: 'assistant', content: 'hi' }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
