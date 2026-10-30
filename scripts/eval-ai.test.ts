// The local-model eval gate for "Dóru AI": drives a llama.cpp `llama-server`
// sidecar (the architecture the app will ship) with the candidate GGUF models
// through the real agent toolset (`doruTools` / `TreeMcpBackend`) and scores
// each scenario on tool-call correctness and final tree state, in two modes:
// Qwen3.5 thinking (default) and non-thinking (`enable_thinking: false`).
//
// This file is intentionally outside the vitest `include` patterns, so `npm
// test` and CI never run it (it needs multi-GB models and a downloaded
// binary). Run it explicitly:
//
//   npx vitest run --config scripts/eval-ai.vitest.config.ts
//
// Artifacts live in the cache dir (default ~/Library/Caches/doru-ai-eval):
//   bin/llama-b11960/llama-server          (llama.cpp macOS arm64 build)
//   models/Qwen_Qwen3.5-{4B,9B}-Q4_K_M.gguf
//   results/eval-<model>-<mode>-<stamp>.json
// Overrides: DORU_EVAL_DIR, DORU_EVAL_BINARY, DORU_EVAL_MODEL_4B,
// DORU_EVAL_MODEL_9B, DORU_EVAL_MODELS ("4B,9B"), DORU_EVAL_MODES
// ("thinking,plain"), DORU_EVAL_SCENARIOS ("stats_en,query_men_en"),
// DORU_EVAL_REPEATS (runs per scenario, default 1; use >= 3 for small models).
import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { z } from 'zod';
import { SYSTEM_PROMPT, TreeMcpBackend, doruTools } from '@doru/ai';
import { cleanupAiFixture, makeAiFixture } from '../packages/ai/tests/helpers';
import { EVAL_SCENARIOS, seedFixture, type EvalScenario } from './eval-ai-scenarios';

type EvalMode = 'thinking' | 'plain';

interface EvalConfig {
  dir: string;
  binary: string;
  models: Record<string, string>;
  modes: EvalMode[];
  ctxSize: number;
  gpuLayers: number;
  maxTokens: number;
  maxSteps: number;
}

function csvFilter(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function loadConfig(): EvalConfig {
  const dir = process.env['DORU_EVAL_DIR'] ?? join(homedir(), 'Library/Caches/doru-ai-eval');
  const allModels: Record<string, string> = {
    '4B': process.env['DORU_EVAL_MODEL_4B'] ?? join(dir, 'models/Qwen_Qwen3.5-4B-Q4_K_M.gguf'),
    '9B': process.env['DORU_EVAL_MODEL_9B'] ?? join(dir, 'models/Qwen_Qwen3.5-9B-Q4_K_M.gguf'),
  };
  const modelFilter = csvFilter(process.env['DORU_EVAL_MODELS']);
  const models =
    modelFilter === undefined
      ? allModels
      : Object.fromEntries(Object.entries(allModels).filter(([tag]) => modelFilter.includes(tag)));
  const modeFilter = csvFilter(process.env['DORU_EVAL_MODES']);
  const allModes: EvalMode[] = ['thinking', 'plain'];
  const modes = modeFilter === undefined ? allModes : allModes.filter((mode) => modeFilter.includes(mode));
  return {
    dir,
    binary: process.env['DORU_EVAL_BINARY'] ?? join(dir, 'bin/llama-b11960/llama-server'),
    models,
    modes,
    ctxSize: 16384,
    gpuLayers: 99,
    maxTokens: 4096,
    maxSteps: 8,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close();
      if (address !== null && typeof address === 'object') {
        resolve(address.port);
      } else {
        reject(new Error('could not allocate a free port'));
      }
    });
  });
}

/** A llama-server sidecar, the same process model the app will use. */
class LlamaServer {
  private proc: ChildProcessByStdio<null, Readable, Readable> | undefined;
  private logLines: string[] = [];
  readonly baseUrl: string;

