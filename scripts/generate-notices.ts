// Collects the third-party licenses that ship inside the app into
// packages/features/src/notices/generated.ts. The list covers the runtime
// dependencies of every workspace package plus a few hand-curated entries
// that are not runtime deps (the Electron runtime, the bundled fonts).
// CI (check:notices) fails when the committed file drifts from the generated
// output, so run this after changing dependencies:
//
//   node scripts/generate-notices.ts
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThirdPartyNotice } from '../packages/features/src/notices/types.ts';

const LICENSE_CANDIDATES = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENCE',
  'LICENCE.md',
  'LICENCE.txt',
  'COPYING',
  'COPYING.md',
  'COPYING.txt',
  'UNLICENSE',
] as const;

/** The package.json fields this script reads; everything is optional. */
interface Manifest {
  name?: string;
  version?: string;
  license?: unknown;
  repository?: unknown;
  homepage?: unknown;
  workspaces?: unknown;
  dependencies?: Record<string, string>;
}

/** A hand-curated entry that is not a runtime dep of any workspace package. */
interface StaticEntry {
  /** The package path inside node_modules (scope included). */
  package: string;
  /** Display name. */
  name: string;
  url: string;
}

const STATIC_ENTRIES: StaticEntry[] = [
  {
    package: 'electron',
    name: 'Electron',
    url: 'https://www.electronjs.org/',
  },
  {
    package: '@fontsource-variable/inter',
    name: 'Inter',
    url: 'https://rsms.me/inter/',
  },
  {
    package: '@fontsource/berkshire-swash',
    name: 'Berkshire Swash',
    url: 'https://www.astigmatic.com/',
  },
];

export function readManifest(dir: string): Manifest {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
  } catch {
    return {};
  }
}

/** Normalizes the package.json `license` field (string, object or array). */
export function normalizeLicense(license: unknown): string | undefined {
  if (typeof license === 'string') {
    const value = license.trim();
    return value === '' ? undefined : value;
  }
  if (Array.isArray(license)) {
    const values = license
      .map((entry) => normalizeLicense(entry))
      .filter((entry): entry is string => entry !== undefined);
    return values.length > 0 ? values.join(', ') : undefined;
  }
  if (license !== null && typeof license === 'object') {
    const value = (license as { type?: unknown }).type;
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

/** Extracts the file name from a "SEE LICENSE IN <file>" license value. */
export function licenseFileHint(license: string | undefined): string | undefined {
  if (license === undefined) {
    return undefined;
  }
  const match = /^SEE LICENSE IN (.+)$/i.exec(license.trim());
  return match?.[1]?.trim();
}

/** Finds the license text file of a package, preferring the hinted name.
 *
 * Matching is case-insensitive on purpose: some packages ship the file as
 * lowercase `license`, and on case-sensitive filesystems (Linux) a plain
 * `existsSync` miss would make the generated data drift between platforms.
 */
export function findLicenseFile(dir: string, license: string | undefined): string | undefined {
  const hinted = licenseFileHint(license);
  if (hinted !== undefined) {
    const path = join(dir, hinted);
    if (existsSync(path)) {
      return path;
    }
  }
  let listing: string[] = [];
  try {
    listing = readdirSync(dir);
  } catch {
    return undefined;
  }
  // Plain-name hints also match case-insensitively, like the candidates.
  if (hinted !== undefined && !hinted.includes('/') && !hinted.includes('\\')) {
    const match = listing.find((entry) => entry.toLowerCase() === hinted.toLowerCase());
    if (match !== undefined) {
      return join(dir, match);
    }
  }
  for (const name of LICENSE_CANDIDATES) {
    const match = listing.find((entry) => entry.toLowerCase() === name.toLowerCase());
    if (match !== undefined) {
      return join(dir, match);
    }
  }
  return undefined;
}

/** Normalizes repository/homepage URLs to plain http(s) links. */
export function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  let url = value.trim();
  if (url === '') {
    return undefined;
  }
  // Shorthand forms some homepage fields use ("owner/repo", "github:owner/repo").
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) {
    url = `https://github.com/${url}`;
  } else if (url.startsWith('github:')) {
    url = `https://github.com/${url.slice('github:'.length)}`;
  }
  url = url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git\+ssh:\/\/git@/, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '')
    .replace(/#.*$/, '');
  return url.startsWith('https://') || url.startsWith('http://') ? url : undefined;
}

