import { spawn, type ChildProcess } from 'node:child_process';
import {
  client,
  ndJsonStream,
  RequestError,
  type AgentApp,
  type ClientApp,
  type ClientContext,
  type SessionBuilder,
  type Stream,
} from '@agentclientprotocol/sdk';
import type { AgentEvents, AgentStep } from './agent';
import { AcpError } from './errors';

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
  /** How long to wait for the agent to complete the ACP handshake. */
  startTimeoutMs?: number;
}

/** A text block of an ACP prompt (the protocol has no dedicated system role). */
export interface AcpPromptBlock {
  type: 'text';
  text: string;
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

/** Default ACP handshake timeout: generous enough for slow agent boots. */
const DEFAULT_START_TIMEOUT_MS = 60_000;

/**
 * After the handshake deadline the failure message is built only after a
 * short drain: the child may flush its startup output (a version banner,
 * a config error) right at the deadline, and the diagnostics must carry
 * it. The grace is invisible next to the default 60 s deadline and makes
 * the handshake-failure tests deterministic on slow CI boxes.
 */
const HANDSHAKE_DRAIN_GRACE_MS = 250;

export class AcpAgentClient {
  private readonly app: ClientApp;
  private child: ChildProcess | null = null;
  private connection: ReturnType<ClientApp['connect']> | null = null;
  private session: ActiveAcpSession | null = null;
  private stderrTail = '';
  private stdoutTail = '';
  /** Captured only until the session is up: after the handshake the stdout
   *  stream carries agent messages (family data) that must never be logged. */
  private captureStdout = false;
  private spawnFailed: Promise<never> | null = null;

  constructor(private readonly options: AcpConnectorOptions) {
    this.app = client({ name: 'doru' });
  }

  async start(): Promise<void> {
    this.registerPermissionHandler();
    const stream = this.spawnStream();
    this.connection = this.app.connect(stream);
    await this.withStartGuard(this.attach(this.connection.agent));
  }

  async startWithAgent(agentApp: AgentApp): Promise<void> {
    this.registerPermissionHandler();
    this.connection = this.app.connect(agentApp);
    await this.withStartGuard(this.attach(this.connection.agent));
  }

  /**
   * Starts a fresh agent session on the existing connection. Dóru owns the
   * conversation (the transcript) and replays it into a new agent session
   * when the user switches chat sessions, so the agent never needs
   * `session/resume` bookkeeping.
   */
  async resetSession(): Promise<void> {
    const connection = this.connection;
    if (!connection) {
      throw new AcpError('acp-connection-closed', 'The ACP connection is not started');
    }
    this.captureStdout = true;
    await this.withStartGuard(this.attach(connection.agent));
  }

