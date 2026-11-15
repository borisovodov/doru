import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launchApp } from './launch';

test('a project picked in the dialog is not reopened when it fails to load', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'doru-e2e-open-'));
  const projectPath = join(dir, 'old.doru');
  // A file from an older build: the store refuses it before reading the
  // schema, so opening it fails the same way a real stale project does.
  const db = new DatabaseSync(projectPath);
  db.exec('PRAGMA user_version = 1');
  db.close();

  try {
    const { app, page } = await launchApp();
    await app.evaluate(({ dialog }, filePath) => {
      const calls: string[] = [];
      (globalThis as Record<string, unknown>)['__openProjectCalls'] = calls;
      dialog.showOpenDialog = async () => {
        calls.push('open');
        return { canceled: false, filePaths: [filePath] };
      };
      dialog.showMessageBox = async (...args: unknown[]) => {
        calls.push(`message:${JSON.stringify(args)}`);
        return { response: 0, checkboxChecked: false };
      };
    }, projectPath);

    const result = await page.evaluate(() => window.doru.openProjectDialog());
    expect(result).toBeNull();

    const calls = await app.evaluate<string[]>(
      () => (globalThis as { __openProjectCalls?: string[] }).__openProjectCalls ?? [],
    );
    expect(calls.filter((call) => call === 'open')).toHaveLength(1);
    expect(calls.some((call) => call.startsWith('message:'))).toBe(true);
    await app.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
