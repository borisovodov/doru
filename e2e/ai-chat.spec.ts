import { test, expect, _electron as electron } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFamilyTree } from './seed';

const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');

interface ChatBody {
  stream?: boolean;
  messages?: Array<{ role: string }>;
}

/**
 * A scripted OpenAI-compatible provider on an ephemeral port. Call 1 returns
 * a tree_query tool call, call 2 a tree_edit tool call (which triggers the
 * permission card), later calls a plain text reply. Slow mode streams one
 * chunk and stalls, for the Stop-button test.
 */
function startMockProvider() {
  let slow = false;
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body: ChatBody = chunks.length > 0 ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as ChatBody) : {};
      if (req.method === 'GET' && req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-model' }] }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        if (!body.stream) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              id: 'chatcmpl-ping',
              object: 'chat.completion',
              created: 1,
              model: 'mock-model',
              choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          );
          return;
        }

        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        const sse = (chunk: Record<string, unknown>) => {
          if (res.writable) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        };
        const base = { id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model: 'mock-model' };
        const toolResultCount = (body.messages ?? []).filter((m) => m.role === 'tool').length;

        if (slow) {
          sse({ ...base, choices: [{ index: 0, delta: { content: 'Slow ' }, finish_reason: null }] });
          setTimeout(() => {
            sse({ ...base, choices: [{ index: 0, delta: { content: 'and never finished' }, finish_reason: null }] });
            sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
            res.write('data: [DONE]\n\n');
            res.end();
          }, 5_000);
          return;
        }

        if (toolResultCount === 0) {
          sse({
            ...base,
            choices: [
              {
                index: 0,
                delta: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-1',
                      type: 'function',
                      function: { name: 'tree_query', arguments: JSON.stringify({ query: 'ivan' }) },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          });
          sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        if (toolResultCount === 1) {
          const op = {
            kind: 'person.add',
            person: { id: 'E2EM1', names: [{ given: 'Mock', surname: 'Person' }], sex: 'U' },
          };
          sse({
            ...base,
            choices: [
              {
                index: 0,
                delta: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call-2',
                      type: 'function',
                      function: { name: 'tree_edit', arguments: JSON.stringify({ op }) },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          });
          sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        sse({ ...base, choices: [{ index: 0, delta: { content: 'Done.' }, finish_reason: null }] });
        sse({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });

  return {
    server,
    setSlow(value: boolean) {
      slow = value;
    },
    url: () => `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
  };
}

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
    // Configure the mock provider and verify the connection test and the
    // dynamic model list.
    const configured = await page.evaluate(
      async ({ baseUrl }) => {
        const state = await window.doru.setAiSettings({
          provider: 'custom',
          baseUrl,
          model: 'mock-model',
          apiKey: 'x',
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
          provider: 'custom',
          baseUrl,
          model: 'mock-model',
          apiKey: 'x',
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
