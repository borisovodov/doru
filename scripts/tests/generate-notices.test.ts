import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collectNotices,
  findLicenseFile,
  findWorkspaces,
  licenseFileHint,
  normalizeLicense,
  normalizeUrl,
  renderNotices,
  repositoryUrl,
} from '../generate-notices.ts';

describe('normalizeLicense', () => {
  it('reads plain string licenses', () => {
    expect(normalizeLicense('MIT')).toBe('MIT');
    expect(normalizeLicense('  Apache-2.0  ')).toBe('Apache-2.0');
    expect(normalizeLicense('')).toBeUndefined();
    expect(normalizeLicense(undefined)).toBeUndefined();
  });

  it('reads object and array forms', () => {
    expect(normalizeLicense({ type: 'MIT', url: 'https://opensource.org/licenses/MIT' })).toBe('MIT');
    expect(normalizeLicense(['MIT', 'Apache-2.0'])).toBe('MIT, Apache-2.0');
    expect(normalizeLicense({ type: '' })).toBeUndefined();
  });
});

describe('licenseFileHint / findLicenseFile', () => {
  it('extracts the hinted file name', () => {
    expect(licenseFileHint('SEE LICENSE IN LICENCE.md')).toBe('LICENCE.md');
    expect(licenseFileHint('MIT')).toBeUndefined();
    expect(licenseFileHint(undefined)).toBeUndefined();
  });

  it('prefers the hinted file over the default candidates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'doru-notices-hint-'));
    try {
      writeFileSync(join(dir, 'LICENSE'), 'default');
      writeFileSync(join(dir, 'SPECIAL.txt'), 'hinted');
      expect(findLicenseFile(dir, 'SEE LICENSE IN SPECIAL.txt')).toBe(join(dir, 'SPECIAL.txt'));
      expect(findLicenseFile(dir, undefined)).toBe(join(dir, 'LICENSE'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to candidates when the hinted file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'doru-notices-fallback-'));
    try {
      writeFileSync(join(dir, 'COPYING'), 'copying');
      expect(findLicenseFile(dir, 'SEE LICENSE IN MISSING.txt')).toBe(join(dir, 'COPYING'));
      rmSync(join(dir, 'COPYING'));
      expect(findLicenseFile(dir, undefined)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('normalizeUrl / repositoryUrl', () => {
  it('normalizes git and shorthand URL forms', () => {
    expect(normalizeUrl('https://github.com/x/y')).toBe('https://github.com/x/y');
    expect(normalizeUrl('git+https://github.com/x/y.git')).toBe('https://github.com/x/y');
    expect(normalizeUrl('git://github.com/x/y.git')).toBe('https://github.com/x/y');
    expect(normalizeUrl('git+ssh://git@github.com/x/y.git')).toBe('https://github.com/x/y');
    expect(normalizeUrl('ssh://git@github.com/x/y.git')).toBe('https://github.com/x/y');
    expect(normalizeUrl('github:owner/repo')).toBe('https://github.com/owner/repo');
    expect(normalizeUrl('owner/repo')).toBe('https://github.com/owner/repo');
    expect(normalizeUrl('http://example.com/x')).toBe('http://example.com/x');
  });

  it('rejects non-http values', () => {
    expect(normalizeUrl('data:text/html,hi')).toBeUndefined();
    expect(normalizeUrl('file:///etc/passwd')).toBeUndefined();
    expect(normalizeUrl(42)).toBeUndefined();
    expect(normalizeUrl('')).toBeUndefined();
  });

  it('reads repository objects and strings', () => {
    expect(repositoryUrl({ type: 'git', url: 'git+https://github.com/x/y.git' })).toBe(
      'https://github.com/x/y',
    );
    expect(repositoryUrl('https://github.com/x/y')).toBe('https://github.com/x/y');
    expect(repositoryUrl(['not', 'a', 'repo'])).toBeUndefined();
  });
});

describe('collectNotices with a fixture checkout', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'doru-notices-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ workspaces: ['apps/*', 'packages/*'] }),
    );
    mkdirSync(join(root, 'apps', 'a'), { recursive: true });
    mkdirSync(join(root, 'packages', 'b'), { recursive: true });
    writeFileSync(
      join(root, 'apps', 'a', 'package.json'),
      JSON.stringify({ dependencies: { 'dep-a': '1.0.0', electron: '44.7.2' } }),
    );
    writeFileSync(
      join(root, 'packages', 'b', 'package.json'),
      JSON.stringify({ dependencies: { '@scope/dep-b': '2.0.0', '@doru/core': '*' } }),
    );
    // node_modules fixtures
    mkdirSync(join(root, 'node_modules', 'dep-a'), { recursive: true });
    writeFileSync(
      join(root, 'node_modules', 'dep-a', 'package.json'),
      JSON.stringify({
        name: 'dep-a',
        version: '1.2.3',
        license: 'MIT',
        repository: { type: 'git', url: 'git+https://github.com/x/dep-a.git' },
      }),
    );
    writeFileSync(join(root, 'node_modules', 'dep-a', 'LICENSE'), 'dep-a MIT text');
    mkdirSync(join(root, 'node_modules', '@scope', 'dep-b'), { recursive: true });
    writeFileSync(
      join(root, 'node_modules', '@scope', 'dep-b', 'package.json'),
      JSON.stringify({
        name: '@scope/dep-b',
        version: '2.0.0',
        license: 'SEE LICENSE IN LICENCE.md',
        homepage: 'owner/repo-b',
      }),
    );
    writeFileSync(join(root, 'node_modules', '@scope', 'dep-b', 'LICENCE.md'), 'dep-b custom text');
    mkdirSync(join(root, 'node_modules', 'electron'), { recursive: true });
    writeFileSync(
      join(root, 'node_modules', 'electron', 'package.json'),
      JSON.stringify({ name: 'electron', version: '44.7.2', license: 'MIT' }),
    );
    writeFileSync(join(root, 'node_modules', 'electron', 'LICENSE'), 'electron MIT text');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('expands the workspace globs', () => {
    const workspaces = findWorkspaces(root);
    expect(workspaces).toContain(join(root, 'apps', 'a'));
    expect(workspaces).toContain(join(root, 'packages', 'b'));
  });

  it('collects runtime deps and the static Electron entry, skipping @doru packages and deps covered by a static entry', () => {
    const notices = collectNotices(root);
    const names = notices.map((entry) => entry.name);
    expect(names).toEqual(['@scope/dep-b', 'Electron', 'dep-a']); // sorted, no @doru/core, no duplicate electron
    const electron = notices.find((entry) => entry.name === 'Electron');
    expect(electron).toMatchObject({
      license: 'MIT',
      text: 'electron MIT text',
    });
    const depA = notices.find((entry) => entry.name === 'dep-a');
    expect(depA).toMatchObject({
      url: 'https://github.com/x/dep-a',
      text: 'dep-a MIT text',
    });
    const depB = notices.find((entry) => entry.name === '@scope/dep-b');
    expect(depB).toMatchObject({
      url: 'https://github.com/owner/repo-b',
      text: 'dep-b custom text',
    });
  });
});

describe('renderNotices', () => {
  it('emits a committed-style module with the notices payload', () => {
    const rendered = renderNotices([
      { name: 'dep-a', license: 'MIT', text: 'mit text' },
    ]);
    expect(rendered).toContain('// nls-ignore-file');
    expect(rendered).toContain("import type { ThirdPartyNotice } from './types';");
    expect(rendered).toContain('"name": "dep-a"');
    expect(rendered).toContain('"text": "mit text"');
    expect(rendered).not.toContain('"url"');
    expect(rendered).not.toContain('"notice"');
    expect(rendered).not.toContain('"detail"');
    expect(rendered.endsWith('\n')).toBe(true);
  });
});
