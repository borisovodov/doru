import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '@doru/core';
import { jsonSchema, tool } from 'ai';
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test';
import { runAgent, toModelMessages } from '../src/agent';
import { TreeMcpBackend } from '../src/backend';
import { doruToolSet } from '../src/tools';
import { DEFAULT_PERMISSION_POLICY } from '../src/permissions';
import type { ChatMessage } from '../src/types';
import { cleanupAiFixture, makeAiFixture } from './helpers';

type ScriptedStream = ConstructorParameters<typeof MockLanguageModelV4>[0]['doStream'];

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
} as const;

const finish = (unified: 'tool-calls' | 'stop') => ({
  type: 'finish' as const,
  finishReason: { unified, raw: unified } as const,
  usage,
});

function toolCallStream(toolCallId: string, toolName: string, input: unknown) {
  // The LanguageModelV4StreamPart union in the d.ts omits the tool-call part,
  // but the runtime handles it; real providers emit it this way.
  return {
    stream: convertArrayToReadableStream([
      {
        type: 'tool-call' as const,
        toolCallId,
        toolName,
        input: JSON.stringify(input),
      } as never,
      finish('tool-calls') as never,
    ]),
  } as unknown as ScriptedStream;
}

function textStream(text: string) {
  return {
    stream: convertArrayToReadableStream([
      { type: 'text-start' as const, id: 't1' },
      { type: 'text-delta' as const, id: 't1', delta: text },
      { type: 'text-end' as const, id: 't1' },
      finish('stop'),
    ]),
  };
}

const ivan: PersonRecord = { id: '@I1@', names: [{ given: 'Ivan', surname: 'Ivanov' }], sex: 'M' };

