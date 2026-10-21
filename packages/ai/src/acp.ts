import { spawn, type ChildProcess } from 'node:child_process';
import {
  client,
  ndJsonStream,
  type AgentApp,
  type ClientApp,
  type ClientContext,
  type SessionBuilder,
  type Stream,
} from '@agentclientprotocol/sdk';
import type { AgentEvents, AgentStep, PermissionGate } from './agent';

export interface AcpMcpServerEntry {
  name: string;
  command: string;
  args?: string[] | undefined;
  env?: Record<string, string> | undefined;
}

export interface AcpConnectorOptions {
  command: string;
  args: string[];
  cwd: string;
  mcpServers: AcpMcpServerEntry[];
}

interface ToolCallUpdateLike {
  toolCallId: string;
  name?: string | null;
  title?: string | null;
  rawInput?: unknown;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | null;
  output?: unknown;
  rawOutput?: unknown;
}

type ActiveAcpSession = Awaited<ReturnType<SessionBuilder['start']>>;

export class AcpAgentClient {
  private readonly app: ClientApp;
  private child: ChildProcess | null = null;
  private session: ActiveAcpSession | null = null;
  private gate: PermissionGate = async () => false;

  constructor(private readonly options: AcpConnectorOptions) {
    this.app = client({ name: 'doru' });
  }

  async start(onPermission: PermissionGate): Promise<void> {
    this.gate = onPermission;
    this.registerPermissionHandler();
    const stream = this.spawnStream();
    const connection = this.app.connect(stream);
    await this.attach(connection.agent);
  }

  async startWithAgent(agentApp: AgentApp, onPermission: PermissionGate): Promise<void> {
    this.gate = onPermission;
    this.registerPermissionHandler();
    const connection = this.app.connect(agentApp);
    await this.attach(connection.agent);
  }

  private async attach(ctx: ClientContext): Promise<void> {
    this.session = await ctx
      .buildSession({
        cwd: this.options.cwd,
        mcpServers: this.options.mcpServers.map((server) => ({
          name: server.name,
          command: server.command,
          args: server.args ?? [],
          env: Object.entries(server.env ?? {}).map(([name, value]) => ({ name, value })),
        })),
      })
      .start();
  }

  private registerPermissionHandler(): void {
    this.app.onRequest('session/request_permission', async ({ params }) => {
      const name = params.toolCall.name ?? params.toolCall.title ?? params.toolCall.toolCallId;
      const rawInput = params.toolCall.rawInput;
      const allowed = await this.gate(name, (rawInput as Record<string, unknown> | undefined) ?? {});
      if (allowed) {
        const option = params.options.find((entry) => entry.kind.startsWith('allow'));
        if (option) {
          return { outcome: { outcome: 'selected', optionId: option.optionId } };
        }
      } else {
        const reject = params.options.find((entry) => entry.kind.startsWith('reject'));
        if (reject) {
          return { outcome: { outcome: 'selected', optionId: reject.optionId } };
        }
      }
      return { outcome: { outcome: 'cancelled' } };
    });
  }

  private spawnStream(): Stream {
    const child = spawn(this.options.command, this.options.args, {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    this.child = child;
    const output = new WritableStream<Uint8Array>({
      write(chunk) {
        child.stdin.write(chunk);
      },
      close() {
        child.stdin.end();
      },
    });
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        child.stdout.on('data', (chunk: Uint8Array) => controller.enqueue(chunk));
        child.stdout.on('end', () => controller.close());
      },
    });
    return ndJsonStream(output, input);
  }

  async prompt(
    text: string,
    events?: AgentEvents,
    signal?: AbortSignal,
  ): Promise<{ steps: AgentStep[]; finalText: string }> {
    const session = this.session;
    if (!session) {
      throw new Error('ACP session is not started');
    }
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }
    // Killing the child process is the ACP way to stop a running turn; the
    // session is recreated on the next prompt via start().
    const onAbort = () => {
      void this.close();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const steps: AgentStep[] = [];
    let finalText = '';
    try {
      // The prompt request and the update stream run concurrently: updates
      // arrive while the turn is still in flight, and nextUpdate() rejects
      // when the agent process dies (Stop button).
      const response = session.prompt(text);
      for (;;) {
        const message = await session.nextUpdate();
        if (message.kind === 'stop') {
          break;
        }
        const update = message.update;
        switch (update.sessionUpdate) {
          case 'agent_message_chunk': {
            const chunk = (update as { content?: { text?: string } }).content?.text ?? '';
            if (chunk) {
              finalText += chunk;
              events?.onTextDelta?.(chunk);
            }
            break;
          }
          case 'tool_call': {
            const call = update as unknown as ToolCallUpdateLike;
            const step: AgentStep = {
              type: 'toolCall',
              name: call.name ?? call.title ?? call.toolCallId,
              arguments: (call.rawInput as Record<string, unknown> | undefined) ?? {},
            };
            steps.push(step);
            events?.onStep?.(step);
            break;
          }
          case 'tool_call_update': {
            const call = update as unknown as ToolCallUpdateLike;
            if (call.status === 'completed') {
              const step: AgentStep = {
                type: 'toolResult',
                name: call.name ?? call.title ?? call.toolCallId,
                result: call.output ?? call.rawOutput ?? '',
              };
              steps.push(step);
              events?.onStep?.(step);
            } else if (call.status === 'failed') {
              const step: AgentStep = {
                type: 'toolError',
                name: call.name ?? call.title ?? call.toolCallId,
                message: typeof call.rawOutput === 'string' ? call.rawOutput : 'Tool failed',
              };
              steps.push(step);
              events?.onStep?.(step);
            }
            break;
          }
          default:
            break;
        }
      }
      await response;
      return { steps, finalText };
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async close(): Promise<void> {
    this.session = null;
    this.child?.kill();
    this.child = null;
  }
}
