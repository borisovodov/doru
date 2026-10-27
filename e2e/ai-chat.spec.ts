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
    await expect(page.locator('.agent-chat-panel')).toBeVisible();
    await page.locator('.chat-input textarea').fill('Find Ivan');
    await page.getByRole('button', { name: 'Send' }).click();

    // The mock calls tree_query, then tree_edit — tools run without a
    // permission prompt, so the final reply streams straight in.
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
    await expect(page.locator('.chat-input textarea')).toBeEnabled();

    // The copy button puts the reply's markdown on the system clipboard.
    await page.getByRole('button', { name: 'Copy reply' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(copied).toBe('Done.');

    // The exchange persisted into a session with an auto-generated title.
    const sessionSelect = page.locator('.chat-session-select');
    await expect(sessionSelect).toHaveCount(1);
    await expect(sessionSelect.locator('option')).toHaveText(['Find Ivan']);

    // A new chat starts empty; switching back restores the transcript.
    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(page.locator('.chat-message')).toHaveCount(0);
    await expect(sessionSelect.locator('option')).toHaveCount(2);
    await sessionSelect.selectOption({ label: 'Find Ivan' });
    await expect(page.locator('.chat-message.user .chat-bubble')).toHaveText('Find Ivan');
    await expect(page.locator('.chat-message.assistant .chat-text')).toHaveText('Done.');

    // The second chat can be deleted; the first one survives.
    await sessionSelect.selectOption({ label: 'Untitled chat' });
    await page.getByRole('button', { name: 'Delete chat' }).click();
    await expect(sessionSelect.locator('option')).toHaveCount(1);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});

test('chat sessions persist across app restarts', async () => {
  const mock = startMockProvider();
  await new Promise<void>((resolve) => mock.server.listen(0, '127.0.0.1', resolve));

  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-persist-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-persist-data-'));

  const configureAndChat = async (page: import('@playwright/test').Page) => {
    await page.evaluate(
      async ({ baseUrl }) => {
        await window.doru.setAiSettings({ provider: 'ollama', baseUrl, model: 'mock-model' });
      },
      { baseUrl: mock.url() },
    );
    await expect(page.locator('.agent-chat-panel')).toBeVisible();
    await page.locator('.chat-input textarea').fill('Hello tree');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.chat-message.assistant .chat-text')).toHaveText('Done.', {
      timeout: 15_000,
    });
  };

  const first = await launchApp(project, userData);
  try {
    await configureAndChat(first.page);
  } finally {
    await first.app.close();
  }

  // Relaunch with the same userData (no re-seeding): the session and its
  // transcript come back from the JSONL store.
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
      await window.doru.openProjectPath(path);
    },
    { path: project },
  );
  try {
    const sessionSelect = page.locator('.chat-session-select');
    await expect(sessionSelect.locator('option')).toHaveText(['Hello tree']);
    await expect(page.locator('.chat-message.user .chat-bubble')).toHaveText('Hello tree');
    await expect(page.locator('.chat-message.assistant .chat-text')).toHaveText('Done.');
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});

test('the Stop button cancels the run and returns the message to the input', async () => {
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

    await expect(page.locator('.agent-chat-panel')).toBeVisible();
    await page.locator('.chat-input textarea').fill('Hello');
    // Shift+Enter inserts a newline instead of sending; Enter sends.
    await page.locator('.chat-input textarea').press('Shift+Enter');
    await expect(page.locator('.chat-input textarea')).toHaveValue('Hello\n');
    await page.locator('.chat-input textarea').press('Enter');

    // The first chunk arrives, then the provider stalls.
    await expect(page.locator('.chat-message.assistant .chat-text')).toHaveText('Slow ', {
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Stop' }).click();

    // Stop reclaims the send: the message leaves the transcript, its text
    // returns to the input for editing, and no error card appears.
    await expect(page.locator('.chat-input textarea')).toHaveValue('Hello', { timeout: 15_000 });
    await expect(page.locator('.chat-message.user')).toHaveCount(0);
    await expect(page.locator('.chat-message.assistant')).toHaveCount(0);
    await expect(page.locator('.chat-error')).toHaveCount(0);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});
