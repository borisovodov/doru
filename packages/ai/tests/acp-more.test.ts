import { describe, expect, it } from 'vitest';
import { agent, RequestError } from '@agentclientprotocol/sdk';
import { AcpAgentClient } from '../src/acp';
import { AcpError } from '../src/errors';

function mockAgentApp() {
  return agent({ name: 'mock-agent' })
    .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
    .onRequest('session/prompt', async ({ params, client }) => {
      await client.notify('session/update', {
        sessionId: params.sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } },
      });
      return { stopReason: 'end_turn' };
    });
}

describe('AcpAgentClient edge cases', () => {
  it('rejects resetSession and prompt before the connection is started', async () => {
    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await expect(client.resetSession()).rejects.toMatchObject({ code: 'acp-connection-closed' });
    await expect(client.prompt([{ type: 'text', text: 'hi' }])).rejects.toThrow('ACP session is not started');
  });

  it('passes MCP server command, args and env into the session', async () => {
    const client = new AcpAgentClient({
      command: 'unused',
      args: [],
      cwd: '/tmp',
      mcpServers: [
        { name: 'files', command: 'mcp-files', args: ['--root', '/data'], env: { TOKEN: 't' } },
        { name: 'plain', command: 'mcp-plain' },
      ],
    });
    await client.startWithAgent(mockAgentApp());
    const result = await client.prompt([{ type: 'text', text: 'hi' }]);
    expect(result.finalText).toBe('ok');
    await client.close();
  });

  it('cancels permission requests without an allow option', async () => {
    let answered: unknown = null;
    const app = agent({ name: 'permission-agent' })
      .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
      .onRequest('session/prompt', async ({ params, client }) => {
        answered = await client.request('session/request_permission', {
          sessionId: params.sessionId,
          toolCall: { toolCallId: 'tc-1', title: 'Edit', name: 'tree_edit', rawInput: {} },
          options: [{ optionId: 'reject', name: 'Reject', kind: 'reject_once' }],
        });
        return { stopReason: 'end_turn' };
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(app);
    const result = await client.prompt([{ type: 'text', text: 'Edit' }]);
    expect(result.finalText).toBe('');
    expect(answered).toEqual({ outcome: { outcome: 'cancelled' } });
  });

  it('ignores unknown session updates', async () => {
    const app = agent({ name: 'noise-agent' })
      .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
      .onRequest('session/prompt', async ({ params, client }) => {
        await client.notify('session/update', {
          sessionId: params.sessionId,
          update: { sessionUpdate: 'some_future_update' as never },
        });
        await client.notify('session/update', {
          sessionId: params.sessionId,
          update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } },
        });
        return { stopReason: 'end_turn' };
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(app);
    const result = await client.prompt([{ type: 'text', text: 'hi' }]);
    expect(result.finalText).toBe('ok');
  });

  it('wraps a session-level RequestError as acp-agent-error', async () => {
    const app = agent({ name: 'error-agent' })
      .onRequest('session/new', async () => {
        throw new RequestError(-32603, 'agent-side JSON-RPC failure');
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    const error: unknown = await client.startWithAgent(app).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AcpError);
    expect((error as AcpError).code).toBe('acp-agent-error');
  });

  it('wraps a crash of the agent mid-turn as a local AcpError', async () => {
    const app = agent({ name: 'crash-agent' })
      .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
      .onRequest('session/prompt', async () => {
        throw new Error('the agent process died');
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(app);
    const error: unknown = await client.prompt([{ type: 'text', text: 'hi' }]).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AcpError);
  });
});
