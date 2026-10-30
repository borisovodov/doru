import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModelDownloadError, downloadModel } from '../src/model-download';

/** A 1 MiB payload with a known digest. */
const PAYLOAD = randomBytes(1024 * 1024);
const PAYLOAD_SHA = createHash('sha256').update(PAYLOAD).digest('hex');

interface TestServer {
  baseUrl: string;
  rangeRequests: string[];
  /** Set to true to make the server ignore Range headers (200 fallback). */
  ignoreRange: boolean;
  /** Truncate the served body to this many bytes when set. */
  truncate?: number;
  close: () => Promise<void>;
}

async function startServer(): Promise<TestServer> {
  const state = { rangeRequests: [] as string[], ignoreRange: false, truncate: undefined as number | undefined };
  const server: Server = await new Promise((resolve) => {
    const http = createHttpServer((req, res) => {
      const range = req.headers.range;
      if (range !== undefined) {
        state.rangeRequests.push(range);
      }
      const length = state.truncate ?? PAYLOAD.length;
      if (range !== undefined && !state.ignoreRange) {
        const match = /^bytes=(\d+)-$/.exec(range);
        if (match === null) {
          res.writeHead(400);
          res.end();
          return;
        }
        const start = Number(match[1]);
        if (start >= length) {
          res.writeHead(416);
          res.end();
          return;
        }
        res.writeHead(206, {
          'content-range': `bytes ${start}-${length - 1}/${length}`,
          'content-length': String(length - start),
        });
        res.end(PAYLOAD.subarray(start, length));
        return;
      }
      res.writeHead(200, { 'content-length': String(length) });
      res.end(PAYLOAD.subarray(0, length));
    });
    http.listen(0, '127.0.0.1', () => {
      const address = http.address();
      const port = address !== null && typeof address === 'object' ? address.port : 0;
      resolve(http);
    });
  });
  const address = server.address();
  const port = address !== null && typeof address === 'object' ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}/model.gguf`,
    rangeRequests: state.rangeRequests,
    get ignoreRange() {
      return state.ignoreRange;
    },
    set ignoreRange(value: boolean) {
      state.ignoreRange = value;
    },
    get truncate() {
      return state.truncate;
    },
    set truncate(value: number | undefined) {
      state.truncate = value;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe('downloadModel', () => {
  const dirs: string[] = [];
  const servers: TestServer[] = [];

  async function makeDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'doru-dl-'));
    dirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  function options(dir: string, overrides: Partial<Parameters<typeof downloadModel>[0]> = {}) {
    return {
      url: '',
      destination: join(dir, 'model.gguf'),
      expectedSize: PAYLOAD.length,
      expectedSha256: PAYLOAD_SHA,
      ...overrides,
    };
  }

  it('downloads, verifies and reports progress', async () => {
    const server = await startServer();
    servers.push(server);
    const dir = await makeDir();
    const progress: number[] = [];
    await downloadModel(options(dir, { url: server.baseUrl, onProgress: (done) => progress.push(done) }));

    const file = await readFile(join(dir, 'model.gguf'));
    expect(file.equals(PAYLOAD)).toBe(true);
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(false);
    expect(progress.at(-1)).toBe(PAYLOAD.length);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1]!)).toBe(true);
  });

  it('resumes from an existing partial file with a Range request', async () => {
    const server = await startServer();
    servers.push(server);
    const dir = await makeDir();
    const partial = PAYLOAD.subarray(0, 300_000);
    await writeFile(join(dir, 'model.gguf.part'), partial);

    await downloadModel(options(dir, { url: server.baseUrl }));

    expect(server.rangeRequests).toEqual(['bytes=300000-']);
    expect((await readFile(join(dir, 'model.gguf'))).equals(PAYLOAD)).toBe(true);
  });

  it('restarts from scratch when the server ignores Range', async () => {
    const server = await startServer();
    server.ignoreRange = true;
    servers.push(server);
    const dir = await makeDir();
    await writeFile(join(dir, 'model.gguf.part'), PAYLOAD.subarray(0, 100_000));

    await downloadModel(options(dir, { url: server.baseUrl }));

    expect((await readFile(join(dir, 'model.gguf'))).equals(PAYLOAD)).toBe(true);
  });

  it('rejects on a SHA-256 mismatch and drops the partial', async () => {
    const server = await startServer();
    servers.push(server);
    const dir = await makeDir();

    await expect(
      downloadModel(options(dir, { url: server.baseUrl, expectedSha256: '0'.repeat(64) })),
    ).rejects.toMatchObject<ModelDownloadError>({ code: 'sha256-mismatch' });
    expect(existsSync(join(dir, 'model.gguf'))).toBe(false);
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(false);
  });

  it('rejects on a size mismatch and keeps the partial for resuming', async () => {
    const server = await startServer();
    server.truncate = PAYLOAD.length - 100;
    servers.push(server);
    const dir = await makeDir();

    await expect(downloadModel(options(dir, { url: server.baseUrl }))).rejects.toMatchObject<ModelDownloadError>({
      code: 'size-mismatch',
    });
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(true);
  });

  it('reports cancellation, keeps the partial, and a retry completes', async () => {
    const server = await startServer();
    servers.push(server);
    const dir = await makeDir();
    const controller = new AbortController();
    const first = downloadModel(
      options(dir, {
        url: server.baseUrl,
        onProgress: (done) => {
          if (done >= 200_000) {
            controller.abort();
          }
        },
        signal: controller.signal,
      }),
    );
    await expect(first).rejects.toMatchObject<ModelDownloadError>({ code: 'aborted' });
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(true);

    await downloadModel(options(dir, { url: server.baseUrl }));
    expect((await readFile(join(dir, 'model.gguf'))).equals(PAYLOAD)).toBe(true);
  });

  it('accepts an already complete file without downloading', async () => {
    const server = await startServer();
    servers.push(server);
    const dir = await makeDir();
    await writeFile(join(dir, 'model.gguf'), PAYLOAD);

    await downloadModel(options(dir, { url: server.baseUrl }));

    expect(server.rangeRequests).toHaveLength(0);
    expect((await readFile(join(dir, 'model.gguf'))).equals(PAYLOAD)).toBe(true);
  });
});
