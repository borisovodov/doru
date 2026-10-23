import { describe, expect, it, vi } from 'vitest';
import { agent } from '@agentclientprotocol/sdk';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AcpAgentClient } from '../src/acp';
import { AcpError } from '../src/errors';

function mockAgentApp() {
  return agent({ name: 'mock-agent' })
    .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
    .onRequest('session/prompt', async ({ params, client }) => {
      const sessionId = params.sessionId;
      await client.notify('session/update', {
        sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello ' } },
      });
      await client.notify('session/update', {
        sessionId,
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'world' } },
      });
      await client.notify('session/update', {
        sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-1',
          title: 'Inspect the tree',
          name: 'tree_stats',
          kind: 'other',
          status: 'in_progress',
          rawInput: {},
        },
      });
      await client.notify('session/update', {
        sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'tc-1',
          status: 'completed',
          rawOutput: { persons: 2 },
        },
      });
      return { stopReason: 'end_turn' };
    });
}

describe('AcpAgentClient', () => {
  it('runs a prompt turn and collects text and tool steps', async () => {
    const client = new AcpAgentClient({
      command: 'unused',
      args: [],
      cwd: '/tmp',
      mcpServers: [],
    });
    await client.startWithAgent(mockAgentApp());

    const deltas: string[] = [];
    const eventSteps: string[] = [];
    const result = await client.prompt([{ type: 'text', text: 'Inspect my tree' }], {
      onTextDelta: (delta) => deltas.push(delta),
      onStep: (step) => eventSteps.push(step.type),
    });
    expect(result.finalText).toBe('Hello world');
    expect(deltas.join('')).toBe('Hello world');
    expect(result.steps.map((step) => step.type)).toEqual(['toolCall', 'toolResult']);
    expect(eventSteps).toEqual(['toolCall', 'toolResult']);
    const toolCall = result.steps[0];
    if (toolCall?.type === 'toolCall') {
      expect(toolCall.name).toBe('tree_stats');
    }
  });

  it('throws an AbortError when the signal is already aborted', async () => {
    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(mockAgentApp());

    const controller = new AbortController();
    controller.abort();
    await expect(client.prompt([{ type: 'text', text: 'Inspect my tree' }], {}, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('runs a full turn while the signal stays live', async () => {
    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(mockAgentApp());

    const controller = new AbortController();
    const result = await client.prompt([{ type: 'text', text: 'Inspect my tree' }], {}, controller.signal);
    expect(result.finalText).toBe('Hello world');
  });

  it('records failed tool calls as tool errors', async () => {
    const agentApp = agent({ name: 'mock-agent' })
      .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
      .onRequest('session/prompt', async ({ params, client }) => {
        await client.notify('session/update', {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'tc-1',
            title: 'Break',
            name: 'tree_edit',
            kind: 'other',
            status: 'in_progress',
            rawInput: {},
          },
        });
        await client.notify('session/update', {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId: 'tc-1',
            status: 'failed',
            rawOutput: 'boom',
          },
        });
        return { stopReason: 'end_turn' };
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(agentApp);

    const result = await client.prompt([{ type: 'text', text: 'Break something' }]);
    expect(result.steps.map((step) => step.type)).toEqual(['toolCall', 'toolError']);
    const failed = result.steps[1];
    if (failed?.type === 'toolError') {
      expect(failed.message).toBe('boom');
    }
  });

  it('aborts a running turn by killing the agent process', async () => {
    const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dummy-acp-agent.mjs');
    const client = new AcpAgentClient({
      command: process.execPath,
      args: [fixture],
      cwd: '/tmp',
      mcpServers: [],
    });
    await client.start();

    const deltas: string[] = [];
    const controller = new AbortController();
    const pending = client.prompt([{ type: 'text', text: 'Go' }], { onTextDelta: (delta) => deltas.push(delta) }, controller.signal);

    // Wait for the first chunk, then abort mid-turn.
    await vi.waitFor(() => {
      expect(deltas.join('')).toBe('Partial ');
    });
    controller.abort();

    await expect(pending).rejects.toThrow();
    await client.close();
  });

  it('fails with a helpful error when the agent never completes the handshake', async () => {
    const client = new AcpAgentClient({
      command: process.execPath,
      args: ['-e', "console.error('agent failed to boot: bad config'); setTimeout(() => {}, 60000)"],
      cwd: '/tmp',
      mcpServers: [],
      startTimeoutMs: 150,
    });

    const error: unknown = await client.start().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AcpError);
    const acpError = error as AcpError;
    expect(acpError.code).toBe('acp-handshake-timeout');
    // The raw message (for the log) carries the agent's own stderr.
    expect(acpError.message).toContain('did not answer the ACP handshake within 150 ms');
    expect(acpError.message).toContain('agent failed to boot: bad config');
  });

  it('rejects quickly when the agent binary cannot be spawned', async () => {
    const client = new AcpAgentClient({
      command: '/nonexistent/doru-acp-agent',
      args: [],
      cwd: '/tmp',
      mcpServers: [],
    });

    const error: unknown = await client.start().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AcpError);
    expect((error as AcpError).code).toBe('acp-spawn-failed');
    expect((error as AcpError).message).toContain('ENOENT');
  });

  it('includes the agent stdout in handshake failure details', async () => {
    // `--version`-style agents print to stdout (not stderr) and exit; the
    // diagnostics must surface that too.
    const client = new AcpAgentClient({
      command: process.execPath,
      args: ['-e', "console.log('opencode 2.0.30'); setTimeout(() => {}, 60000)"],
      cwd: '/tmp',
      mcpServers: [],
      startTimeoutMs: 150,
    });

    const error: unknown = await client.start().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AcpError);
    expect((error as AcpError).code).toBe('acp-handshake-timeout');
    expect((error as AcpError).message).toContain('stdout: opencode 2.0.30');
  });

  it('tears down cleanly when the agent dies mid-handshake', async () => {
    const client = new AcpAgentClient({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 60000)'],
      cwd: '/tmp',
      mcpServers: [],
      startTimeoutMs: 100,
    });

    await expect(client.start()).rejects.toThrow(/did not answer the ACP handshake/);
    // The killed child's stdin pipe is gone; connection teardown writes
    // must not raise EPIPE (any uncaught exception fails the whole run).
    await new Promise((resolve) => setTimeout(resolve, 50));
    await client.close();
  });

  it('prepends the system instructions as a leading prompt block', async () => {
    let received: unknown = null;
    const capturing = agent({ name: 'capturing-agent' })
      .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
      .onRequest('session/prompt', async ({ params, client }) => {
        received = params.prompt;
        await client.notify('session/update', {
          sessionId: params.sessionId,
          update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } },
        });
        return { stopReason: 'end_turn' };
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(capturing);
    await client.prompt([{ type: 'text', text: 'You are a genealogy assistant.' }, { type: 'text', text: 'list my ancestors' }]);

    expect(received).toEqual([
      { type: 'text', text: 'You are a genealogy assistant.' },
      { type: 'text', text: 'list my ancestors' },
    ]);
  });

  it('resets the agent session on demand', async () => {
    const sessionIds: string[] = [];
    const multi = agent({ name: 'multi-agent' })
      .onRequest('session/new', async () => {
        const sessionId = `sess-${sessionIds.length + 1}`;
        sessionIds.push(sessionId);
        return { sessionId };
      })
      .onRequest('session/prompt', async ({ params, client }) => {
        await client.notify('session/update', {
          sessionId: params.sessionId,
          update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `turn@${params.sessionId}` } },
        });
        return { stopReason: 'end_turn' };
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(multi);

    const first = await client.prompt([{ type: 'text', text: 'one' }]);
    expect(first.finalText).toBe('turn@sess-1');

    await client.resetSession();
    const second = await client.prompt([{ type: 'text', text: 'two' }]);
    expect(second.finalText).toBe('turn@sess-2');
    expect(sessionIds).toEqual(['sess-1', 'sess-2']);
  });

  it('auto-allows permission requests from the agent', async () => {
    let asked = false;
    const agentApp = agent({ name: 'mock-agent' })
      .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
      .onRequest('session/prompt', async ({ params, client }) => {
        asked = true;
        await client.request('session/request_permission', {
          sessionId: params.sessionId,
          toolCall: { toolCallId: 'tc-1', title: 'Edit', name: 'tree_edit', rawInput: {} },
          options: [
            { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
            { optionId: 'reject', name: 'Reject once', kind: 'reject_once' },
          ],
        });
        return { stopReason: 'end_turn' };
      });

    const client = new AcpAgentClient({ command: 'unused', args: [], cwd: '/tmp', mcpServers: [] });
    await client.startWithAgent(agentApp);
    const result = await client.prompt([{ type: 'text', text: 'Edit something' }]);
    expect(asked).toBe(true);
    // The permission request was answered (auto-allowed), so the turn
    // completes instead of hanging or rejecting.
    expect(result.finalText).toBe('');
  });
});