  constructor(
    private readonly binary: string,
    private readonly modelPath: string,
    private readonly port: number,
    private readonly ctxSize: number,
    private readonly gpuLayers: number,
  ) {
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async start(timeoutMs: number): Promise<void> {
    this.proc = spawn(
      this.binary,
      [
        '-m',
        this.modelPath,
        '--host',
        '127.0.0.1',
        '--port',
        String(this.port),
        '--ctx-size',
        String(this.ctxSize),
        '--n-gpu-layers',
        String(this.gpuLayers),
        '--parallel',
        '1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    this.proc.stdout.on('data', (chunk: Buffer) => this.logLines.push(chunk.toString()));
    this.proc.stderr.on('data', (chunk: Buffer) => this.logLines.push(chunk.toString()));
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const proc = this.proc;
      if (proc === undefined || proc.exitCode !== null) {
        throw new Error(`llama-server exited early (code ${proc?.exitCode ?? 'unknown'})\n${this.tail()}`);
      }
      try {
        const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          return;
        }
      } catch {
        // still booting
      }
      await sleep(500);
    }
    throw new Error(`llama-server did not become healthy within ${timeoutMs}ms\n${this.tail()}`);
  }

  async stop(): Promise<void> {
    const proc = this.proc;
    this.proc = undefined;
    if (proc === undefined) {
      return;
    }
    if (proc.exitCode === null) {
      proc.kill('SIGTERM');
      await Promise.race([
        new Promise<void>((resolve) => proc.once('exit', () => resolve())),
        sleep(10_000).then(() => {
          if (proc.exitCode === null) {
            proc.kill('SIGKILL');
          }
        }),
      ]);
    }
  }

  tail(limit = 60): string {
    return this.logLines.slice(-limit).join('');
  }
}

interface WireToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ChatTurnResult {
  content: string;
  reasoning: string;
  toolCalls: WireToolCall[];
  finishReason: string;
  /** Time to the first streamed token of any kind (thinking or answer). */
  ttftMs: number;
  /** Time to the first streamed answer text (excludes thinking tokens). */
  firstTextMs: number;
  durationMs: number;
}

type WireMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
    }
  | { role: 'tool'; tool_call_id: string; content: string };

interface WireTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** The shared toolset, converted to the OpenAI wire format llama-server speaks. */
function wireTools(): WireTool[] {
  return doruTools.map((definition) => {
    const raw = z.toJSONSchema(z.object(definition.inputSchema)) as unknown as Record<string, unknown>;
    delete raw['$schema'];
    return {
      type: 'function',
      function: { name: definition.name, description: definition.description, parameters: raw },
    };
  });
}

interface ChatOptions {
  mode: EvalMode;
  maxTokens: number;
  messages: WireMessage[];
  tools: WireTool[];
}

/**
 * One streaming chat-completions call. Sampling follows the Qwen3.5 model
 * card: temperature 1.0/top_p 0.95 in thinking mode, 0.7/0.8 in
 * non-thinking mode; both share top_k 20 and presence_penalty 1.5.
 */
