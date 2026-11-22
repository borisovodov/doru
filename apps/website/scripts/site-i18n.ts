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

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

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
  const frontmatter = normalizeNewlines(text).match(FRONTMATTER_RE);
  if (!frontmatter) return undefined;
  return frontmatter[1]?.match(/^source-hash:\s*(\S+)\s*$/m)?.[1];
}

/** Adds or replaces `source-hash` in the leading frontmatter block. */
export function withSourceHash(text: string, hash: string): string {
  text = normalizeNewlines(text);
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
  let found = false;
  forEachLineOutsideFences(text, (line) => {
    if (/^#\s+\S/.test(line)) found = true;
  });
  return found;
}

function bodyLines(text: string): string[] {
  return normalizeNewlines(text).replace(FRONTMATTER_RE, '').split('\n');
}

interface FenceMarker {
  marker: string;
  length: number;
}

function fenceMarker(line: string): FenceMarker | undefined {
  const match = line.match(/^\s*(`{3,}|~{3,})/);
  const marker = match?.[1];
  if (marker === undefined) return undefined;
  return { marker: marker.charAt(0), length: marker.length };
}

function forEachLineOutsideFences(text: string, callback: (line: string) => void): void {
  let fence: FenceMarker | undefined;
  for (const line of bodyLines(text)) {
    const marker = fenceMarker(line);
    if (marker !== undefined) {
      if (fence === undefined) {
        fence = marker;
      } else if (marker.marker === fence.marker && marker.length >= fence.length) {
        fence = undefined;
      }
      continue;
    }
    if (fence === undefined) callback(line);
  }
}

export function headingLevels(text: string): number[] {
  const levels: number[] = [];
  forEachLineOutsideFences(text, (line) => {
    const match = line.match(/^(#{1,6})\s+\S/);
    if (match?.[1]) levels.push(match[1].length);
  });
  return levels;
}

export function codeFenceCount(text: string): number {
  let count = 0;
  let fence: FenceMarker | undefined;
  for (const line of bodyLines(text)) {
    const marker = fenceMarker(line);
    if (marker === undefined) continue;
    if (fence === undefined) {
      fence = marker;
      count += 1;
    } else if (marker.marker === fence.marker && marker.length >= fence.length) {
      fence = undefined;
      count += 1;
    }
  }
  return count;
}

export function listItemCount(text: string): number {
  let count = 0;
  forEachLineOutsideFences(text, (line) => {
    if (/^\s*(?:[-*+]|\d+[.)])\s+\S/.test(line)) count += 1;
  });
  return count;
}

export function tableRowCount(text: string): number {
  let count = 0;
  forEachLineOutsideFences(text, (line) => {
    if (/^\s*\|.*\|\s*$/.test(line)) count += 1;
  });
  return count;
}

export interface CodeBlock {
  info: string;
  body: string;
}

/** Fenced code blocks, excluding the fence lines themselves. */
export function codeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  let fence: FenceMarker | undefined;
  let info = '';
  let lines: string[] = [];
  for (const line of bodyLines(text)) {
    const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (match) {
      const marker = match[1];
      if (marker === undefined) continue;
      const current = { marker: marker.charAt(0), length: marker.length };
      if (fence === undefined) {
        fence = current;
        info = (match[2] ?? '').trim();
        lines = [];
      } else if (current.marker === fence.marker && current.length >= fence.length) {
        blocks.push({ info, body: lines.join('\n') });
        fence = undefined;
        info = '';
        lines = [];
      } else {
        lines.push(line);
      }
      continue;
    }
    if (fence !== undefined) lines.push(line);
  }
  return blocks;
}

export interface RelativeLink {
  target: string;
  fragment?: string;
}

export function relativeLinks(text: string): RelativeLink[] {
  const links: RelativeLink[] = [];
  forEachLineOutsideFences(text, (line) => {
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (target === undefined || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
      const hash = target.indexOf('#');
      links.push(hash === -1 ? { target } : { target: target.slice(0, hash), fragment: target.slice(hash + 1) });
    }
  });
  return links.sort((a, b) => `${a.target}#${a.fragment ?? ''}`.localeCompare(`${b.target}#${b.fragment ?? ''}`));
}

export function relativeLinkTargets(text: string): string[] {
  return [...new Set(relativeLinks(text).map((link) => link.target))].sort();
}

const SLUG_SPECIAL = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
const SLUG_COMBINING = /[\u0300-\u036F]/g;
// eslint-disable-next-line no-control-regex -- mirrors VitePress's heading slugifier
const SLUG_CONTROL = /[\u0000-\u001f]/g;

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(SLUG_COMBINING, '')
    .replace(SLUG_CONTROL, '')
    .replace(SLUG_SPECIAL, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase();
}

function headingText(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\{#[^}\s]+\}/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/** Explicit `{#id}` anchors and generated heading slugs on a page. */
export function headingAnchors(text: string): Set<string> {
  const anchors = new Set<string>();
  forEachLineOutsideFences(text, (line) => {
    const heading = line.match(/^(#{1,6})\s+\S/);
    if (!heading) return;
    for (const match of line.matchAll(/\{#([^}\s]+)\}/g)) {
      const id = match[1];
      if (id !== undefined) anchors.add(id);
    }
    anchors.add(slugify(headingText(line)));
  });
  return anchors;
}
