import { describe, expect, it } from 'vitest';
import { agent } from '@agentclientprotocol/sdk';
import { AcpAgentClient } from '../src/acp';

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
    await client.startWithAgent(mockAgentApp(), async () => true);

    const result = await client.prompt('Inspect my tree');
    expect(result.finalText).toBe('Hello world');
    expect(result.steps.map((step) => step.type)).toEqual([
      'text',
      'text',
      'toolCall',
      'toolResult',
    ]);
    const toolCall = result.steps[2];
    if (toolCall?.type === 'toolCall') {
      expect(toolCall.name).toBe('tree_stats');
    }
  });

  it('answers permission requests through the gate', async () => {
    let asked: string | null = null;
    const gate = async (tool: string) => {
      asked = tool;
      return false;
    };
    const agentApp = agent({ name: 'mock-agent' })
      .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
      .onRequest('session/prompt', async ({ params, client }) => {
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
    await client.startWithAgent(agentApp, gate);
    await client.prompt('Edit something');
    expect(asked).toBe('tree_edit');
  });
});
