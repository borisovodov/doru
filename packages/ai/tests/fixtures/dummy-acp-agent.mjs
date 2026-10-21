// A dummy ACP agent over stdio: streams one text chunk per prompt and then
// holds the turn open forever. The test aborts by killing the process.
import * as acp from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

acp
  .agent({ name: 'dummy-acp' })
  .onRequest('initialize', async () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: {},
  }))
  .onRequest('session/new', async () => ({ sessionId: 'sess-1' }))
  .onRequest('authenticate', async () => ({}))
  .onRequest('session/set_mode', async () => ({}))
  .onRequest('session/prompt', async ({ params, client }) => {
    await client.notify('session/update', {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'Partial ' },
      },
    });
    // Never finish the turn: the caller aborts by killing this process while
    // the client awaits further updates.
    await new Promise(() => {});
    return { stopReason: 'end_turn' };
  })
  .onNotification('session/cancel', async () => {})
  .connect(stream);
