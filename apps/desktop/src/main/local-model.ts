// The Dóru AI model manager: download, verify, install and delete the
// offline model, and broadcast its state to every window. The download
// itself lives in @doru/ai (Electron-free); this module owns the paths,
// the lifecycle and the IPC-facing state.
import { app, BrowserWindow } from 'electron';
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

let abort: AbortController | undefined;
let state: DoruModelState = {
  installed: false,
  downloading: false,
  totalBytes: DORU_AI_MODEL.sizeBytes,
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
    state = { ...state, installed: info.size === DORU_AI_MODEL.sizeBytes };
  } catch {
    state = { ...state, installed: false };
  }
}

/** The authoritative state; the renderer also receives pushed updates. */
export async function doruModelState(): Promise<DoruModelState> {
  await refreshInstalled();
  return state;
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
      url: doruAiDownloadUrl(DORU_AI_MODEL),
      destination: doruModelFilePath(),
      expectedSize: DORU_AI_MODEL.sizeBytes,
      expectedSha256: DORU_AI_MODEL.sha256,
      signal: abort.signal,
      onProgress,
    });
    const done: DoruModelState = { ...state, downloading: false, installed: true };
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
