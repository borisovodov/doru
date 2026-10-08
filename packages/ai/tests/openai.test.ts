import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIChatConnector } from '../src/openai';

describe('OpenAIChatConnector tool name sanitization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps dotted and colon tool names to provider-safe names and back', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', async (_input: unknown, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  { id: 'c1', function: { name: 'tree_query', arguments: '{"query":"ivan"}' } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const connector = new OpenAIChatConnector({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    });

    const result = await connector.complete(
      [{ role: 'user', content: 'find ivan' }],
      [
        { name: 'tree_query', description: 'q', inputSchema: { type: 'object' } },
        { name: 'web:search', description: 's', inputSchema: { type: 'object' } },
      ],
    );

    const tools = capturedBody?.tools as Array<{ function: { name: string } }>;
    expect(tools.map((tool) => tool.function.name).sort()).toEqual(['tree_query', 'web_search']);
    expect(result.toolCalls[0]?.name).toBe('tree_query');
  });

  it('disambiguates collisions after sanitization', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', async (_input: unknown, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const connector = new OpenAIChatConnector({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-chat',
    });
    await connector.complete(
      [{ role: 'user', content: 'x' }],
      [
        { name: 'tree_query', description: 'a', inputSchema: { type: 'object' } },
        { name: 'tree_query', description: 'b', inputSchema: { type: 'object' } },
      ],
    );

    const names = (capturedBody?.tools as Array<{ function: { name: string } }>).map(
      (tool) => tool.function.name,
    );
    expect(new Set(names).size).toBe(2);
  });
});
