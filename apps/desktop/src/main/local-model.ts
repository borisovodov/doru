// The Dóru AI model manager: download, verify, install and delete the
// offline model, and broadcast its state to every window. The download
// itself lives in @doru/ai (Electron-free); this module owns the paths,
// the lifecycle and the IPC-facing state.
import { app, BrowserWindow } from 'electron';
import { statSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { join } from 'node:path';
import {
  DORU_AI_MODEL,
  ModelDownloadError,
  doruAiDownloadUrl,
  downloadModel,
  type DoruModelError,
  type DoruModelState,
} from '@doru/ai';
import { log } from './log';

/**
 * Test/mirror hooks: the e2e suite points the download at a local server
 * with a small payload (DORU_AI_DOWNLOAD_URL / DORU_AI_MODEL_SHA256 /
 * DORU_AI_MODEL_SIZE_BYTES). Production uses the manifest unchanged — the
 * download is always verified against the pinned size and SHA-256.
 */
const modelEntry = {
  url:
    process.env['DORU_AI_DOWNLOAD_URL'] !== undefined && process.env['DORU_AI_DOWNLOAD_URL'] !== ''
      ? process.env['DORU_AI_DOWNLOAD_URL']
      : doruAiDownloadUrl(DORU_AI_MODEL),
  sizeBytes: (() => {
    const override = Number(process.env['DORU_AI_MODEL_SIZE_BYTES'] ?? '');
    return Number.isFinite(override) && override > 0 ? override : DORU_AI_MODEL.sizeBytes;
  })(),
  sha256: process.env['DORU_AI_MODEL_SHA256'] ?? DORU_AI_MODEL.sha256,
};

let abort: AbortController | undefined;
let state: DoruModelState = {
  installed: false,
  downloading: false,
  outdated: false,
  totalBytes: modelEntry.sizeBytes,
  ramGb: Math.round(totalmem() / 1024 ** 3),
  minRamGb: DORU_AI_MODEL.minRamGb,
  license: DORU_AI_MODEL.license,
  licenseUrl: DORU_AI_MODEL.licenseUrl,
};

function modelDir(): string {
  return join(app.getPath('userData'), 'models');
}

export function doruModelFilePath(): string {
  return join(modelDir(), DORU_AI_MODEL.file);
}

function broadcast(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('settings:ai:doruModel:changed', state);
  }
}

async function refreshInstalled(): Promise<void> {
  try {
    const info = await stat(doruModelFilePath());
    const matches = info.size === modelEntry.sizeBytes;
    state = { ...state, installed: matches, outdated: !matches };
  } catch {
    state = { ...state, installed: false, outdated: false };
  }
}

/** The authoritative state; the renderer also receives pushed updates. */
export async function doruModelState(): Promise<DoruModelState> {
  await refreshInstalled();
  return state;
}

/**
 * Synchronous installed check for settings resolution and the chat guard —
 * a local stat against a file we wrote ourselves is cheap enough to call on
 * the settings hot path.
 */
export function doruModelInstalled(): boolean {
  try {
    return statSync(doruModelFilePath()).size === modelEntry.sizeBytes;
  } catch {
    return false;
  }
}

/** Progress broadcast throttled to at most one event per 250 ms. */
let lastProgress = 0;

function onProgress(bytes: number, totalBytes: number): void {
  state = { ...state, bytes, totalBytes };
  const now = Date.now();
  if (now - lastProgress >= 250) {
    lastProgress = now;
    broadcast();
  }
}

export async function downloadDoruModel(): Promise<DoruModelState> {
  if (state.downloading) {
    return state;
  }
  await refreshInstalled();
  if (state.installed) {
    return state;
  }
  abort = new AbortController();
  const starting: DoruModelState = { ...state, downloading: true, bytes: 0 };
  delete starting.error;
  state = starting;
  lastProgress = 0;
  broadcast();
  try {
    await mkdir(modelDir(), { recursive: true });
    await downloadModel({
      url: modelEntry.url,
      destination: doruModelFilePath(),
      expectedSize: modelEntry.sizeBytes,
      expectedSha256: modelEntry.sha256,
      signal: abort.signal,
      onProgress,
    });
    const done: DoruModelState = { ...state, downloading: false, installed: true, outdated: false };
    delete done.bytes;
    delete done.error;
    state = done;
  } catch (error) {
    log.warn('doru model download failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    const code: DoruModelError = error instanceof ModelDownloadError ? error.code : 'network';
    state = { ...state, downloading: false, error: code };
  } finally {
    abort = undefined;
  }
  broadcast();
  return state;
}

export function cancelDoruModelDownload(): void {
  abort?.abort();
}

export async function deleteDoruModel(): Promise<DoruModelState> {
  abort?.abort();
  await rm(doruModelFilePath(), { force: true });
  await rm(`${doruModelFilePath()}.part`, { force: true });
  await refreshInstalled();
  broadcast();
  return state;
}