export function repositoryUrl(repository: unknown): string | undefined {
  if (repository !== null && typeof repository === 'object' && !Array.isArray(repository)) {
    const url = (repository as { url?: unknown }).url;
    if (typeof url === 'string') {
      return normalizeUrl(url);
    }
  }
  if (typeof repository === 'string') {
    return normalizeUrl(repository);
  }
  return undefined;
}

/** Expands the `workspaces` globs of the root manifest into package dirs. */
export function findWorkspaces(rootDir: string): string[] {
  const manifest = readManifest(rootDir);
  if (!Array.isArray(manifest.workspaces)) {
    return [];
  }
  const dirs: string[] = [];
  for (const pattern of manifest.workspaces) {
    if (typeof pattern !== 'string') {
      continue;
    }
    const star = pattern.indexOf('*');
    if (star === -1) {
      const dir = join(rootDir, pattern);
      if (existsSync(join(dir, 'package.json'))) {
        dirs.push(dir);
      }
      continue;
    }
    const parent = join(rootDir, pattern.slice(0, star).replace(/\/+$/, ''));
    if (!existsSync(parent)) {
      continue;
    }
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const dir = join(parent, entry.name);
      if (existsSync(join(dir, 'package.json'))) {
        dirs.push(dir);
      }
    }
  }
  return dirs;
}

/**
 * Collects every third-party entry for the checkout at `rootDir`: the static
 * entries plus the runtime dependencies of all workspace packages.
 */
export function collectNotices(rootDir: string): ThirdPartyNotice[] {
  const entries: ThirdPartyNotice[] = [];

  for (const entry of STATIC_ENTRIES) {
    const dir = join(rootDir, 'node_modules', entry.package);
    const manifest = readManifest(dir);
    if (manifest.name === undefined) {
      // Not installed — nothing to attribute.
      continue;
    }
    const license = normalizeLicense(manifest.license);
    const file = findLicenseFile(dir, license);
    entries.push({
      name: entry.name,
      url: entry.url,
      license: license ?? 'Unknown',
      text: file === undefined ? '' : readFileSync(file, 'utf8').trim(),
    });
  }

  const dependencies = new Map<string, string>();
  const statics = new Set(STATIC_ENTRIES.map((entry) => entry.package));
  for (const dir of findWorkspaces(rootDir)) {
    for (const name of Object.keys(readManifest(dir).dependencies ?? {})) {
      if (name.startsWith('@doru/')) {
        continue; // first-party workspace packages
      }
      if (statics.has(name)) {
        continue; // covered by the hand-curated entry above
      }
      if (!dependencies.has(name)) {
        dependencies.set(name, '');
      }
    }
  }

  for (const name of [...dependencies.keys()].sort()) {
    const dir = join(rootDir, 'node_modules', name);
    const manifest = readManifest(dir);
    if (manifest.name === undefined || manifest.version === undefined) {
      // Not installed (e.g. an optional dep npm skipped) — nothing to attribute.
      continue;
    }
    const license = normalizeLicense(manifest.license);
    const file = findLicenseFile(dir, license);
    const url = repositoryUrl(manifest.repository) ?? normalizeUrl(manifest.homepage);
    entries.push({
      name,
      ...(url === undefined ? {} : { url }),
      license: license ?? 'Unknown',
      text: file === undefined ? '' : readFileSync(file, 'utf8').trim(),
    });
  }

  // Byte-order comparison: localeCompare varies with the ICU data on board.
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return entries;
}

/** Renders the committed TypeScript module content. */
export function renderNotices(entries: ThirdPartyNotice[]): string {
  const lines = [
    '// nls-ignore-file',
    '// Generated by scripts/generate-notices.ts — do not edit by hand.',
    '// License texts are reproduced verbatim from each project and are not translated.',
    `import type { ThirdPartyNotice } from './types';`,
    '',
    'export const thirdPartyNotices: ThirdPartyNotice[] = ',
    `${JSON.stringify(entries, null, 2)};`,
    '',
  ];
  return lines.join('\n');
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const output = join(root, 'packages', 'features', 'src', 'notices', 'generated.ts');
  writeFileSync(output, renderNotices(collectNotices(root)));
  console.log(`third-party notices written to ${output}`);
}
