// A managed llama-server sidecar: the local inference engine behind the
// "Dóru AI" offline assistant. The controller is Electron-free (plain Node)
// and owns the whole lifecycle — lazy start, /health wait, model switch,
// clean shutdown — on an OpenAI-compatible endpoint bound to 127.0.0.1.
// The desktop main process will inject a UtilityProcess spawner, the
// headless MCP helper and tests use child_process-based or fake spawners.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

/** The slice of a child process the controller depends on. */
export interface SpawnedProcess {
  /** Exit code once exited; null while running. */
  readonly exitCode: number | null;
  kill(signal?: string): void;
  onExit(listener: (code: number | null, signal: string | null) => void): void;
  /** Receives process output; most spawners wire stdout+stderr here. */
  onOutput?(listener: (chunk: string) => void): void;
}

export type ProcessSpawner = (command: string, args: string[]) => SpawnedProcess;

export interface LlamaServerOptions {
  /** Path to the llama-server binary. */
  binary: string;
  /** GGUF model file to load. */
  modelPath: string;
  /** Context window in tokens (default 16384). */
  ctxSize?: number;
  /** Layers offloaded to the GPU; 99 means all, CPU builds fall back (default 99). */
  gpuLayers?: number;
  /** Port on 127.0.0.1; defaults to an OS-assigned free port. */
  port?: number;
  /** How long to wait for /health before failing, in ms (default 180000). */
  healthTimeoutMs?: number;
  /** Receives server output (both streams); useful for logs and debugging. */
  onLog?: (chunk: string) => void;
  /** Process spawner; defaults to node:child_process.spawn with piped stdio. */
  spawnProcess?: ProcessSpawner;
}

function defaultSpawner(command: string, args: string[]): SpawnedProcess {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    get exitCode() {
      return child.exitCode;
    },
    kill: (signal) => child.kill(signal as NodeJS.Signals | undefined),
    onExit: (listener) => child.once('exit', listener),
    onOutput: (listener) => {
      child.stdout?.on('data', (chunk: Buffer) => listener(chunk.toString()));
      child.stderr?.on('data', (chunk: Buffer) => listener(chunk.toString()));
    },
  };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close();
      if (address !== null && typeof address === 'object') {
        resolve(address.port);
      } else {
        reject(new Error('could not allocate a free port'));
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LlamaServer {
  private readonly binary: string;
  private modelPath: string;
  private readonly ctxSize: number;
  private readonly gpuLayers: number;
  private readonly fixedPort: number | undefined;
  private readonly healthTimeoutMs: number;
  private readonly onLog: (chunk: string) => void;
  private readonly spawnProcess: ProcessSpawner;
  private process: SpawnedProcess | undefined;
  private boundPort: number | undefined;
  private logTail: string[] = [];

  constructor(options: LlamaServerOptions) {
    this.binary = options.binary;
    this.modelPath = options.modelPath;
    this.ctxSize = options.ctxSize ?? 16384;
    this.gpuLayers = options.gpuLayers ?? 99;
    this.fixedPort = options.port;
    this.healthTimeoutMs = options.healthTimeoutMs ?? 180_000;
    this.onLog = options.onLog ?? (() => {});
    this.spawnProcess = options.spawnProcess ?? defaultSpawner;
  }

  /** The OpenAI-compatible base URL while running; undefined before the first start. */
  get baseUrl(): string | undefined {
    return this.boundPort === undefined ? undefined : `http://127.0.0.1:${this.boundPort}`;
  }

  get running(): boolean {
    return this.process !== undefined && this.process.exitCode === null;
  }

  /** Spawns llama-server and resolves once /health reports ok. */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    const port = this.fixedPort ?? (await freePort());
    const proc = this.spawnProcess(this.binary, this.serverArgs(port));
    this.process = proc;
    this.logTail = [];
    const log = (chunk: string): void => {
      this.logTail.push(chunk);
      if (this.logTail.length > 200) {
        this.logTail.splice(0, this.logTail.length - 200);
      }
      this.onLog(chunk);
    };
    proc.onExit((code, signal) => log(`[llama-server exited: code=${code} signal=${signal}]\n`));
    proc.onOutput?.(log);
    const deadline = Date.now() + this.healthTimeoutMs;
    while (Date.now() < deadline) {
      if (proc.exitCode !== null) {
        this.process = undefined;
        throw new Error(
          `llama-server exited before becoming healthy (code ${proc.exitCode})\n${this.logTail.join('')}`,
        );
      }
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          this.boundPort = port;
          return;
        }
      } catch {
        // still booting (connection refused / not ready yet)
      }
      await sleep(250);
    }
    this.process = undefined;
    proc.kill('SIGKILL');
    throw new Error(`llama-server did not become healthy within ${this.healthTimeoutMs}ms\n${this.logTail.join('')}`);
  }

  /** Stops the server; safe to call when not running, and idempotent. */
  async stop(): Promise<void> {
    const proc = this.process;
    this.process = undefined;
    if (proc === undefined || proc.exitCode !== null) {
      return;
    }
    proc.kill('SIGTERM');
    await Promise.race([
      new Promise<void>((resolve) => proc.onExit(() => resolve())),
      sleep(5_000).then(() => {
        if (proc.exitCode === null) {
          proc.kill('SIGKILL');
        }
      }),
    ]);
  }

  /** Stops and starts again with another model file (model switch). */
  async restart(modelPath: string): Promise<void> {
    await this.stop();
    this.modelPath = modelPath;
    await this.start();
  }

  /** The most recent server output, for error messages and debugging. */
  tail(): string {
    return this.logTail.join('');
  }

  private serverArgs(port: number): string[] {
    return [
      '-m',
      this.modelPath,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--ctx-size',
      String(this.ctxSize),
      '--n-gpu-layers',
      String(this.gpuLayers),
      '--parallel',
      '1',
    ];
  }
}
