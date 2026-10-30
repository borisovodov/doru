import { createServer as createHttpServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlamaServer, type ProcessSpawner, type SpawnedProcess } from '../src/llama-server';

/** A scripted child process: records kills, dispatches exit/output events. */
class FakeProcess implements SpawnedProcess {
  exitCode: number | null = null;
  readonly killed: string[] = [];
  private readonly exitListeners: Array<(code: number | null, signal: string | null) => void> = [];
  private readonly outputListeners: Array<(chunk: string) => void> = [];

  kill(signal?: string): void {
    this.killed.push(signal ?? 'SIGTERM');
    if (this.exitCode === null) {
      // A real process exits asynchronously after the signal; defer so that
      // onExit listeners registered right after kill() still fire.
      queueMicrotask(() => this.emitExit(signal === 'SIGKILL' ? null : 0, signal ?? 'SIGTERM'));
    }
  }

  onExit(listener: (code: number | null, signal: string | null) => void): void {
    this.exitListeners.push(listener);
  }

  onOutput(listener: (chunk: string) => void): void {
    this.outputListeners.push(listener);
  }

  emitExit(code: number | null, signal: string | null): void {
    this.exitCode = code;
    for (const listener of this.exitListeners) {
      listener(code, signal);
    }
  }

  emitOutput(chunk: string): void {
    for (const listener of this.outputListeners) {
      listener(chunk);
    }
  }
}

interface SpawnRecord {
  command: string;
  args: string[];
  process: FakeProcess;
}

function fakeSpawner(records: SpawnRecord[]): ProcessSpawner {
  return (command, args) => {
    const process = new FakeProcess();
    records.push({ command, args, process });
    return process;
  };
}

interface HealthServer {
  port: number;
  close: () => Promise<void>;
}

function startHealthServer(status: 'ok' | 'loading'): Promise<HealthServer> {
  return new Promise((resolve) => {
    const http = createHttpServer((_req, res) => {
      if (status === 'ok') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ok"}');
      } else {
        res.writeHead(503);
        res.end();
      }
    });
    http.listen(0, '127.0.0.1', () => {
      const address = http.address();
      const port = address !== null && typeof address === 'object' ? address.port : 0;
      resolve({
        port,
        close: () => new Promise((resolveClose) => http.close(() => resolveClose())),
      });
    });
  });
}

describe('LlamaServer', () => {
  const servers: LlamaServer[] = [];
  const healthServers: HealthServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.stop()));
    await Promise.all(healthServers.splice(0).map((health) => health.close()));
  });

  it('resolves the base URL once /health is ok, is idempotent, stops with SIGTERM', async () => {
    const health = await startHealthServer('ok');
    healthServers.push(health);
    const records: SpawnRecord[] = [];
    const server = new LlamaServer({
      binary: '/fake/llama-server',
      modelPath: '/fake/model.gguf',
      port: health.port,
      healthTimeoutMs: 5_000,
      spawnProcess: fakeSpawner(records),
    });
    servers.push(server);

    await server.start();
    expect(server.baseUrl).toBe(`http://127.0.0.1:${health.port}`);
    expect(server.running).toBe(true);
    expect(records).toHaveLength(1);
    expect(records[0]!.command).toBe('/fake/llama-server');
    expect(records[0]!.args).toContain('-m');
    expect(records[0]!.args).toContain('/fake/model.gguf');
    expect(records[0]!.args).toContain('--host');
    expect(records[0]!.args).toContain('127.0.0.1');

    // A second start while running is a no-op.
    await server.start();
    expect(records).toHaveLength(1);

    await server.stop();
    expect(records[0]!.process.killed).toEqual(['SIGTERM']);
    expect(server.running).toBe(false);

    // A second stop is safe.
    await server.stop();
    expect(records[0]!.process.killed).toEqual(['SIGTERM']);
  });

  it('picks a free port when none is given', async () => {
    const records: SpawnRecord[] = [];
    const server = new LlamaServer({
      binary: '/fake/llama-server',
      modelPath: '/fake/model.gguf',
      healthTimeoutMs: 200,
      spawnProcess: fakeSpawner(records),
    });
    servers.push(server);

    await expect(server.start()).rejects.toThrow('did not become healthy');
    const portIndex = records[0]!.args.indexOf('--port');
    const portArg = records[0]!.args[portIndex + 1]!;
    expect(Number(portArg)).toBeGreaterThan(1024);
    expect(Number(portArg)).toBeLessThan(65536);
  });

  it('rejects when the process exits before becoming healthy', async () => {
    const records: SpawnRecord[] = [];
    const server = new LlamaServer({
      binary: '/fake/llama-server',
      modelPath: '/fake/model.gguf',
      healthTimeoutMs: 5_000,
      spawnProcess: fakeSpawner(records),
    });
    servers.push(server);

    const started = server.start();
    // start() awaits a free port before spawning; wait for the spawn first.
    await vi.waitFor(() => expect(records).toHaveLength(1), { timeout: 2_000 });
    records[0]!.process.emitExit(1, null);
    await expect(started).rejects.toThrow('exited before becoming healthy');
    expect(server.running).toBe(false);
  });

  it('kills the process after the health timeout', async () => {
    const health = await startHealthServer('loading');
    healthServers.push(health);
    const records: SpawnRecord[] = [];
    const server = new LlamaServer({
      binary: '/fake/llama-server',
      modelPath: '/fake/model.gguf',
      port: health.port,
      healthTimeoutMs: 300,
      spawnProcess: fakeSpawner(records),
    });
    servers.push(server);

    await expect(server.start()).rejects.toThrow('did not become healthy');
    expect(records[0]!.process.killed).toEqual(['SIGKILL']);
    expect(server.running).toBe(false);
  });

  it('restart stops the old process and respawns with the new model', async () => {
    const health = await startHealthServer('ok');
    healthServers.push(health);
    const records: SpawnRecord[] = [];
    const server = new LlamaServer({
      binary: '/fake/llama-server',
      modelPath: '/fake/a.gguf',
      port: health.port,
      healthTimeoutMs: 5_000,
      spawnProcess: fakeSpawner(records),
    });
    servers.push(server);

    await server.start();
    const first = records[0]!.process;
    await server.restart('/fake/b.gguf');

    expect(records).toHaveLength(2);
    expect(records[0]!.args).toContain('/fake/a.gguf');
    expect(records[1]!.args).toContain('/fake/b.gguf');
    expect(first.killed).toEqual(['SIGTERM']);
    expect(server.running).toBe(true);
    expect(server.baseUrl).toBe(`http://127.0.0.1:${health.port}`);
  });

  it('forwards process output to onLog and keeps a tail', async () => {
    const health = await startHealthServer('ok');
    healthServers.push(health);
    const records: SpawnRecord[] = [];
    const logs: string[] = [];
    const server = new LlamaServer({
      binary: '/fake/llama-server',
      modelPath: '/fake/model.gguf',
      port: health.port,
      healthTimeoutMs: 5_000,
      onLog: (chunk) => logs.push(chunk),
      spawnProcess: fakeSpawner(records),
    });
    servers.push(server);

    await server.start();
    records[0]!.process.emitOutput('loading model...\n');
    expect(logs).toEqual(['loading model...\n']);
    expect(server.tail()).toContain('loading model...');
  });
});
