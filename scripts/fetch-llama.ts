// Fetches the pinned llama-server binaries that ship inside the installers
// (the "Dóru AI" local inference engine). One directory per platform/arch:
//   apps/desktop/build/llama/<platform>-<arch>/llama-server[.exe]
// electron-builder copies the matching directory into the app resources via
// the extraResources ${platform}-${arch} macro; the app resolves the binary
// from process.resourcesPath/llama. Downloads are sha256-verified against
// the pinned llama.cpp release (b11960) and cached: an existing, verified
// binary is skipped, so CI runs cost one download per new release.
//
// Usage: node scripts/fetch-llama.ts            (current platform only)
//        node scripts/fetch-llama.ts --all      (every platform)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE = 'b11960';
const BASE_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${RELEASE}`;
// fileURLToPath, not url.pathname: on Windows pathname starts with /D: and
// path.join would assemble a broken D:\D:\... prefix.
const TARGET_ROOT = fileURLToPath(new URL('../apps/desktop/build/llama/', import.meta.url));

interface BinaryEntry {
  platform: NodeJS.Platform;
  arch: 'x64' | 'arm64';
  archive: string;
  sha256: string;
  binaryName: string;
}

const BINARIES: BinaryEntry[] = [
  {
    platform: 'darwin',
    arch: 'arm64',
    archive: 'llama-b11960-bin-macos-arm64.tar.gz',
    sha256: '58e5a5e1d7c2bf66cedd9c29e0323f3e570660a70a1e2156d32eed08f4cc1e3c',
    binaryName: 'llama-server',
  },
  {
    platform: 'darwin',
    arch: 'x64',
    archive: 'llama-b11960-bin-macos-x64.tar.gz',
    sha256: 'd1e6c9ddcaed9a3b1bb8f3d946bdb3481c7b919357a4029dcb747762397f1da5',
    binaryName: 'llama-server',
  },
  {
    platform: 'win32',
    arch: 'x64',
    archive: 'llama-b11960-bin-win-cpu-x64.zip',
    sha256: '73f962f82850d244db47eaacb9d913637027b82399124324298576d58c5f4287',
    binaryName: 'llama-server.exe',
  },
  {
    platform: 'win32',
    arch: 'arm64',
    archive: 'llama-b11960-bin-win-cpu-arm64.zip',
    sha256: '77349357c38da235bb0eed37bcc5ecf3efef21bb5dc42c2269589c0e71cfa00f',
    binaryName: 'llama-server.exe',
  },
  {
    platform: 'linux',
    arch: 'x64',
    archive: 'llama-b11960-bin-ubuntu-x64.tar.gz',
    sha256: '31cc3a6bc638ac6c48dc4b1b74888f1eaadf3d14227c1e5f67daf9a49541d97a',
    binaryName: 'llama-server',
  },
  {
    platform: 'linux',
    arch: 'arm64',
    archive: 'llama-b11960-bin-ubuntu-arm64.tar.gz',
    sha256: '0065ecfbffe8a790bb0d28059a3320cdc8f723b7f3f248cdc8bfc04790927715',
    binaryName: 'llama-server',
  },
];

function targetDir(entry: BinaryEntry): string {
  return join(TARGET_ROOT, `${entry.platform}-${entry.arch}`);
}

async function fetchEntry(entry: BinaryEntry): Promise<void> {
  const dir = targetDir(entry);
  const binaryPath = join(dir, entry.binaryName);
  // Cache: a previously extracted binary counts as verified when the pinned
  // archive digest is recorded next to it (the archive's contents ship).
  const marker = `${binaryPath}.sha256`;
  if (existsSync(binaryPath) && existsSync(marker) && readFileSync(marker, 'utf8').trim() === entry.sha256) {
    console.log(`cached: ${entry.platform}-${entry.arch}`);
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const archivePath = join(dir, entry.archive);
  console.log(`fetching: ${entry.archive}`);
  const response = await fetch(`${BASE_URL}/${entry.archive}`, {
    headers: { 'user-agent': 'doru-fetch-llama' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${entry.archive}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.sha256) {
    throw new Error(`sha256 mismatch for ${entry.archive}: got ${digest}, expected ${entry.sha256}`);
  }
  writeFileSync(archivePath, bytes);
  execFileSync('tar', ['-xf', archivePath, '-C', dir], { stdio: 'inherit' });
  rmSync(archivePath);
  // Flatten a wrapping top-level folder when the archive has one (the
  // tar.gz layouts do; the Windows zips put the files at the archive root).
  const topLevel = readdirSync(dir, { withFileTypes: true }).find((child) => child.isDirectory());
  if (topLevel !== undefined) {
    for (const child of readdirSync(join(dir, topLevel.name), { withFileTypes: true })) {
      renameSync(join(dir, topLevel.name, child.name), join(dir, child.name));
    }
    rmSync(join(dir, topLevel.name), { recursive: true, force: true });
  }
  if (!existsSync(binaryPath)) {
    throw new Error(`llama-server binary not found in ${entry.archive}`);
  }
  if (entry.platform !== 'win32') {
    chmodSync(binaryPath, 0o755);
  }
  writeFileSync(marker, entry.sha256);
  console.log(`installed: ${entry.platform}-${entry.arch}/${entry.binaryName}`);
}

const all = process.argv.includes('--all');
const entries = BINARIES.filter(
  (entry) => all || entry.platform === process.platform,
);
if (entries.length === 0) {
  throw new Error(`no binaries for platform ${process.platform}`);
}
for (const entry of entries) {
  await fetchEntry(entry);
}
console.log('done');
