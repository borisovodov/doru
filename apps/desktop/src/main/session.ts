import { app } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SESSION_FILE = 'session.json';

export interface SessionData {
  paths: string[];
  activePath: string | null;
}

export function readSession(): SessionData {
  const file = join(app.getPath('userData'), SESSION_FILE);
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as SessionData;
    if (!Array.isArray(parsed.paths) || (typeof parsed.activePath !== 'string' && parsed.activePath !== null)) {
      return { paths: [], activePath: null };
    }
    return parsed;
  } catch {
    return { paths: [], activePath: null };
  }
}

export function updateSession(update: (session: SessionData) => SessionData): void {
  const dir = app.getPath('userData');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, SESSION_FILE), `${JSON.stringify(update(readSession()), null, 2)}\n`);
}
