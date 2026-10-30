// The Dóru AI inference sidecar: a singleton LlamaServer that the chat starts
// lazily and the app stops on quit. The llama-server binary ships in the app
// resources (packaging bundles it via extraResources); in dev the
// DORU_LLAMA_BINARY env var points at a downloaded build.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LlamaServer } from '@doru/ai';
import { doruModelFilePath } from './local-model';
import { log } from './log';

let server: LlamaServer | undefined;
let starting: Promise<LlamaServer> | undefined;

export function resolveLlamaBinary(): string {
  const override = process.env['DORU_LLAMA_BINARY'];
  if (override !== undefined && override !== '') {
    return override;
  }
  const name = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  return join(process.resourcesPath, 'llama', name);
}

/**
 * Returns the running singleton, starting it when needed. Concurrent callers
 * share one start; a failed start is retried on the next call.
 */
export function ensureDoruServer(): Promise<LlamaServer> {
  if (server !== undefined && server.running) {
    return Promise.resolve(server);
  }
  starting ??= (async () => {
    const binary = resolveLlamaBinary();
    if (!existsSync(binary)) {
      throw new Error(`llama-server binary not found at ${binary}`);
    }
    const instance = new LlamaServer({
      binary,
      modelPath: doruModelFilePath(),
      onLog: (chunk) => log.debug(`doru-llama: ${chunk.trimEnd()}`),
    });
    await instance.start();
    server = instance;
    return instance;
  })().finally(() => {
    starting = undefined;
  });
  return starting;
}

export async function stopDoruServer(): Promise<void> {
  const instance = server;
  server = undefined;
  await instance?.stop();
}
