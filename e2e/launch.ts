import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** The desktop app directory, shared by every e2e spec. */
export const appDir = resolve(root, '../apps/desktop');

export interface LaunchOptions {
  /** A project file passed on the command line (opened at startup). */
  project?: string | undefined;
  /** Reuse an existing profile; a fresh temp directory is created otherwise. */
  userData?: string | undefined;
  /** Extra environment variables for the main process. */
  env?: Record<string, string> | undefined;
}

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userData: string;
}

/**
 * Launches the Electron app with an isolated profile and a deterministic
 * English locale, then waits for the workbench shell. Keeping the locale
 * fixed makes accessible names stable for role-based locators.
 */
export async function launchApp(options: LaunchOptions = {}): Promise<LaunchedApp> {
  const userData = options.userData ?? mkdtempSync(join(tmpdir(), 'doru-e2e-'));
  const args = ['--lang=en-US', '.'];
  if (options.project !== undefined) {
    args.push(options.project);
  }
  if (process.env['CI'] === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData, ...options.env },
  });
  const page = await app.firstWindow();
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
  return { app, page, userData };
}

/** Opens a tree file through the same IPC path the welcome screen uses. */
export async function openProject(page: Page, project: string): Promise<void> {
  await page.evaluate(async (path) => {
    const summary = await window.doru.openProjectPath(path);
    if (!summary) {
      throw new Error('project open failed');
    }
  }, project);
}
