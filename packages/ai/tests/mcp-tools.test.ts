import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { connectMcpServers } from '../src/mcp-tools';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dummy-mcp-server.mjs');

const config = {
  name: 'dummy',
  command: process.execPath,
  args: [fixture],
};

describe('connectMcpServers', () => {
  it('connects, namespaces the server tools, and calls them', async () => {
    const handle = await connectMcpServers([config], async () => true, { default: 'ask', overrides: {} });
    try {
      expect(Object.keys(handle.tools).sort()).toEqual(['dummy:count', 'dummy:echo']);

      const echo = await (handle.tools['dummy:echo'] as { execute: (input: unknown) => Promise<unknown> }).execute({ text: 'hello' });
      expect(echo).toBe('echo: hello');
    } finally {
      await handle.close();
    }
  });

  it('skips servers that fail to start', async () => {
    const handle = await connectMcpServers(
      [
        { name: 'broken', command: process.execPath, args: [join(dirname(fixture), 'missing.mjs')] },
        config,
      ],
      async () => true,
      { default: 'ask', overrides: {} },
    );
    try {
      expect(Object.keys(handle.tools)).toContain('dummy:echo');
      expect(Object.keys(handle.tools)).not.toContain('broken:echo');
    } finally {
      await handle.close();
    }
  });
});
