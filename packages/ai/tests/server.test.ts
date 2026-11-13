import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DoruMcpServer } from '../src/server';
import { TreeMcpBackend } from '../src/backend';
import { cleanupAiFixture, makeAiFixture } from './helpers';

interface TextContent {
  type: 'text';
  text: string;
}

function firstTextContent(result: Awaited<ReturnType<Client['callTool']>>): TextContent | undefined {
  const content: unknown = result.content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const first: unknown = content[0];
  if (
    typeof first !== 'object' ||
    first === null ||
    !('type' in first) ||
    first['type'] !== 'text' ||
    !('text' in first) ||
    typeof first['text'] !== 'string'
  ) {
    return undefined;
  }
  return { type: 'text', text: first['text'] };
}

describe('DoruMcpServer', () => {
  it('serves tools over an MCP transport', { timeout: 60000 }, async () => {
    const fixture = makeAiFixture();
    try {
      const backend = new TreeMcpBackend(fixture.service);
      const server = new DoruMcpServer(backend, '0.0.1');
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      await client.connect(clientTransport);

      const stats = await client.callTool({ name: 'tree_stats', arguments: {} });
      const text = firstTextContent(stats);
      expect(text?.type).toBe('text');
      if (text !== undefined) {
        expect(JSON.parse(text.text)).toEqual({ persons: 0, families: 0 });
      }

      const missing = await client.callTool({ name: 'tree_get', arguments: { personId: 'nope' } });
      expect(firstTextContent(missing)?.type).toBe('text');

      await client.close();
      await server.close();
    } finally {
      cleanupAiFixture(fixture);
    }
  });
});
