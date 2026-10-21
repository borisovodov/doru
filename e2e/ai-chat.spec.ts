import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFamilyTree } from './seed';
import { startMockProvider } from './mock-provider';

const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');

async function launchApp(project: string, userData: string) {
  const args = ['.'];
  if (process.env['CI'] === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await expect(page.locator('.welcome-page')).toBeVisible();
  await page.evaluate(
    async ({ path }) => {
      const summary = await window.doru.openProjectPath(path);
      if (!summary) throw new Error('project open failed');
    },
    { path: project },
  );
  await seedFamilyTree(page, project);
  return { app, page };
}

test('AI chat works end-to-end against a real HTTP provider', async () => {
  const mock = startMockProvider();
  await new Promise<void>((resolve) => mock.server.listen(0, '127.0.0.1', resolve));

  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-ai-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-ai-data-'));
  const { app, page } = await launchApp(project, userData);

  try {
    // Configure the mock provider (the ollama preset needs no API key, so the
    // flow is independent of the OS keychain) and verify the connection test
    // and the dynamic model list.
    const configured = await page.evaluate(
      async ({ baseUrl }) => {
        const state = await window.doru.setAiSettings({
          provider: 'ollama',
          baseUrl,
          model: 'mock-model',
        });
        return { configured: state.configured };
      },
      { baseUrl: mock.url() },
    );
    expect(configured.configured).toBe(true);

    const testResult = await page.evaluate(() => window.doru.testAiConnection());
    expect(testResult).toEqual({ ok: true });

    const fetched = await page.evaluate(() => window.doru.fetchAiModels());
    expect(fetched.models).toEqual(['mock-model']);

    // Open the chat panel and send a message.
    await expect(page.locator('.secondary-side-bar')).toBeVisible();
    await page.locator('.chat-input input').fill('Find Ivan');
    await page.getByRole('button', { name: 'Send' }).click();

    // The mock calls tree_query (auto-allowed), then tree_edit — the
    // permission card appears; allow it.
    const allowButton = page.getByRole('button', { name: 'Allow' });
    await expect(allowButton).toBeVisible({ timeout: 15_000 });
    await allowButton.click();

    // The final reply streams into the assistant bubble.
    await expect(page.locator('.chat-message.assistant .chat-text')).toHaveText('Done.', {
      timeout: 15_000,
    });

    // Tool activity is visible as steps, and the tree edit was applied.
    await expect(page.locator('.chat-message.assistant .chat-tool')).toHaveCount(2);
    await expect(page.locator('.chat-message.assistant .chat-tool-result')).toHaveCount(2);
    const persons = await page.evaluate(({ projectPath }) => window.doru.listPersons(projectPath), {
      projectPath: project,
    });
    expect(persons.some((person) => person.id === 'E2EM1')).toBe(true);

    // The chat is idle again.
    await expect(page.locator('.chat-input input')).toBeEnabled();
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});

test('the Stop button cancels a streaming reply and keeps the partial text', async () => {
  const mock = startMockProvider();
  mock.setSlow(true);
  await new Promise<void>((resolve) => mock.server.listen(0, '127.0.0.1', resolve));

  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-stop-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-stop-data-'));
  const { app, page } = await launchApp(project, userData);

  try {
    await page.evaluate(
      async ({ baseUrl }) => {
        await window.doru.setAiSettings({
          provider: 'ollama',
          baseUrl,
          model: 'mock-model',
        });
      },
      { baseUrl: mock.url() },
    );

    await expect(page.locator('.secondary-side-bar')).toBeVisible();
    await page.locator('.chat-input input').fill('Hello');
    await page.getByRole('button', { name: 'Send' }).click();

    // The first chunk arrives, then the provider stalls.
    await expect(page.locator('.chat-message.assistant .chat-text')).toHaveText('Slow ', {
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Stop' }).click();

    // The run ends, the partial text stays, and no error card appears.
    await expect(page.locator('.chat-input input')).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator('.chat-message.assistant .chat-text')).toHaveText('Slow ');
    await expect(page.locator('.chat-error')).toHaveCount(0);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});
