// The production-path smoke for "Dóru AI": the exact stack the app uses —
// `buildLanguageModel` (openai-compatible provider) + `runAgent` with the
// shared toolset + the non-thinking providerOptions — against a real
// llama-server sidecar. The scenario matrix in eval-ai.test.ts drives the
// raw wire; this one proves the AI SDK integration between it and the app.
// Part of the same explicit-run gate:
//
//   npx vitest run --config scripts/eval-ai.vitest.config.ts eval-ai-sdk
//
// Artifacts and env overrides are the same as for eval-ai.test.ts.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DORU_AI_MODEL,
  DORU_CHAT_PROVIDER_OPTIONS,
  LlamaServer,
  SYSTEM_PROMPT,
  TreeMcpBackend,
  buildLanguageModel,
  doruToolSet,
  runAgent,
} from '@doru/ai';
import { cleanupAiFixture, makeAiFixture } from '../packages/ai/tests/helpers';
import { seedFixture } from './eval-ai-scenarios';

const dir = process.env['DORU_EVAL_DIR'] ?? join(homedir(), 'Library/Caches/doru-ai-eval');
const binary = process.env['DORU_EVAL_BINARY'] ?? join(dir, 'bin/llama-b11960/llama-server');
const modelPath = process.env['DORU_EVAL_MODEL_4B'] ?? join(dir, 'models/Qwen_Qwen3.5-4B-Q4_K_M.gguf');

describe('Dóru AI production path smoke (4B, non-thinking)', () => {
  let server: LlamaServer | undefined;

  beforeAll(async () => {
    server = new LlamaServer({ binary, modelPath, healthTimeoutMs: 300_000 });
    await server.start();
  }, 360_000);

  afterAll(async () => {
    await server?.stop();
  });

  it('answers through buildLanguageModel + runAgent + doruToolSet', async () => {
    if (server === undefined || server.baseUrl === undefined) {
      throw new Error('llama-server was not started');
    }
    const fixture = makeAiFixture();
    try {
      seedFixture(fixture.queue, fixture.repo, 'en');
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
      const model = buildLanguageModel({
        providerId: 'doru',
        baseUrl: server.baseUrl,
        apiKey: '',
        model: DORU_AI_MODEL.id,
      });
      const result = await runAgent({
        model,
        messages: [{ role: 'user', content: 'How many people are stored in this family tree?' }],
        system: SYSTEM_PROMPT,
        tools: doruToolSet(backend),
        providerOptions: DORU_CHAT_PROVIDER_OPTIONS,
      });
      expect(result.error).toBeUndefined();
      expect(result.steps.some((step) => step.type === 'toolCall' && step.name === 'tree_stats')).toBe(true);
      expect(result.finalText.toLowerCase()).toMatch(/5|five/);
    } finally {
      cleanupAiFixture(fixture);
    }
  }, 900_000);

  it('adds a relative with the correct anchor through the same path', async () => {
    if (server === undefined || server.baseUrl === undefined) {
      throw new Error('llama-server was not started');
    }
    const fixture = makeAiFixture();
    try {
      seedFixture(fixture.queue, fixture.repo, 'en');
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
      const model = buildLanguageModel({
        providerId: 'doru',
        baseUrl: server.baseUrl,
        apiKey: '',
        model: DORU_AI_MODEL.id,
      });
      const result = await runAgent({
        model,
        messages: [{ role: 'user', content: 'Ivan Petrov just had a son named Alexey. Add him to the tree.' }],
        system: SYSTEM_PROMPT,
        tools: doruToolSet(backend),
        providerOptions: DORU_CHAT_PROVIDER_OPTIONS,
      });
      expect(result.error).toBeUndefined();
      const hasChild = fixture.repo.listFamilies().some(
        (family) =>
          family.parents.includes('@I1@') &&
          family.children.some((id) => {
            const person = fixture.repo.getPerson(id);
            return person?.names.some((name) => (name.given ?? '').toLowerCase().includes('alexey')) ?? false;
          }),
      );
      expect(hasChild).toBe(true);
    } finally {
      cleanupAiFixture(fixture);
    }
  }, 900_000);
});
