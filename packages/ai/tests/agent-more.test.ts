import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { LanguageModel } from 'ai';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  stepCountIs: (n: number) => n,
}));

import { streamText } from 'ai';
import { runAgent, toModelMessages } from '../src/agent';

const model = {} as LanguageModel;
const streamTextMock = vi.mocked(streamText);

interface FakeStreamOptions {
  onChunk?: (event: { chunk: { type: string; text?: string } }) => void;
  onStepEnd?: (event: { content: Array<Record<string, unknown>> }) => void;
  onError?: (event: { error: unknown }) => void;
  [key: string]: unknown;
}

function implementStreamText(implementation: (options: FakeStreamOptions) => { text: Promise<string> }): void {
  streamTextMock.mockImplementation(implementation as unknown as typeof streamText);
}

function returnStreamText(text: string): void {
  streamTextMock.mockReturnValue({ text: Promise.resolve(text) } as unknown as ReturnType<typeof streamText>);
}

function firstStreamTextOptions(): Record<string, unknown> {
  const call = streamTextMock.mock.calls[0];
  if (call === undefined) {
    throw new Error('streamText was not called');
  }
  return call[0];
}

describe('toModelMessages', () => {
  it('drops system messages and converts plain roles', () => {
    const converted = toModelMessages([
      { role: 'system', content: 'be nice' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: null },
      { role: 'assistant', content: 'hi there' },
    ]);
    expect(converted).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: [] },
      { role: 'assistant', content: [{ type: 'text', text: 'hi there' }] },
    ]);
  });

  it('carries tool calls and matches tool results by id', () => {
    const converted = toModelMessages([
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call1', name: 'tree_query', arguments: { query: 'Ivan' } }],
      },
      { role: 'tool', content: '[]', toolCallId: 'call1' },
      { role: 'tool', content: null, toolCallId: 'missing' },
    ]);
    expect(converted).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call1', toolName: 'tree_query', input: { query: 'Ivan' } }],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'call1', toolName: 'tree_query', output: { type: 'text', value: '[]' } },
        ],
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'missing', toolName: '', output: { type: 'text', value: '' } }],
      },
    ]);
  });
});

describe('runAgent', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
  });

  it('streams deltas, collects steps and returns the final text', async () => {
    implementStreamText((options) => {
      options.onChunk?.({ chunk: { type: 'text-delta', text: 'Hel' } });
      options.onChunk?.({ chunk: { type: 'text-delta', text: 'lo' } });
      options.onChunk?.({ chunk: { type: 'other' } });
      options.onStepEnd?.({
        content: [
          { type: 'tool-call', toolName: 'tree_query', input: { query: 'Ivan' } },
          { type: 'tool-result', toolName: 'tree_query', output: [{ id: '@I1@' }] },
          { type: 'tool-error', toolName: 'tree_query', error: new Error('boom') },
          { type: 'tool-error', toolName: 'tree_query', error: 'plain text error' },
          { type: 'text', text: 'ignored' },
        ],
      });
      return { text: Promise.resolve('Hello!') };
    });

    const deltas: string[] = [];
    const steps: unknown[] = [];
    const result = await runAgent({
      model,
      messages: [{ role: 'user', content: 'hi' }],
      tools: {},
      maxSteps: 3,
      system: 'you are helpful',
      reasoning: 'low',
      events: { onTextDelta: (delta) => deltas.push(delta), onStep: (step) => steps.push(step) },
    });

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(result.finalText).toBe('Hello!');
    expect(result.steps).toEqual([
      { type: 'toolCall', name: 'tree_query', arguments: { query: 'Ivan' } },
      { type: 'toolResult', name: 'tree_query', result: [{ id: '@I1@' }] },
      { type: 'toolError', name: 'tree_query', message: 'boom' },
      { type: 'toolError', name: 'tree_query', message: 'plain text error' },
    ]);
    expect(steps).toEqual(result.steps);

    const options = firstStreamTextOptions();
    expect(options['stopWhen']).toBe(3);
    expect(options['instructions']).toBe('you are helpful');
    expect(options['reasoning']).toBe('low');
    expect(options['tools']).toEqual({});
  });

  it('uses the default step count and omits absent options', async () => {
    returnStreamText('done');
    const result = await runAgent({ model, messages: [], tools: {} });
    expect(result.finalText).toBe('done');
    const options = firstStreamTextOptions();
    expect(options['stopWhen']).toBe(8);
    expect(options['instructions']).toBeUndefined();
    expect(options['reasoning']).toBeUndefined();
    expect(options['abortSignal']).toBeUndefined();
  });

  it('carries stream errors with a classified code', async () => {
    implementStreamText((options) => {
      options.onError?.({ error: new Error('provider 500') });
      return { text: Promise.resolve('partial') };
    });
    const result = await runAgent({ model, messages: [], tools: {} });
    expect(result.finalText).toBe('partial');
    expect(result.error).toBe('provider 500');
    expect(result.errorCode).toBeDefined();
  });

  it('repairs string tool inputs and refines tree_query inputs', async () => {
    returnStreamText('ok');
    await runAgent({ model, messages: [], tools: {} });
    const options = firstStreamTextOptions() as unknown as {
      repairToolCall: (input: { toolCall: { input: unknown } }) => Promise<unknown>;
      experimental_refineToolInput: { tree_query: (input: unknown) => unknown };
    };

    expect(await options.repairToolCall({ toolCall: { input: '{"query": "x"}]}' } })).toEqual({
      input: '{"query": "x"}',
    });
    expect(await options.repairToolCall({ toolCall: { input: 'not json' } })).toBeNull();
    expect(await options.repairToolCall({ toolCall: { input: { query: 'x' } } })).toBeNull();
    expect(options.experimental_refineToolInput.tree_query({ query: 'sex:m' })).toEqual({ sex: 'M' });
  });
});
