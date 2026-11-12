import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedFamilyTree } from './seed';
import { startMockProvider } from './mock-provider';
import { launchApp, openProject } from './launch';

async function launchWithFamily(project: string, userData: string) {
  const launched = await launchApp({ userData });
  await openProject(launched.page, project);
  await seedFamilyTree(launched.page, project);
  return launched;
}

function chatLocators(page: Page) {
  const log = page.getByRole('log', { name: 'Agent Chat' });
  return {
    log,
    input: page.getByRole('textbox', { name: 'Message' }),
    userMessages: log.getByRole('article', { name: 'You' }),
    assistantMessages: log.getByRole('article', { name: 'Assistant' }),
    sessionSelect: page.getByRole('combobox', { name: 'Chat session' }),
  };
}

test('AI chat works end-to-end against a real HTTP provider', async () => {
  const mock = startMockProvider();
  await new Promise<void>((resolve) => mock.server.listen(0, '127.0.0.1', resolve));

  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-ai-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-ai-data-'));
  const { app, page } = await launchWithFamily(project, userData);

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

    const chat = chatLocators(page);

    // Open the chat panel and send a message.
    await expect(page.getByRole('complementary', { name: 'Agent Chat' })).toBeVisible();
    await chat.input.fill('Find Ivan');
    await page.getByRole('button', { name: 'Send' }).click();

    // The mock calls tree_query, then tree_edit — tools run without a
    // permission prompt, so the final reply streams straight in.
    const assistant = chat.assistantMessages.last();
    await expect(assistant.getByText('Done.')).toBeVisible({ timeout: 15_000 });

    // Tool activity is visible as steps, and the tree edit was applied.
    await expect(assistant.getByText('Tool: tree_query')).toBeVisible();
    await expect(assistant.getByText('Tool: tree_edit')).toBeVisible();
    const persons = await page.evaluate(({ projectPath }) => window.doru.listPersons(projectPath), {
      projectPath: project,
    });
    expect(persons.some((person) => person.id === 'E2EM1')).toBe(true);

    // The chat is idle again.
    await expect(chat.input).toBeEnabled();

    // The copy button puts the reply's markdown on the system clipboard.
    await page.getByRole('button', { name: 'Copy reply' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(copied).toBe('Done.');

    // The exchange persisted into a session with an auto-generated title.
    await expect(chat.sessionSelect).toHaveCount(1);
    await expect(chat.sessionSelect.locator('option')).toHaveText(['Find Ivan']);

    // A new chat starts empty; switching back restores the transcript.
    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(chat.log.getByRole('article')).toHaveCount(0);
    await expect(chat.sessionSelect.locator('option')).toHaveCount(2);
    await chat.sessionSelect.selectOption({ label: 'Find Ivan' });
    await expect(chat.userMessages.getByText('Find Ivan')).toBeVisible();
    await expect(chat.assistantMessages.getByText('Done.')).toBeVisible();

    // The second chat can be deleted; the first one survives.
    await chat.sessionSelect.selectOption({ label: 'Untitled chat' });
    await page.getByRole('button', { name: 'Delete chat' }).click();
    await expect(chat.sessionSelect.locator('option')).toHaveCount(1);
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

  const configureAndChat = async (page: Page) => {
    await page.evaluate(
      async ({ baseUrl }) => {
        await window.doru.setAiSettings({ provider: 'ollama', baseUrl, model: 'mock-model' });
      },
      { baseUrl: mock.url() },
    );
    const chat = chatLocators(page);
    await expect(page.getByRole('complementary', { name: 'Agent Chat' })).toBeVisible();
    await chat.input.fill('Hello tree');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(chat.assistantMessages.getByText('Done.')).toBeVisible({ timeout: 15_000 });
  };

  const first = await launchWithFamily(project, userData);
  try {
    await configureAndChat(first.page);
  } finally {
    await first.app.close();
  }

  // Relaunch with the same userData (no re-seeding): the session and its
  // transcript come back from the JSONL store.
  const second = await launchApp({ userData });
  try {
    await expect(second.page.getByRole('region', { name: 'Welcome' })).toBeVisible();
    await openProject(second.page, project);
    const chat = chatLocators(second.page);
    await expect(chat.sessionSelect.locator('option')).toHaveText(['Hello tree']);
    await expect(chat.userMessages.getByText('Hello tree')).toBeVisible();
    await expect(chat.assistantMessages.getByText('Done.')).toBeVisible();
  } finally {
    await second.app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});

test('the Stop button cancels the run and returns the message to the input', async () => {
  const mock = startMockProvider();
  mock.setSlow(true);
  await new Promise<void>((resolve) => mock.server.listen(0, '127.0.0.1', resolve));

  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-stop-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-stop-data-'));
  const { app, page } = await launchWithFamily(project, userData);

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

    const chat = chatLocators(page);
    await expect(page.getByRole('complementary', { name: 'Agent Chat' })).toBeVisible();
    await chat.input.fill('Hello');
    // Shift+Enter inserts a newline instead of sending; Enter sends.
    await chat.input.press('Shift+Enter');
    await expect(chat.input).toHaveValue('Hello\n');
    await chat.input.press('Enter');

    // The first chunk arrives, then the provider stalls.
    await expect(chat.assistantMessages.getByText('Slow')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Stop' }).click();

    // Stop reclaims the send: the message leaves the transcript, its text
    // returns to the input for editing, and no error card appears.
    await expect(chat.input).toHaveValue('Hello', { timeout: 15_000 });
    await expect(chat.userMessages).toHaveCount(0);
    await expect(chat.assistantMessages).toHaveCount(0);
    await expect(chat.log.getByRole('alert')).toHaveCount(0);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});
