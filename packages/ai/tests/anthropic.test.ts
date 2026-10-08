import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicChatConnector } from '../src/anthropic';
import { AI_PROVIDERS, findProvider } from '../src/providers';

describe('AnthropicChatConnector', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps messages and tools to the Anthropic wire format', async () => {
    let captured: { url: string; headers: HeadersInit; body: string } | null = null;
    vi.stubGlobal('fetch', async (input: unknown, init?: RequestInit) => {
      captured = {
        url: String(input),
        headers: init?.headers ?? {},
        body: String(init?.body),
      };
      return new Response(
        JSON.stringify({
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'tool_use', id: 'tu-1', name: 'tree.stats', input: {} },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const connector = new AnthropicChatConnector({
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-test',
      model: 'claude-test',
    });

    const result = await connector.complete(
      [
        { role: 'system', content: 'You are a genealogy assistant.' },
        { role: 'user', content: 'Inspect' },
        {
          role: 'assistant',
          content: null,
          toolCalls: [{ id: 'tc-1', name: 'tree.query', arguments: { query: 'ivan' } }],
        },
        { role: 'tool', toolCallId: 'tc-1', content: '{"ok":true}' },
        { role: 'user', content: 'Continue' },
      ],
      [{ name: 'tree.stats', description: 'Stats', inputSchema: { type: 'object' } }],
    );

    expect(result.content).toBe('Hello');
    expect(result.toolCalls).toEqual([{ id: 'tu-1', name: 'tree.stats', arguments: {} }]);

    const body = JSON.parse(captured!.body) as {
      model: string;
      max_tokens: number;
      system: string;
      messages: unknown[];
      tools: unknown[];
    };
    expect(body.model).toBe('claude-test');
    expect(body.system).toBe('You are a genealogy assistant.');
    expect(body.tools).toHaveLength(1);
    const messages = body.messages as Array<{ role: string; content: unknown }>;
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'user']);
    const headers = captured!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBeDefined();
    expect(captured!.url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('raises an error on non-2xx responses', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 401 }));
    const connector = new AnthropicChatConnector({
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-test',
      model: 'claude-test',
    });
    await expect(connector.complete([{ role: 'user', content: 'hi' }], [])).rejects.toThrow(
      'Model API error 401',
    );
  });
});

describe('AI_PROVIDERS', () => {
  it('has unique ids and a fallback resolver', () => {
    const ids = AI_PROVIDERS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findProvider('openai').id).toBe('openai');
    expect(findProvider('does-not-exist').id).toBe('openai');
  });
});