describe('runAgent', () => {
  it('runs the tool loop, streams text and returns the final text', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson(ivan);
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
      const model = new MockLanguageModelV4({
        doStream: [
          toolCallStream('call-1', 'tree_query', { query: 'ivan', limit: 10 }),
          textStream('Found one person.'),
        ],
      });
      const deltas: string[] = [];
      const eventSteps: string[] = [];

      const result = await runAgent({
        model,
        messages: [{ role: 'user', content: 'Find Ivan' }],
        tools: doruToolSet(backend, async () => true, DEFAULT_PERMISSION_POLICY),
        events: {
          onTextDelta: (delta) => deltas.push(delta),
          onStep: (step) => eventSteps.push(step.type),
        },
      });

      expect(result.finalText).toBe('Found one person.');
      expect(deltas.join('')).toBe('Found one person.');
      expect(result.steps.map((step) => step.type)).toEqual(['toolCall', 'toolResult']);
      expect(eventSteps).toEqual(['toolCall', 'toolResult']);
      const queryStep = result.steps[1];
      if (queryStep?.type === 'toolResult') {
        expect(queryStep.result).toEqual([ivan]);
      }
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('applies tree edits through ops when the gate allows', async () => {
    const fixture = makeAiFixture();
    try {
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
      const model = new MockLanguageModelV4({
        doStream: [
          toolCallStream('call-1', 'tree_edit', {
            op: { kind: 'person.add', person: { id: '@I2@', names: [], sex: 'U' } },
          }),
          textStream('Added.'),
        ],
      });

      await runAgent({
        model,
        messages: [{ role: 'user', content: 'Add a person' }],
        tools: doruToolSet(backend, async () => true, DEFAULT_PERMISSION_POLICY),
      });

      expect(fixture.repo.countPersons()).toBe(1);
      expect(fixture.queue.canUndo()).toBe(true);
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('denies tools when the permission gate rejects', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson(ivan);
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
      const model = new MockLanguageModelV4({
        doStream: [
          toolCallStream('call-1', 'tree_edit', {
            op: { kind: 'person.add', person: { id: '@I2@', names: [], sex: 'U' } },
          }),
          textStream('Ok, I will not touch the tree.'),
        ],
      });

      const result = await runAgent({
        model,
        messages: [{ role: 'user', content: 'Add a person' }],
        tools: doruToolSet(backend, async () => false, { default: 'ask', overrides: {} }),
      });

      expect(fixture.repo.countPersons()).toBe(1);
      expect(result.steps.some((step) => step.type === 'toolError')).toBe(true);
      expect(result.finalText).toBe('Ok, I will not touch the tree.');
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('passes the system prompt, reasoning level and an abort signal through', async () => {
    const model = new MockLanguageModelV4({ doStream: [textStream('Ok.')] });
    const controller = new AbortController();

    const result = await runAgent({
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      system: 'You are a genealogy assistant.',
      reasoning: 'low',
      signal: controller.signal,
      tools: {},
    });

    expect(result.finalText).toBe('Ok.');
  });

  it('denies tools through the policy without asking the gate', async () => {
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson(ivan);
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
      let asked = false;
      const model = new MockLanguageModelV4({
        doStream: [
          toolCallStream('call-1', 'tree_query', { query: 'ivan' }),
          textStream('Skipped.'),
        ],
      });

      const result = await runAgent({
        model,
        messages: [{ role: 'user', content: 'Find Ivan' }],
        tools: doruToolSet(
          backend,
          async () => {
            asked = true;
            return true;
          },
          { default: 'deny', overrides: {} },
        ),
      });

      expect(asked).toBe(false);
      expect(result.steps.some((step) => step.type === 'toolError')).toBe(true);
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('handles tool calls without arguments', async () => {
    const model = new MockLanguageModelV4({
      doStream: [toolCallStream('call-1', 'tree_query', undefined), textStream('Listed.')],
    });
    const fixture = makeAiFixture();
    try {
      fixture.repo.insertPerson(ivan);
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue);
      const result = await runAgent({
        model,
        messages: [{ role: 'user', content: 'List' }],
        tools: doruToolSet(backend, async () => true, DEFAULT_PERMISSION_POLICY),
      });

      expect(result.finalText).toBe('Listed.');
      // The SDK marks a call without input as invalid; the transcript still
      // records the call and its error.
      expect(result.steps.map((step) => step.type)).toEqual(['toolCall', 'toolError']);
    } finally {
      cleanupAiFixture(fixture);
    }
  });

  it('records non-Error tool failures with their message', async () => {
    const model = new MockLanguageModelV4({
      doStream: [toolCallStream('call-1', 'bad_tool', {}), textStream('Recovered.')],
    });
    const result = await runAgent({
      model,
      messages: [{ role: 'user', content: 'Break it' }],
      tools: {
        bad_tool: tool({
          description: 'Always fails with a string.',
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          execute: async () => {
            throw 'nope';
          },
        }),
      },
    });

    const errorStep = result.steps.find((step) => step.type === 'toolError');
    expect(errorStep?.type === 'toolError' && errorStep.message).toBe('nope');
    expect(result.finalText).toBe('Recovered.');
  });
});

describe('toModelMessages', () => {
  it('converts plain transcript messages and drops system messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a genealogy assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];
    expect(toModelMessages(messages)).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi!' }] },
    ]);
  });

  it('maps tool calls and tool results with tool names', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Find Ivan' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', name: 'tree_query', arguments: { query: 'ivan' } }],
      },
      { role: 'tool', toolCallId: 'call-1', content: '[{"id":"@I1@"}]' },
    ];
    expect(toModelMessages(messages)).toEqual([
      { role: 'user', content: 'Find Ivan' },
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'tree_query', input: { query: 'ivan' } },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'tree_query',
            output: { type: 'text', value: '[{"id":"@I1@"}]' },
          },
        ],
      },
    ]);
  });

  it('fills in blanks for tool results without a known call', () => {
    const messages: ChatMessage[] = [{ role: 'tool', content: null }];
    expect(toModelMessages(messages)).toEqual([
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: '', toolName: '', output: { type: 'text', value: '' } },
        ],
      },
    ]);
  });
});
