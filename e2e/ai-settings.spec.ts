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

    // Cloud presets are unlisted for now, so only the local and ACP
    // providers show up in the dropdown.
    await expect(page.getByLabel('Provider').locator('option')).toHaveText([
      'Ollama (local)',
      'LM Studio (local)',
      'Custom (OpenAI-compatible)',
      'ACP agent',
    ]);

    // A catalog-less provider shows the model field as a text input and
    // offers the fetch button. The ollama preset needs no API key, so the
    // flow is independent of the OS keychain.
    await page.getByLabel('Provider').selectOption('ollama');
    await expect(page.getByRole('button', { name: 'Fetch models from the provider' })).toBeVisible();
    await expect(page.getByLabel('Reasoning')).toHaveCount(0);
    await expect(page.getByText('API key')).toHaveCount(0);

    const modelInput = page.getByLabel('Model');
    await modelInput.fill('mock-model');
    await page.getByLabel('Base URL').fill(mock.url());
    await page.getByLabel('Base URL').blur();

    // Fetching the provider's own list fills the model suggestions.
    await page.getByRole('button', { name: 'Fetch models from the provider' }).click();
    await expect(page.locator('#doru-model-suggestions option')).toHaveCount(1);

    // The connection test runs against the configured endpoint.
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('Connected')).toBeVisible();

    // Everything was persisted through the settings IPC.
    const state = await page.evaluate(() => window.doru.getAiSettings());
    expect(state.provider).toBe('ollama');
    expect(state.model).toBe('mock-model');
    expect(state.configured).toBe(true);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});

test('the API key field saves and clears the key', async () => {
  // Saving goes through safeStorage (the OS keychain), which exists on macOS
  // dev machines but not on headless Linux CI.
  test.skip(process.platform !== 'darwin', 'safeStorage needs the OS keychain');

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
    await expect(page.getByPlaceholder('Saved in the system keychain')).toBeVisible();

    const saved = await page.evaluate(() => window.doru.getAiSettings());
    expect(saved.hasKey).toBe(true);

    await page.getByRole('button', { name: 'Clear key' }).click();
    const cleared = await page.evaluate(() => window.doru.getAiSettings());
    expect(cleared.hasKey).toBe(false);
  } finally {
    await app.close();
  }
});
