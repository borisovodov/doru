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
      expect(Object.keys(handle.tools).sort()).toEqual(['dummy:count', 'dummy:echo', 'dummy:fail', 'dummy:odd']);

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

  it('denies tools through the policy without asking the gate', async () => {
    let asked = false;
    const handle = await connectMcpServers(
      [config],
      async () => {
        asked = true;
        return true;
      },
      { default: 'deny', overrides: {} },
    );
    try {
      const echo = handle.tools['dummy:echo'] as { execute: (input: unknown) => Promise<unknown> };
      await expect(echo.execute({ text: 'hi' })).rejects.toThrow('Permission denied by the user.');
      expect(asked).toBe(false);
    } finally {
      await handle.close();
    }
  });

  it('denies tools when the gate rejects', async () => {
    const handle = await connectMcpServers([config], async () => false, { default: 'ask', overrides: {} });
    try {
      const echo = handle.tools['dummy:echo'] as { execute: (input: unknown) => Promise<unknown> };
      await expect(echo.execute({ text: 'hi' })).rejects.toThrow('Permission denied by the user.');
    } finally {
      await handle.close();
    }
  });

  it('surfaces MCP tool errors as rejected executions', async () => {
    const handle = await connectMcpServers([config], async () => true, { default: 'ask', overrides: {} });
    try {
      const fail = handle.tools['dummy:fail'] as { execute: (input: unknown) => Promise<unknown> };
      await expect(fail.execute({})).rejects.toThrow('boom');
    } finally {
      await handle.close();
    }
  });

  it('serializes non-text MCP content to a string', async () => {
    const handle = await connectMcpServers([config], async () => true, { default: 'ask', overrides: {} });
    try {
      const odd = handle.tools['dummy:odd'] as { execute: (input: unknown) => Promise<unknown> };
      const output = await odd.execute({});
      expect(typeof output).toBe('string');
    } finally {
      await handle.close();
    }
  });
});
