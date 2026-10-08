import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McpHostClient, McpHostManager } from '../src/host';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dummy-mcp-server.mjs');

const config = {
  name: 'dummy',
  command: process.execPath,
  args: [fixture],
};

describe('McpHostClient', () => {
  it('connects, lists prefixed tools, and calls them', async () => {
    const client = new McpHostClient(config);
    await client.connect();

    const tools = client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['dummy:count', 'dummy:echo']);

    const echo = await client.call('echo', { text: 'hello' });
    expect(echo).toBe('echo: hello');

    await client.close();
  });
});

describe('McpHostManager', () => {
  it('manages multiple servers and routes tool calls', async () => {
    const manager = new McpHostManager([config]);
    await manager.connectAll();

    expect(manager.has('dummy:echo')).toBe(true);
    expect(manager.has('tree_query')).toBe(false);
    expect(await manager.invoke('dummy:count', { text: 'abcd' })).toBe('4');
    expect(String(await manager.invoke('dummy:nope', {}))).toContain('not found');

    await manager.closeAll();
  });

  it('skips servers that fail to start', async () => {
    const manager = new McpHostManager([
      { name: 'broken', command: process.execPath, args: [join(dirname(fixture), 'missing.mjs')] },
      config,
    ]);
    await manager.connectAll();
    expect(manager.externalTools().some((tool) => tool.name === 'dummy:echo')).toBe(true);
    await manager.closeAll();
  });
});
