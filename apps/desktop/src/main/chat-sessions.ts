import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { ChatSessionMeta, ChatTranscriptMessage } from '@doru/ai';
import { log } from './log';

/**
 * The chat-session store: Dóru owns every conversation as JSONL files in
 * `<userData>/sessions/<projectKeyHash>/`, independent of the AI provider.
 * The transcript is the single source of truth — providers are transports,
 * and every turn's context is replayed from here.
 *
 * Sessions are stored outside the `.doru` document on purpose: chat is not
 * family data and must not travel with the tree file.
 */

const INDEX_FILE = 'index.json';
const TITLE_MAX = 60;

interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface SessionIndex {
  sessions: SessionRecord[];
}

type TranscriptLine =
  | { type: 'user'; content: string }
  | { type: 'assistant'; content: string; steps?: ChatTranscriptMessage['steps']; error?: string };

function projectKeyHash(projectKey: string): string {
  return createHash('sha256').update(projectKey).digest('hex').slice(0, 16);
}

function autoTitle(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > TITLE_MAX ? `${flat.slice(0, TITLE_MAX)}…` : flat;
}

export class ChatSessionsStore {
  constructor(private readonly baseDir: string) {}

  private projectDir(projectKey: string): string {
    return join(this.baseDir, projectKeyHash(projectKey));
  }

  private indexPath(projectKey: string): string {
    return join(this.projectDir(projectKey), INDEX_FILE);
  }

  private sessionFile(projectKey: string, id: string): string {
    return join(this.projectDir(projectKey), `${id}.jsonl`);
  }

  private readIndex(projectKey: string): SessionIndex {
    const file = this.indexPath(projectKey);
    if (!existsSync(file)) {
      return { sessions: [] };
    }
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as SessionIndex;
    } catch {
      log.warn(`chat sessions index for ${projectKey} is not valid JSON — ignored`);
      return { sessions: [] };
    }
  }

  private writeIndex(projectKey: string, index: SessionIndex): void {
    mkdirSync(this.projectDir(projectKey), { recursive: true });
    writeFileSync(this.indexPath(projectKey), `${JSON.stringify(index, null, 2)}\n`);
  }

  list(projectKey: string): ChatSessionMeta[] {
    return this.readIndex(projectKey).sessions
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }));
  }

  create(projectKey: string): ChatSessionMeta {
    const now = Date.now();
    const record: SessionRecord = { id: randomUUID(), title: '', createdAt: now, updatedAt: now };
    const index = this.readIndex(projectKey);
    index.sessions.push(record);
    this.writeIndex(projectKey, index);
    return { id: record.id, title: '', createdAt: now, updatedAt: now };
  }

  remove(projectKey: string, id: string): void {
    rmSync(this.sessionFile(projectKey, id), { force: true });
    const index = this.readIndex(projectKey);
    index.sessions = index.sessions.filter((entry) => entry.id !== id);
    if (index.sessions.length === 0) {
      rmSync(this.indexPath(projectKey), { force: true });
    } else {
      this.writeIndex(projectKey, index);
    }
  }

  transcript(projectKey: string, id: string): ChatTranscriptMessage[] {
    const file = this.sessionFile(projectKey, id);
    if (!existsSync(file)) {
      return [];
    }
    const messages: ChatTranscriptMessage[] = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.trim() === '') {
        continue;
      }
      try {
        const record = JSON.parse(line) as TranscriptLine;
        if (record.type === 'user') {
          messages.push({ role: 'user', content: record.content });
        } else {
          messages.push({
            role: 'assistant',
            content: record.content,
            ...(record.steps !== undefined ? { steps: record.steps } : {}),
            ...(record.error !== undefined ? { error: record.error } : {}),
          });
        }
      } catch {
        log.warn(`chat session line ignored (not valid JSON): ${file}`);
      }
    }
    return messages;
  }

  /**
   * Appends a finished turn (the user message and the assistant reply) and
   * refreshes the session metadata. The first user message becomes the
   * session title.
   */
  appendExchange(
    projectKey: string,
    id: string,
    exchange: { user: string; assistant: ChatTranscriptMessage },
  ): void {
    const file = this.sessionFile(projectKey, id);
    mkdirSync(this.projectDir(projectKey), { recursive: true });
    const user: TranscriptLine = { type: 'user', content: exchange.user };
    const assistant: TranscriptLine = {
      type: 'assistant',
      content: exchange.assistant.content,
      ...(exchange.assistant.steps !== undefined ? { steps: exchange.assistant.steps } : {}),
      ...(exchange.assistant.error !== undefined ? { error: exchange.assistant.error } : {}),
    };
    appendFileSync(file, `${JSON.stringify(user)}\n${JSON.stringify(assistant)}\n`);

    const index = this.readIndex(projectKey);
    const record = index.sessions.find((entry) => entry.id === id);
    if (record) {
      record.updatedAt = Date.now();
      if (record.title === '') {
        record.title = autoTitle(exchange.user);
      }
      this.writeIndex(projectKey, index);
    }
  }
}

let store: ChatSessionsStore | null = null;

/** The app-wide store rooted at `<userData>/sessions`; created on first use. */
export function chatSessions(): ChatSessionsStore {
  store ??= new ChatSessionsStore(join(app.getPath('userData'), 'sessions'));
  return store;
}
