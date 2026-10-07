import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DoruMcpServer } from '../src/server';
import { TreeMcpBackend } from '../src/backend';
import { cleanupAiFixture, makeAiFixture } from './helpers';

describe('DoruMcpServer', () => {
  it('serves tools over an MCP transport', { timeout: 15000 }, async () => {
    const fixture = makeAiFixture();
    try {
      const backend = new TreeMcpBackend(fixture.repo, fixture.queue, 'agent:mcp');
      const server = new DoruMcpServer(backend, '0.0.1');
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      await client.connect(clientTransport);

      const stats = await client.callTool({ name: 'tree.stats', arguments: {} });
      const text = stats.content[0];
      expect(text?.type).toBe('text');
      if (text?.type === 'text') {
        expect(JSON.parse(text.text)).toEqual({ persons: 0, families: 0 });
      }

      const missing = await client.callTool({ name: 'tree.get', arguments: { personId: 'nope' } });
      expect(missing.content[0]).toMatchObject({ type: 'text' });

      await client.close();
      await server.close();
    } finally {
      cleanupAiFixture(fixture);
    }
  });
});