  /**
   * The handshake fails when the command is not an ACP agent at all (it may
   * sit in interactive mode forever) or cannot be spawned. Fail with the
   * agent's own diagnostics instead of hanging the chat turn.
   */
  private async withStartGuard(attach: Promise<void>): Promise<void> {
    const timeoutMs = this.options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        void (async () => {
          // Let pending startup output arrive before the message is
          // built: the child may flush its diagnostics right at the
          // deadline (see HANDSHAKE_DRAIN_GRACE_MS).
          await new Promise((resolve) => setTimeout(resolve, HANDSHAKE_DRAIN_GRACE_MS));
          void this.close();
          reject(
            new AcpError(
              'acp-handshake-timeout',
              this.rawFailure(`did not answer the ACP handshake within ${timeoutMs} ms`),
            ),
          );
        })();
      }, timeoutMs);
    });
    const guardedAttach = attach.catch((error: unknown) => {
      // The agent died or rejected the session setup; the raw text stays on
      // the error for the log, the code picks the localized UI message.
      if (error instanceof AcpError) {
        throw error;
      }
      if (error instanceof RequestError) {
        throw new AcpError('acp-agent-error', error.message);
      }
      throw new AcpError(
        'acp-connection-closed',
        this.rawFailure(`closed the connection: ${error instanceof Error ? error.message : String(error)}`),
      );
    });
    try {
      await Promise.race([guardedAttach, timeout, this.spawnFailed ?? new Promise<never>(() => {})]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private rawFailure(detail: string): string {
    const command = [this.options.command, ...this.options.args].join(' ');
    const stdout = this.stdoutTail.trim();
    const stderr = this.stderrTail.trim();
    const outputs = [
      ...(stdout === '' ? [] : [`stdout: ${stdout}`]),
      ...(stderr === '' ? [] : [`stderr: ${stderr}`]),
    ];
    const suffix = outputs.length === 0 ? '' : ` Last output: ${outputs.join('; ')}`;
    return `The ACP agent command ('${command}') ${detail}.${suffix}`;
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
    // The handshake is done: stop keeping raw stdout for diagnostics —
    // from here on it carries the session protocol (family data).
    this.captureStdout = false;
  }

  /**
   * The agent asks before running a tool. Permissions are removed for now,
   * so every request auto-allows; the handler stays because the ACP protocol
   * requires the client to answer `session/request_permission`.
   */
  private registerPermissionHandler(): void {
    this.app.onRequest('session/request_permission', async ({ params }) => {
      const option = params.options.find((entry) => entry.kind.startsWith('allow'));
      if (option) {
        return { outcome: { outcome: 'selected', optionId: option.optionId } };
      }
      return { outcome: { outcome: 'cancelled' } };
    });
  }

  private spawnStream(): Stream {
    const child = spawn(this.options.command, this.options.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    this.captureStdout = true;
    this.spawnFailed = new Promise<never>((_, reject) => {
      child.on('error', (error: Error) =>
        reject(new AcpError('acp-spawn-failed', error.message)),
      );
    });
    // Keep the agent's diagnostics on the dev console (stderr was inherited
    // before) while remembering the tail for handshake error messages.
    child.stderr.on('data', (chunk: Uint8Array) => {
      process.stderr.write(chunk);
      this.stderrTail = (this.stderrTail + String(chunk)).slice(-4000);
    });
    // The agent can die mid-write (Stop button, handshake timeout): its
    // stdin pipe is gone and further writes fail with EPIPE. Swallow those
    // instead of letting them surface as uncaught exceptions.
    child.stdin.on('error', () => {});
    const output = new WritableStream<Uint8Array>({
      write(chunk) {
        if (child.exitCode !== null || !child.stdin.writable) {
          return;
        }
        try {
          child.stdin.write(chunk);
        } catch {
          // EPIPE thrown synchronously after the child exited.
        }
      },
      close() {
        if (child.exitCode === null && !child.stdin.destroyed) {
          child.stdin.end();
        }
      },
    });
    const input = new ReadableStream<Uint8Array>({
      start: (controller) => {
        child.stdout.on('data', (chunk: Uint8Array) => {
          // Pre-handshake stdout is startup noise (version, help, banners);
          // keep a short tail for handshake-failure diagnostics only.
          if (this.captureStdout) {
            this.stdoutTail = (this.stdoutTail + String(chunk)).slice(-4000);
          }
          controller.enqueue(chunk);
        });
        child.stdout.on('end', () => controller.close());
      },
    });
    return ndJsonStream(output, input);
  }

  async prompt(
    blocks: AcpPromptBlock[],
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
      // ACP has no dedicated system channel, so the instructions travel as a
      // leading text block in front of the user's message.
      const response = session.prompt(blocks);
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
    } catch (error) {
      if (error instanceof AcpError || signal?.aborted) {
        throw error;
      }
      if (error instanceof RequestError) {
        // The agent answered the turn with a JSON-RPC error (its own
        // failure — e.g. an unreachable model upstream).
        throw new AcpError('acp-agent-error', error.message);
      }
      throw new AcpError('acp-connection-closed', error instanceof Error ? error.message : String(error));
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async close(): Promise<void> {
    this.session = null;
    this.connection = null;
    this.child?.kill();
    this.child = null;
  }
}
