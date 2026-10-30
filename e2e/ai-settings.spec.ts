import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockProvider } from './mock-provider';

const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');

test('the AI settings section configures and tests a provider', async () => {
  const mock = startMockProvider();
  await new Promise<void>((resolve) => mock.server.listen(0, '127.0.0.1', resolve));

  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-ai-settings-'));
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

  try {
    await page.locator('.activity-bar .activity-bar-bottom').click();
    await expect(page.getByLabel('Provider')).toBeVisible();

    // Cloud presets are unlisted for now; Dóru AI leads the local set and is
    // the default provider on a fresh install.
    await expect(page.getByLabel('Provider').locator('option')).toHaveText([
      'Dóru AI',
      'Ollama',
      'LM Studio',
      'Custom (OpenAI-compatible)',
      'ACP agent',
    ]);

    // A catalog-less provider walks a wizard: no model field and no test
    // button until the model list is fetched. The ollama preset needs no API
    // key, so the flow is independent of the OS keychain. Selecting the
    // provider auto-fetches against its default endpoint; whether that
    // succeeds (a real Ollama running) or fails, the next steps converge.
    await page.getByLabel('Provider').selectOption('ollama');
    await expect(page.getByRole('button', { name: 'Fetch models from the provider' })).toBeVisible();
    await expect(page.getByText('API key')).toHaveCount(0);

    // Point at the mock endpoint and fetch the list: the model dropdown
    // appears with the mock model already selected.
    await page.getByLabel('Base URL').fill(mock.url());
    await page.getByLabel('Base URL').blur();
    await page.getByRole('button', { name: 'Fetch models from the provider' }).click();
    await expect(page.getByLabel('Model')).toHaveValue('mock-model');

    // With a model chosen, catalog-less providers offer the pass-through
    // reasoning control: provider default plus the OpenAI-shaped levels.
    const reasoning = page.getByLabel('Reasoning');
    await expect(reasoning).toBeVisible();
    await expect(reasoning.locator('option')).toHaveText([
      'Default',
      'None',
      'Minimal',
      'Low',
      'Medium',
      'High',
    ]);
    await reasoning.selectOption('high');

    // The connection test runs against the configured endpoint.
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('Connected')).toBeVisible();

    // Everything was persisted through the settings IPC.
    const state = await page.evaluate(() => window.doru.getAiSettings());
    expect(state.provider).toBe('ollama');
    expect(state.model).toBe('mock-model');
    expect(state.reasoning).toBe('high');
    expect(state.configured).toBe(true);

    // Per-provider profiles: switching away and back restores the values.
    await page.getByLabel('Provider').selectOption('custom');
    await expect(page.getByLabel('Base URL')).toHaveValue('');
    await page.getByLabel('Provider').selectOption('ollama');
    await expect(page.getByLabel('Base URL')).toHaveValue(mock.url());
    await expect(page.getByLabel('Model')).toHaveValue('mock-model');
    await expect(page.getByLabel('Reasoning')).toHaveValue('high');
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});

test('the API key field saves and clears the key', async () => {
  // The key lives in secrets.json (mode 0600) in the app data directory —
  // no OS keychain involved, so this runs on every platform.
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-ai-key-'));
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

  try {
    await page.locator('.activity-bar .activity-bar-bottom').click();
    await expect(page.getByLabel('Provider')).toBeVisible();

    await page.getByLabel('Provider').selectOption('custom');
    const keyInput = page.getByPlaceholder('Paste an API key');
    await keyInput.fill('test-key');
    await page.getByRole('button', { name: 'Save key' }).click();
    await expect(page.getByPlaceholder('Saved on this computer')).toBeVisible();

    const saved = await page.evaluate(() => window.doru.getAiSettings());
    expect(saved.hasKey).toBe(true);

    await page.getByRole('button', { name: 'Clear key' }).click();
    const cleared = await page.evaluate(() => window.doru.getAiSettings());
    expect(cleared.hasKey).toBe(false);
  } finally {
    await app.close();
  }
});
