// The Dóru AI offline assistant: the settings wizard step (download with
// resume and cancel, the installed/remove state) and the chat gate. The
// download is pointed at a local throttled server with a small payload via
// the DORU_AI_DOWNLOAD_URL / DORU_AI_MODEL_SHA256 / DORU_AI_MODEL_SIZE_BYTES
// hooks (see apps/desktop/src/main/local-model.ts) — the real 2.8 GB model
// never enters CI. The installed state uses a sparse file of the manifest
// size, so no real weights are needed either.
import { test, expect, _electron as electron } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer as createHttpServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DORU_AI_MODEL } from '@doru/ai';

const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');

interface ModelServer {
  port: number;
  sha256: string;
  size: number;
  rangeRequests: string[];
  close: () => Promise<void>;
}

/** Serves a 2 MB payload slowly, honoring single-range requests (resume). */
function startModelServer(chunkSize = 64 * 1024, delayMs = 120): Promise<ModelServer> {
  const payload = randomBytes(chunkSize * 32);
  const sha256 = createHash('sha256').update(payload).digest('hex');
  const rangeRequests: string[] = [];
  const server: Server = createHttpServer((req, res) => {
    const range = req.headers.range;
    if (range !== undefined) {
      rangeRequests.push(range);
    }
    let start = 0;
    if (range !== undefined) {
      const match = /^bytes=(\d+)-$/.exec(range);
      if (match === null || Number(match[1]) >= payload.length) {
        res.writeHead(416);
        res.end();
        return;
      }
      start = Number(match[1]);
      res.writeHead(206, {
        'content-range': `bytes ${start}-${payload.length - 1}/${payload.length}`,
        'content-length': String(payload.length - start),
      });
    } else {
      res.writeHead(200, { 'content-length': String(payload.length) });
    }
    let offset = start;
    const tick = () => {
      if (offset >= payload.length) {
        res.end();
        return;
      }
      const end = Math.min(offset + chunkSize, payload.length);
      res.write(payload.subarray(offset, end));
      offset = end;
      setTimeout(tick, delayMs);
    };
    tick();
    req.on('close', () => {
      if (!res.writableEnded) {
        res.destroy();
      }
    });
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address !== null && typeof address === 'object' ? address.port : 0;
      resolveServer({
        port,
        sha256,
        size: payload.length,
        rangeRequests,
        close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
      });
    });
  });
}

async function launchApp(userData: string, env: Record<string, string>) {
  const args = ['.'];
  if (process.env['CI'] === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData, ...env },
  });
  const page = await app.firstWindow();
  await expect(page.locator('.welcome-page')).toBeVisible();
  await page.locator('.activity-bar .activity-bar-bottom').click();
  await expect(page.getByLabel('Provider')).toBeVisible();
  return { app, page };
}

test('the Dóru AI step downloads, resumes, and removes the model', async () => {
  const model = await startModelServer();
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-model-'));

  const { app, page } = await launchApp(userData, {
    DORU_AI_DOWNLOAD_URL: `http://127.0.0.1:${model.port}/model.gguf`,
    DORU_AI_MODEL_SHA256: model.sha256,
    DORU_AI_MODEL_SIZE_BYTES: String(model.size),
  });

  try {
    // The fresh install lands on Dóru AI with the download button.
    await expect(page.getByLabel('Provider')).toHaveValue('doru');
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

    // Start the download and cancel it once the first bytes arrived.
    await page.getByRole('button', { name: 'Download' }).click();
    await expect(page.locator('.settings-progress')).toBeVisible();
    await expect
      .poll(
        async () => page.locator('.settings-progress').evaluate((el) => (el as HTMLProgressElement).value),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Cancel download' }).click();
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();

    // Download again: the partial file resumes via a Range request, the
    // payload verifies, and the installed state appears.
    await page.getByRole('button', { name: 'Download' }).click();
    await expect(page.getByRole('button', { name: 'Remove model' })).toBeVisible({ timeout: 30_000 });
    expect(model.rangeRequests.filter((range) => range.startsWith('bytes=')).length).toBeGreaterThan(0);

    const modelPath = join(userData, 'models', DORU_AI_MODEL.file);
    expect(statSync(modelPath).size).toBe(model.size);

    // Remove the model: the download button returns and the file is gone.
    await page.getByRole('button', { name: 'Remove model' }).click();
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
    expect(() => statSync(modelPath)).toThrow();
  } finally {
    await model.close();
    await app.close();
  }
});

test('an installed model flips the configured gate and survives a restart', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-installed-'));
  // A sparse file of exactly the manifest size counts as installed: the
  // gate checks the size, not the contents.
  const modelPath = join(userData, 'models', DORU_AI_MODEL.file);
  mkdirSync(join(userData, 'models'), { recursive: true });
  execFileSync('truncate', ['-s', String(DORU_AI_MODEL.sizeBytes), modelPath]);

  const first = await launchApp(userData, {});
  try {
    await expect(first.page.getByRole('button', { name: 'Remove model' })).toBeVisible();
    await expect(first.page.getByLabel('Provider')).toHaveValue('doru');
    const state = await first.page.evaluate(() => window.doru.getAiSettings());
    expect(state.configured).toBe(true);
  } finally {
    await first.app.close();
  }

  // A restart still sees the model (state derives from the file, not memory).
  const second = await launchApp(userData, {});
  try {
    await expect(second.page.getByRole('button', { name: 'Remove model' })).toBeVisible();
  } finally {
    await second.app.close();
  }
});

test('an older manifest model shows the update nudge and updates in place', async () => {
  const model = await startModelServer();
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-outdated-'));
  // A stale model from a previous release: right file name, wrong size.
  const modelPath = join(userData, 'models', DORU_AI_MODEL.file);
  mkdirSync(join(userData, 'models'), { recursive: true });
  execFileSync('truncate', ['-s', String(DORU_AI_MODEL.sizeBytes - 1), modelPath]);

  const { app, page } = await launchApp(userData, {
    DORU_AI_DOWNLOAD_URL: `http://127.0.0.1:${model.port}/model.gguf`,
    DORU_AI_MODEL_SHA256: model.sha256,
    DORU_AI_MODEL_SIZE_BYTES: String(model.size),
  });

  try {
    // The stale file is not the current model: quiet nudge plus Update.
    await expect(page.getByText('An updated model is available.')).toBeVisible();
    const update = page.getByRole('button', { name: 'Update' });
    await expect(update).toBeVisible();

    // Updating downloads the current manifest entry and replaces the file;
    // the state then flips to the plain installed view.
    await update.click();
    await expect(page.getByRole('button', { name: 'Remove model' })).toBeVisible({ timeout: 30_000 });
    expect(statSync(modelPath).size).toBe(model.size);
  } finally {
    await model.close();
    await app.close();
  }
});

test('the chat stays gated until the model exists', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-chat-gate-'));
  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-chat-')), 'family.doru');
  const { app, page } = await launchApp(userData, {});
  try {
    // Without the model the provider is not configured, so the chat shows
    // the setup placeholder instead of the input.
    await page.evaluate(
      async ({ path }) => {
        await window.doru.openProjectPath(path);
      },
      { path: project },
    );
    await expect(page.locator('.chat-setup')).toBeVisible();
    await expect(page.locator('.chat-input')).toHaveCount(0);
  } finally {
    await app.close();
  }
});
