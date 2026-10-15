// Localization guard: fails when the nls layer is inconsistent.
//
// Checks:
//   1. Bundle parity — every key in the English bundle exists, is non-empty
//      and uses the same {n} placeholders in every other locale; no keys may
//      exist only in a non-English locale; no duplicate keys per file.
//   2. Hardcoded user-facing strings in UI code — literal JSX text and
//      literal `title` / `placeholder` / `alt` / `aria-label` attributes must
//      go through the nls layer. Escape hatch: a `nls-ignore` comment on the
//      same or previous line; `nls-ignore-file` in the first lines of a file
//      disables the file entirely.
//
// Usage: node .github/scripts/check-nls.ts (wired as `npm run check:nls`)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// The script lives in .github/scripts, two directories below the repo root.
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const localesDir = join(root, 'packages', 'platform', 'src', 'nls', 'locales');
const uiDirs = [
  join(root, 'apps', 'desktop', 'src', 'renderer'),
  join(root, 'packages', 'workbench', 'src'),
  join(root, 'packages', 'features', 'src'),
];

interface Finding {
  file: string;
  line: number;
  message: string;
}

const findings: Finding[] = [];

const report = (file: string, line: number, message: string): void => {
  findings.push({ file, line, message });
};

// ---------------------------------------------------------------------------
// 1. Bundle parity
// ---------------------------------------------------------------------------

const locales = readdirSync(localesDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length));

if (!locales.includes('en')) {
  console.error(`check-nls: no English bundle in ${localesDir}`);
  process.exit(1);
}

const bundles = new Map<string, Record<string, string>>();

for (const locale of locales) {
  const path = join(localesDir, `${locale}.json`);
  const raw = readFileSync(path, 'utf8');
  bundles.set(locale, JSON.parse(raw) as Record<string, string>);

  // Duplicate keys survive JSON.parse silently — detect them in the raw text.
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    const match = /^\s*"([^"]+)"\s*:/.exec(line);
    if (!match) {
      continue;
    }
    const key = match[1] ?? '';
    if (seen.has(key)) {
      report(path, 0, `duplicate key "${key}"`);
    }
    seen.add(key);
  }
}

const en = bundles.get('en') ?? {};
const enKeys = new Set(Object.keys(en));

for (const locale of locales.filter((name) => name !== 'en')) {
  const bundle = bundles.get(locale) ?? {};
  const path = join(localesDir, `${locale}.json`);
  for (const key of enKeys) {
    const english = en[key] ?? '';
    const value = bundle[key];
    if (value === undefined) {
      report(path, 0, `missing translation for "${key}" (English: "${english}")`);
      continue;
    }
    if (value.trim() === '') {
      report(path, 0, `empty translation for "${key}" (English: "${english}")`);
      continue;
    }
    const englishSlots = [...(english.match(/\{\d+\}/g) ?? [])].sort();
    const localeSlots = [...(value.match(/\{\d+\}/g) ?? [])].sort();
    if (englishSlots.join() !== localeSlots.join()) {
      report(
        path,
        0,
        `placeholder mismatch for "${key}": English uses ${englishSlots.join(', ') || 'none'}, ` +
          `"${locale}" uses ${localeSlots.join(', ') || 'none'}`,
      );
    }
  }
  for (const key of Object.keys(bundle)) {
    if (!enKeys.has(key)) {
      report(path, 0, `key "${key}" is not present in the English bundle`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Hardcoded user-facing strings in UI code
// ---------------------------------------------------------------------------

const USER_FACING_ATTRS = ['title', 'placeholder', 'alt', 'aria-label'];
const hasLetters = (text: string): boolean => /\p{L}/u.test(text);

function walk(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(path));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      result.push(path);
    }
  }
  return result;
}

const files = [
  ...new Set(
    uiDirs.flatMap((dir) =>
      walk(dir).filter(
        (file) =>
          !file.endsWith('.d.ts') &&
          !file.includes('.test.') &&
          !file.includes('.spec.') &&
          !file.endsWith(join('src', 'nls.ts')),
      ),
    ),
  ),
];

// A finding is cancelled by `nls-ignore` on the same line or the line before.
const isIgnored = (lines: string[], index: number): boolean =>
  lines[index]?.includes('nls-ignore') === true ||
  lines[index - 1]?.includes('nls-ignore') === true;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  if (lines.slice(0, 20).some((line) => line.includes('nls-ignore-file'))) {
    continue;
  }
  const display = relative(root, file);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';

    // Literal user-facing attributes: title="…", placeholder='…', alt={"…"}.
    // Expressions ({name}, {nls.t(…)}) are not literals and stay unflagged.
    const attributePattern = new RegExp(
      `\\b(${USER_FACING_ATTRS.join('|')})\\s*=\\s*(?:"([^"]+)"|'([^']+)'|\\{["']\\s*([^"']+?)\\s*["']\\})`,
      'g',
    );
    for (const match of line.matchAll(attributePattern)) {
      const value = match[2] ?? match[3] ?? match[4] ?? '';
      if (hasLetters(value) && !isIgnored(lines, index)) {
        report(display, index + 1, `hardcoded ${match[1]}="${value}" — use nls.t('…')`);
      }
    }

    // Same-line JSX text: >text</ where the text has letters and no markup.
    // Requiring the closing `</` keeps generic code like `=> Promise<T>` out.
    const textPattern = />((?:[^<>{}]|\s)*?)<\//g;
    for (const match of line.matchAll(textPattern)) {
      const text = match[1] ?? '';
      if (hasLetters(text) && !isIgnored(lines, index)) {
        report(display, index + 1, `hardcoded JSX text "${text.trim()}" — use nls.t('…')`);
      }
    }
  }
}

// ---------------------------------------------------------------------------

if (findings.length > 0) {
  for (const { file, line, message } of findings) {
    console.error(`${line > 0 ? `${file}:${line}` : file}: ${message}`);
  }
  console.error(`check-nls: ${findings.length} problem(s)`);
  process.exit(1);
}
console.log('check-nls: ok');
