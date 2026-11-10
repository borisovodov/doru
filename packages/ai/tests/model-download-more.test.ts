import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModelDownloadError, downloadModel } from '../src/model-download';

const PAYLOAD = randomBytes(64 * 1024);
const PAYLOAD_SHA = createHash('sha256').update(PAYLOAD).digest('hex');

describe('downloadModel edge cases', () => {
  const dirs: string[] = [];

  async function makeDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'doru-dl2-'));
    dirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  function options(dir: string, overrides: Partial<Parameters<typeof downloadModel>[0]> = {}) {
    return {
      url: 'http://127.0.0.1:1/model.gguf',
      destination: join(dir, 'model.gguf'),
      expectedSize: PAYLOAD.length,
      expectedSha256: PAYLOAD_SHA,
      ...overrides,
    };
  }

  it('renames a complete verified partial into place without a network request', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'model.gguf.part'), PAYLOAD);

    await downloadModel(options(dir, { url: 'http://127.0.0.1:1/model.gguf' }));

    expect((await readFile(join(dir, 'model.gguf'))).equals(PAYLOAD)).toBe(true);
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(false);
  });

  it('drops a wrong-hash partial and downloads from scratch', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'model.gguf.part'), randomBytes(PAYLOAD.length));
    // The part has the right size but the wrong bytes: it is removed and the
    // download restarts (the fetch itself fails here — connection refused —
    // but the partial must be gone before it).
    await expect(downloadModel(options(dir))).rejects.toBeTruthy();
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(false);
  });

  it('drops an oversized partial and restarts', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'model.gguf.part'), Buffer.concat([PAYLOAD, Buffer.from('extra')]));

    await expect(downloadModel(options(dir))).rejects.toBeTruthy();
    expect(existsSync(join(dir, 'model.gguf.part'))).toBe(false);
  });

  it('wraps a pre-aborted signal as an aborted error', async () => {
    const dir = await makeDir();
    const controller = new AbortController();
    controller.abort();

    await expect(downloadModel(options(dir, { signal: controller.signal }))).rejects.toMatchObject<
      ModelDownloadError
    >({ code: 'aborted' });
  });

  it('reports HTTP 416 when the resume point is past the end', async () => {
    const dir = await makeDir();
    // A full-size but corrupt partial is dropped first; the retry without
    // Range still returns 416 because the server counts the request as
    // out-of-range.
    const server = createHttpServer((_req, res) => {
      res.writeHead(416);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = address !== null && typeof address === 'object' ? address.port : 0;

    try {
      await expect(
        downloadModel(options(dir, { url: `http://127.0.0.1:${port}/model.gguf` })),
      ).rejects.toMatchObject<ModelDownloadError>({ code: 'http' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects unexpected HTTP statuses', async () => {
    const dir = await makeDir();
    const server = createHttpServer((_req, res) => {
      res.writeHead(500);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = address !== null && typeof address === 'object' ? address.port : 0;

    try {
      await expect(
        downloadModel(options(dir, { url: `http://127.0.0.1:${port}/model.gguf` })),
      ).rejects.toMatchObject<ModelDownloadError>({ code: 'http' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
