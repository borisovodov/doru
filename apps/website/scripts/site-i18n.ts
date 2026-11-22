import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const websiteRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const TRANSLATED_LOCALES = [
  'bg',
  'cs',
  'de',
  'el',
  'es',
  'fr',
  'hu',
  'it',
  'ja',
  'ko',
  'pl',
  'pt-br',
  'ru',
  'tr',
  'zh-cn',
  'zh-tw',
] as const;

const docPages = readdirSync(join(websiteRoot, 'docs'))
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => `docs/${name}`);

/** Pages that have a translated counterpart, relative to the website root. */
export const SOURCE_PAGES = ['index.md', ...docPages] as const;

export type SourcePage = (typeof SOURCE_PAGES)[number];

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)/;

export function isDocPage(page: string): boolean {
  return page.startsWith('docs/');
}

export function sourceFile(page: string): string {
  return join(websiteRoot, page);
}

export function targetFile(locale: string, page: string): string {
  return join(websiteRoot, locale, page);
}

/** SHA-256 of the English source, normalized to LF and one trailing newline. */
export function contentHash(file: string): string {
  const text = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);
}

export function readSourceHash(text: string): string | undefined {
  const frontmatter = text.match(FRONTMATTER_RE);
  if (!frontmatter) return undefined;
  return frontmatter[1]?.match(/^source-hash:\s*(\S+)\s*$/m)?.[1];
}

/** Adds or replaces `source-hash` in the leading frontmatter block. */
export function withSourceHash(text: string, hash: string): string {
  const line = `source-hash: ${hash}`;
  const frontmatter = text.match(FRONTMATTER_RE);

  if (!frontmatter) {
    return `---\n${line}\n---\n\n${text}`;
  }

  const body = frontmatter[1] ?? '';
  const nextBody = /^source-hash:\s*\S+\s*$/m.test(body)
    ? body.replace(/^source-hash:\s*\S+\s*$/m, line)
    : `${line}\n${body}`;
  return `---\n${nextBody}\n---\n${text.slice(frontmatter[0].length)}`;
}

export function hasH1(text: string): boolean {
  const body = text.replace(FRONTMATTER_RE, '').trimStart();
  return /^#\s+\S/m.test(body);
}

function bodyLines(text: string): string[] {
  return text.replace(FRONTMATTER_RE, '').split('\n');
}

export function headingLevels(text: string): number[] {
  const levels: number[] = [];
  let fenced = false;
  for (const line of bodyLines(text)) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = line.match(/^(#{1,6})\s+\S/);
    if (match?.[1]) levels.push(match[1].length);
  }
  return levels;
}

export function codeFenceCount(text: string): number {
  return bodyLines(text).filter((line) => /^\s*```/.test(line)).length;
}

export function relativeLinkTargets(text: string): string[] {
  const targets: string[] = [];
  let fenced = false;
  for (const line of bodyLines(text)) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (target === undefined || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
      targets.push(target.split('#')[0] ?? target);
    }
  }
  return targets.sort();
}
