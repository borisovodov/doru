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

    // A catalog provider shows the shipped model list, reasoning control,
    // and no fetch button.
    await page.getByLabel('Provider').selectOption('openai');
    const modelSelect = page.getByLabel('Model');
    expect(await modelSelect.locator('option').count()).toBeGreaterThan(10);
    await expect(page.getByLabel('Reasoning')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fetch models from the provider' })).toHaveCount(0);

    // A catalog-less provider switches the model field to a text input and
    // offers the fetch button.
    await page.getByLabel('Provider').selectOption('custom');
    await expect(page.getByRole('button', { name: 'Fetch models from the provider' })).toBeVisible();
    await expect(page.getByLabel('Reasoning')).toHaveCount(0);

    const modelInput = page.getByLabel('Model');
    await modelInput.fill('mock-model');
    await page.getByLabel('Base URL').fill(mock.url());
    await page.getByLabel('Base URL').blur();
    await page.getByPlaceholder('Paste an API key').fill('x');
    await page.getByRole('button', { name: 'Save key' }).click();

    // Fetching the provider's own list fills the model suggestions.
    await page.getByRole('button', { name: 'Fetch models from the provider' }).click();
    await expect(page.locator('#doru-model-suggestions option')).toHaveCount(1);

    // The connection test runs against the configured endpoint.
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('Connected')).toBeVisible();

    // Everything was persisted through the settings IPC.
    const state = await page.evaluate(() => window.doru.getAiSettings());
    expect(state.provider).toBe('custom');
    expect(state.model).toBe('mock-model');
    expect(state.hasKey).toBe(true);
    expect(state.configured).toBe(true);
  } finally {
    await app.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});