async function chatTurn(server: LlamaServer, options: ChatOptions): Promise<ChatTurnResult> {
  const body: Record<string, unknown> = {
    model: 'doru-eval',
    messages: options.messages,
    tools: options.tools,
    stream: true,
    max_tokens: options.maxTokens,
    temperature: options.mode === 'thinking' ? 1.0 : 0.7,
    top_p: options.mode === 'thinking' ? 0.95 : 0.8,
    top_k: 20,
    presence_penalty: 1.5,
  };
  if (options.mode === 'plain') {
    body['chat_template_kwargs'] = { enable_thinking: false };
  }
  const started = Date.now();
  const response = await fetch(`${server.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`chat completions HTTP ${response.status}: ${text.slice(0, 2000)}`);
  }
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new Error('chat completions returned an empty body');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let finishReason = '';
  let ttftMs: number | undefined;
  let firstTextMs: number | undefined;
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of event.split('\n')) {
        if (!line.startsWith('data: ')) {
          continue;
        }
        const payload = line.slice('data: '.length);
        if (payload === '[DONE]') {
          continue;
        }
        let data: unknown;
        try {
          data = JSON.parse(payload);
        } catch {
          continue;
        }
        const choice = (data as { choices?: Array<{ delta?: unknown; finish_reason?: string | null }> })['choices']?.[0];
        if (choice === undefined) {
          continue;
        }
        if (choice['finish_reason'] !== undefined && choice['finish_reason'] !== null) {
          finishReason = choice['finish_reason'];
        }
        const delta = choice['delta'] as
          | {
              content?: string;
              reasoning_content?: string;
              tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
            }
          | undefined;
        if (delta === undefined) {
          continue;
        }
        const hasContent = delta['content'] !== undefined && delta['content'] !== '';
        const hasReasoning = delta['reasoning_content'] !== undefined && delta['reasoning_content'] !== '';
        const toolParts = delta['tool_calls'] ?? [];
        if (hasContent) {
          content += delta['content'];
          if (firstTextMs === undefined) {
            firstTextMs = Date.now() - started;
          }
        }
        if (hasReasoning) {
          reasoning += delta['reasoning_content'];
        }
        for (const part of toolParts) {
          const index = part['index'] ?? 0;
          const existing = calls.get(index) ?? { id: '', name: '', arguments: '' };
          if (part['id'] !== undefined) {
            existing.id = part['id'];
          }
          if (part['function']?.['name'] !== undefined) {
            existing.name = part['function']['name'];
          }
          if (part['function']?.['arguments'] !== undefined) {
            existing.arguments += part['function']['arguments'];
          }
          calls.set(index, existing);
        }
        if (ttftMs === undefined && (hasContent || hasReasoning || toolParts.length > 0)) {
          ttftMs = Date.now() - started;
        }
      }
    }
  }
  const toolCalls = [...calls.entries()].map(([, call]) => {
    let args: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(call.arguments);
      if (typeof parsed === 'object' && parsed !== null) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      args = {};
    }
    return { id: call.id, name: call.name, arguments: args };
  });
  return {
    content,
    reasoning,
    toolCalls,
    finishReason,
    ttftMs: ttftMs ?? Date.now() - started,
    firstTextMs: firstTextMs ?? Date.now() - started,
    durationMs: Date.now() - started,
  };
}

interface ScenarioCallRecord {
  name: string;
  args: Record<string, unknown>;
  ok: boolean;
}

interface ScenarioResult {
  scenario: string;
  ok: boolean;
  failures: string[];
  toolErrors: string[];
  calls: ScenarioCallRecord[];
  steps: number;
  ttftMs: number;
  firstTextMs: number;
  durationMs: number;
  /** Total thinking (reasoning_content) characters across all turns: non-zero proves thinking was on. */
  reasoningChars: number;
  mentionsOk: boolean;
  finalText: string;
}

/** Checks the expected call subsequence: order matters, extra calls are fine. */
function checkMustCall(scenario: EvalScenario, calls: ScenarioCallRecord[]): string[] {
  const failures: string[] = [];
  let cursor = 0;
  for (const expected of scenario.mustCall) {
    let checkError: string | undefined;
    let matched = false;
    for (let index = cursor; index < calls.length; index += 1) {
      const call = calls[index]!;
      if (call.name !== expected.name) {
        continue;
      }
      if (expected.check === undefined) {
        cursor = index + 1;
        matched = true;
        break;
      }
      const error = expected.check(call.args);
      if (error === null) {
        cursor = index + 1;
        matched = true;
        break;
      }
      checkError = error;
    }
    if (!matched) {
      failures.push(
        checkError === undefined ? `missing tool call "${expected.name}"` : `tool call "${expected.name}" failed: ${checkError}`,
      );
    }
  }
  return failures;
}

async function runScenario(
  server: LlamaServer,
  config: EvalConfig,
  mode: EvalMode,
  scenario: EvalScenario,
): Promise<ScenarioResult> {
  const fixture = makeAiFixture();
  try {
    seedFixture(fixture.queue, fixture.repo, scenario.seed);
    const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
    const messages: WireMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: scenario.prompt },
    ];
    const tools = wireTools();
    const calls: ScenarioCallRecord[] = [];
    const toolErrors: string[] = [];
    let finalText = '';
    let ttftMs = 0;
    let firstTextMs = 0;
    let durationMs = 0;
    let reasoningChars = 0;
    let steps = 0;
    for (let step = 0; step < config.maxSteps; step += 1) {
      steps = step + 1;
      const turn = await chatTurn(server, { mode, maxTokens: config.maxTokens, messages, tools });
      ttftMs = turn.ttftMs;
      firstTextMs = turn.firstTextMs;
      durationMs += turn.durationMs;
      reasoningChars += turn.reasoning.length;
      if (turn.content !== '') {
        // Strip a leading literal "null": the Qwen tool-calling convention
        // can leave it at the start of a plain-text answer too.
        finalText = turn.content.replace(/^null/i, '');
      }
      if (turn.toolCalls.length === 0 || turn.finishReason !== 'tool_calls') {
        break;
      }
      // Qwen models emit a literal "null" as the text content of a
      // tool-calling assistant message (OpenAI uses content: null there).
      // Echo it back as null — a literal string would leak into the next turn.
      const echoContent = turn.content.trim() === 'null' ? null : turn.content === '' ? null : turn.content;
      messages.push({
        role: 'assistant',
        content: echoContent,
        tool_calls: turn.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      });
      for (const call of turn.toolCalls) {
        let ok = true;
        let resultText: string;
        try {
          const result: unknown = await backend.invoke(call.name, call.arguments);
          resultText = JSON.stringify(result) ?? String(result);
        } catch (error) {
          ok = false;
          const message = error instanceof Error ? error.message : String(error);
          toolErrors.push(`${call.name}: ${message}`);
          resultText = JSON.stringify({ error: message });
        }
        calls.push({ name: call.name, args: call.arguments, ok });
        messages.push({ role: 'tool', tool_call_id: call.id, content: resultText });
      }
    }
    const failures = [...checkMustCall(scenario, calls), ...scenario.checkState(fixture.repo)];
    const mentionsOk =
      scenario.mentions === undefined ||
      scenario.mentions.some((mention) => finalText.toLowerCase().includes(mention.toLowerCase()));
    return {
      scenario: scenario.id,
      ok: failures.length === 0 && toolErrors.length === 0,
      failures,
      toolErrors,
      calls,
      steps,
      ttftMs,
      firstTextMs,
      durationMs,
      reasoningChars,
      mentionsOk,
      finalText,
    };
  } finally {
    cleanupAiFixture(fixture);
  }
}

interface ModeReport {
  generatedAt: string;
  llamaVersion: string;
  modelTag: string;
  modelPath: string;
  mode: EvalMode;
  results: ScenarioResult[];
}

function printSummary(report: ModeReport): void {
  const results = report.results;
  const unique = new Map<string, { pass: number; total: number }>();
  for (const result of results) {
    const key = result.scenario.replace(/#\d+$/, '');
    const entry = unique.get(key) ?? { pass: 0, total: 0 };
    if (result.ok) {
      entry.pass += 1;
    }
    entry.total += 1;
    unique.set(key, entry);
  }
  const passed = results.filter((result) => result.ok).length;
  const cleanCalls = results.filter((result) => result.calls.length > 0 && result.calls.every((call) => call.ok)).length;
  const mentionsOk = results.filter((result) => result.mentionsOk).length;
  const avg = (pick: (result: ScenarioResult) => number): number =>
    results.length === 0 ? 0 : results.reduce((sum, result) => sum + pick(result), 0) / results.length;
  const lines = [
    '',
    `== ${report.modelTag} / ${report.mode} ==`,
    `scenarios ${unique.size}, run-level pass ${passed}/${results.length}, clean tool calls ${cleanCalls}/${results.length}, mentions ${mentionsOk}/${results.length}`,
    `avg ttft ${(avg((r) => r.ttftMs) / 1000).toFixed(1)}s   first text ${(avg((r) => r.firstTextMs) / 1000).toFixed(1)}s   duration ${(avg((r) => r.durationMs) / 1000).toFixed(1)}s`,
  ];
  for (const [scenario, counts] of [...unique.entries()].sort()) {
    const marks = results
      .filter((result) => result.scenario === scenario || result.scenario.startsWith(`${scenario}#`))
      .map((result) => (result.ok ? '✓' : '✗'))
      .join('');
    const runTimes = results
      .filter((result) => result.scenario === scenario || result.scenario.startsWith(`${scenario}#`))
      .map((result) => `ttft=${(result.ttftMs / 1000).toFixed(1)}s think=${result.reasoningChars}`)
      .join(' ');
    lines.push(`  ${counts.pass}/${counts.total} ${scenario.padEnd(18)} ${marks} ${runTimes}`);
  }
  lines.push('');
  console.log(lines.join('\n'));
}

function writeReport(config: EvalConfig, report: ModeReport): void {
  const resultsDir = join(config.dir, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(resultsDir, `eval-${report.modelTag}-${report.mode}-${stamp}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`report: ${path}`);
}

const config = loadConfig();
const scenarioFilter = csvFilter(process.env['DORU_EVAL_SCENARIOS']);
const scenarios = EVAL_SCENARIOS.filter(
  (scenario) => scenarioFilter === undefined || scenarioFilter.includes(scenario.id),
);
const repeats = Math.max(1, Number.parseInt(process.env['DORU_EVAL_REPEATS'] ?? '1', 10) || 1);
let llamaVersion = '';

describe('Dóru AI local model eval', () => {
  for (const [modelTag, modelPath] of Object.entries(config.models)) {
    for (const mode of config.modes) {
      describe(`model=${modelTag} mode=${mode}`, () => {
        let server: LlamaServer | undefined;
        const report: ModeReport = {
          generatedAt: new Date().toISOString(),
          llamaVersion: '',
          modelTag,
          modelPath,
          mode,
          results: [],
        };
        beforeAll(async () => {
          if (llamaVersion === '') {
            const version = spawnSync(config.binary, ['--version'], { encoding: 'utf8' });
            // llama-server prints its version banner to stderr.
            llamaVersion = version.status === 0 ? (version.stdout || version.stderr || '').trim() : 'unknown';
          }
          report.llamaVersion = llamaVersion;
          const port = await freePort();
          server = new LlamaServer(config.binary, modelPath, port, config.ctxSize, config.gpuLayers);
          await server.start(300_000);
        }, 360_000);
        afterAll(async () => {
          try {
            await server?.stop();
          } finally {
            writeReport(config, report);
            printSummary(report);
          }
        });
        for (const scenario of scenarios) {
          it(scenario.id, async () => {
            if (server === undefined) {
              throw new Error('llama-server was not started');
            }
            const repeatFailures: string[] = [];
            for (let repeat = 1; repeat <= repeats; repeat += 1) {
              const result = await runScenario(server, config, mode, scenario);
              report.results.push({
                ...result,
                scenario: repeats > 1 ? `${scenario.id}#${repeat}` : scenario.id,
              });
              if (!result.ok) {
                const details = [...result.failures, ...result.toolErrors.map((error) => `tool error: ${error}`)];
                repeatFailures.push(
                  `repeat ${repeat}:\n  - ${details.join('\n  - ')}\nfinal text: ${result.finalText.slice(0, 300)}`,
                );
              }
            }
            if (repeatFailures.length > 0) {
              throw new Error(`failed in ${repeatFailures.length}/${repeats} repeats:\n${repeatFailures.join('\n')}`);
            }
          }, repeats * 900_000);
        }
      });
    }
  }
});
