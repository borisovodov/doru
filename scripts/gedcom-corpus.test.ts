// The GEDCOM corpus runner: drives every file of the local corpus
// through `parse` (import) and the same-version serializer (export),
// and reports, per file:
//   - whether import failed and why (error code, message, position)
//   - which tags stayed in the generic pile (ExtensionStructure /
//     ExtensionRecord — tags the parser kept verbatim instead of a
//     typed model field) and in which contexts they occur
//   - whether export failed and why
//
// This file is intentionally outside the vitest `include` patterns, so
// `npm test` and CI never run it (it walks an external corpus of
// thousands of files and takes minutes). Run it explicitly:
//
//   npx vitest run --config scripts/gedcom-corpus.vitest.config.ts
//
// Outputs (in DORU_OUT, default `<repo>/corpus-run/`):
//   results.csv           one row per corpus file
//   results.jsonl         the same rows, appended during the run
//   import-failures.md    the failed imports, grouped by error code
//   export-failures.md    the failed exports, grouped by error code
//   generic-tags.md       the files that still carry generic tags
//   summary.md            aggregates: totals, failure codes, the
//                         generic-tag ranking, failures per source
//
// Overrides: DORU_CORPUS (corpus dir), DORU_OUT (output dir),
// DORU_LIMIT (process only the first N files, for quick runs).

import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { expect, test } from 'vitest';
import { LEGACY_GENERIC_TAGS, parseTolerant, serializeGedcom551, serializeGedcom70, serializeGedzip } from '@doru/gedcom';
import type { GedcomDataset, GedcomError } from '@doru/gedcom';

const CORPUS_DIR =
  process.env['DORU_CORPUS'] ?? '/Users/boris/Library/Mobile Documents/com~apple~CloudDocs/Doru/corpus';
const OUT_DIR = process.env['DORU_OUT'] ?? join(process.cwd(), 'corpus-run');

/** Corpus housekeeping files that are not GEDCOM inputs. */
const SKIP_FILES = new Set(['manifest.jsonl', 'MANUAL-SOURCES.md', 'MANUAL-GEDBAS.md']);

/**
 * The record tags that parse into typed model records; every other
 * tag in `dataset.records` is a generic `ExtensionRecord` (GEDCOM 7.0
 * §1.5 underscore tags plus the closed set of non-underscore legacy
 * vendor tags, see vendor-tags.ts).
 */
const TYPED_RECORD_TAGS = new Set([
  'FAM', 'INDI', 'OBJE', 'REPO', 'SNOTE', 'NOTE', 'SOUR', 'SUBM', 'SUBN',
  '_CENR', '_PLAC', '_TODO', '_EVENT_DEFN', '_ALIA', '_PUBLISH', '_GRP', '_OCUR',
  '_MTTAG', '_MTCAT',
  'Occupation', 'Education', 'Contact', 'Marriage', 'Twin',
  'TITL',
]);

/** Cap on distinct contexts kept per tag in the per-file detail string. */
const MAX_CONTEXTS_PER_FILE = 15;
/** Cap on contexts shown per tag in the summary ranking. */
const MAX_CONTEXTS_IN_SUMMARY = 3;
/** Cap on example files shown per error code in the summaries. */
const MAX_EXAMPLES_PER_CODE = 3;

// ---------------------------------------------------------------------------
// Generic-tag collection
// ---------------------------------------------------------------------------

/** Occurrences of one generic tag, by the chain of enclosing typed tags. */
interface TagStat {
  occurrences: number;
  contexts: Map<string, number>;
}

function bump(stats: Map<string, TagStat>, tag: string, ctx: string): void {
  const stat = stats.get(tag) ?? { occurrences: 0, contexts: new Map() };
  stat.occurrences += 1;
  stat.contexts.set(ctx, (stat.contexts.get(ctx) ?? 0) + 1);
  stats.set(tag, stat);
}

/**
 * Records one `ExtensionStructure` (or `ExtensionRecord`) and recurses
 * into its children. `chain` is the path of enclosing typed tags; a
 * top-level record gets the `(record)` context.
 */
function recordExtension(node: Record<string, unknown>, chain: string[], stats: Map<string, TagStat>, depth: number): void {
  if (depth > 64) {
    return;
  }
  const tag = typeof node['tag'] === 'string' ? (node['tag'] as string) : '?';
  bump(stats, tag, chain.length > 0 ? chain.join('.') : '(record)');
  const children = node['children'];
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child !== null && typeof child === 'object') {
        recordExtension(child as Record<string, unknown>, [...chain, tag], stats, depth + 1);
      }
    }
  }
}

/**
 * Walks the typed model: records the `extensions` arrays (the generic
 * pile attached to any structure) and pushes the `tag` of every typed
 * structure so the contexts name the wire path.
 */
function walk(value: unknown, chain: string[], stats: Map<string, TagStat>, depth: number): void {
  if (depth > 64) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, chain, stats, depth + 1);
    }
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  const node = value as Record<string, unknown>;
  const tag = typeof node['tag'] === 'string' ? (node['tag'] as string) : undefined;
  // The enclosing structure's own tag is part of the context of its
  // extension substructures (BIRT._DATI lives under INDI.BIRT).
  const next = tag === undefined ? chain : [...chain, tag];
  const extensions = node['extensions'];
  if (Array.isArray(extensions)) {
    for (const ext of extensions) {
      if (ext !== null && typeof ext === 'object') {
        recordExtension(ext as Record<string, unknown>, next, stats, depth + 1);
      }
    }
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === 'extensions') {
      continue;
    }
    walk(child, next, stats, depth + 1);
  }
}

function collectGenericTags(dataset: GedcomDataset): Map<string, TagStat> {
  const stats = new Map<string, TagStat>();
  walk(dataset.header, [], stats, 0);
  if (dataset.submission !== undefined) {
    walk(dataset.submission, [], stats, 0);
  }
  for (const record of dataset.records) {
    const tag = typeof record.tag === 'string' ? record.tag : '';
    if (tag !== '' && !TYPED_RECORD_TAGS.has(tag)) {
      recordExtension(record as unknown as Record<string, unknown>, [], stats, 0);
    } else {
      walk(record as unknown as Record<string, unknown>, [], stats, 0);
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Per-file run
// ---------------------------------------------------------------------------

interface CorpusRow {
  relpath: string;
  bytes: number;
  ms: number;
  container: string;
  version: string;
  import: 'ok' | 'partial' | 'fail';
  importCode: string;
  importError: string;
  importPos: string;
  errorCount: number;
  errors: string;
  tags: string;
  tagOccurrences: number;
  tagDetails: string;
  export: 'ok' | 'fail' | 'skipped';
  exportCode: string;
  exportError: string;
}

/** Formats the full error list of one file: `code@line|code@line|…`,
 *  capped at 40 entries (the rest is counted). */
function formatErrors(errors: GedcomError[]): string {
  const MAX = 40;
  const parts = errors.slice(0, MAX).map((error) => {
    const code = String(error.code ?? 'untyped');
    const line = error.position === undefined ? '' : `@${error.position.line}`;
    return `${code}${line}`;
  });
  if (errors.length > MAX) {
    parts.push(`+${errors.length - MAX}`);
  }
  return parts.join('|');
}

function describeError(error: GedcomError): { code: string; message: string; pos: string } {
  const pos = error.position === undefined ? '' : `line ${error.position.line}, col ${error.position.column}`;
  const message = typeof error.message === 'string' && error.message !== '' ? error.message : String(error);
  // The package's run() wrapper returns every thrown value as a
  // GedcomError, so a genuine RangeError (e.g. a stack overflow on a
  // deeply nested input) can arrive without the typed `code` field.
  let code = String(error.code ?? '');
  if (code === '') {
    code = message.includes('call stack') ? 'parse.stack-overflow' : 'runner.thrown';
  }
  return { code, message, pos };
}

function tagSummary(stats: Map<string, TagStat>): { tags: string; occurrences: number; details: string } {
  const entries = [...stats.entries()].sort(
    (a, b) => b[1].occurrences - a[1].occurrences || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  const tags = entries.map(([tag]) => tag).join('; ');
  let occurrences = 0;
  const details: string[] = [];
  for (const [tag, stat] of entries) {
    occurrences += stat.occurrences;
    const contexts = [...stat.contexts.entries()].sort((a, b) => b[1] - a[1]);
    const shown = contexts.slice(0, MAX_CONTEXTS_PER_FILE).map(([ctx, n]) => (n > 1 ? `${ctx}×${n}` : ctx));
    const more = contexts.length > MAX_CONTEXTS_PER_FILE ? `+${contexts.length - MAX_CONTEXTS_PER_FILE}` : '';
    details.push(`${tag}×${stat.occurrences}{${[...shown, more].filter((s) => s !== '').join(',')}}`);
  }
  return { tags, occurrences, details: details.join('; ') };
}

function runFile(relpath: string): { row: CorpusRow; stats: Map<string, TagStat> } {
  const started = performance.now();
  const row: CorpusRow = {
    relpath,
    bytes: 0,
    ms: 0,
    container: '',
    version: '',
    import: 'fail',
    importCode: 'io.read-error',
    importError: '',
    importPos: '',
    errorCount: 0,
    errors: '',
    tags: '',
    tagOccurrences: 0,
    tagDetails: '',
    export: 'skipped',
    exportCode: '',
    exportError: '',
  };
  let stats = new Map<string, TagStat>();
  let bytes: Buffer;
  try {
    bytes = readFileSync(join(CORPUS_DIR, relpath));
  } catch (error) {
    row.importError = error instanceof Error ? error.message : String(error);
    row.ms = performance.now() - started;
    return { row, stats };
  }
  row.bytes = bytes.byteLength;
  const parsed = parseTolerant(bytes);
  const value = parsed.value;
  if (value === undefined) {
    // Even the tolerant parse could not produce a dataset.
    const first = parsed.errors[0];
    const described = first === undefined ? { code: 'runner.thrown', message: 'no dataset', pos: '' } : describeError(first);
    row.importCode = described.code;
    row.importError = described.message;
    row.importPos = described.pos;
    row.errorCount = parsed.errors.length;
    row.errors = formatErrors(parsed.errors);
    row.ms = performance.now() - started;
    return { row, stats };
  }
  row.import = parsed.errors.length === 0 ? 'ok' : 'partial';
  row.importCode = '';
  row.importError = '';
  row.importPos = '';
  row.errorCount = parsed.errors.length;
  row.errors = formatErrors(parsed.errors);
  const dataset: GedcomDataset = value.kind === 'gedzip' ? value.archive.dataset : value.dataset;
  if (value.kind === 'gedzip') {
    row.container = 'gedzip';
    row.version = '7.0';
  } else {
    row.container = 'plain';
    row.version = value.version;
  }
  let collectError = '';
  try {
    stats = collectGenericTags(dataset);
  } catch (error) {
    collectError = error instanceof Error ? error.message : String(error);
  }
  if (collectError !== '') {
    row.tagDetails = `collection failed: ${collectError}`;
  } else {
    const summary = tagSummary(stats);
    row.tags = summary.tags;
    row.tagOccurrences = summary.occurrences;
    row.tagDetails = summary.details;
  }
  try {
    const serialized =
      value.kind === 'gedzip'
        ? serializeGedzip(value.archive)
        : value.version === '7.0'
          ? serializeGedcom70(dataset)
          : serializeGedcom551(dataset);
    if (!serialized.ok) {
      row.export = 'fail';
      const described = describeError(serialized.error);
      row.exportCode = described.code;
      row.exportError = described.message;
    } else {
      row.export = 'ok';
    }
  } catch (error) {
    row.export = 'fail';
    row.exportCode = 'runner.thrown';
    row.exportError = error instanceof Error ? error.message : String(error);
  }
  row.ms = performance.now() - started;
  return { row, stats };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const CSV_HEADER =
  'relpath,bytes,ms,container,version,import,import_code,import_error,import_pos,error_count,errors,generic_tags,generic_occurrences,generic_details,export,export_code,export_error';

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""').replace(/[\r\n]+/g, ' ')}"` : value;
}

function mdCell(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replaceAll('|', '\\|');
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}

/** One generic tag aggregated across the whole corpus. */
interface GlobalTagStat {
  files: number;
  occurrences: number;
  contexts: Map<string, number>;
}

function writeReports(
  rows: CorpusRow[],
  fileStats: Array<{ relpath: string; stats: Map<string, TagStat> }>,
  skipped: number,
): void {
  mkdirSync(OUT_DIR, { recursive: true });

  // The per-file table.
  const lines = [
    CSV_HEADER,
    ...rows.map((r) =>
      [
        r.relpath,
        String(r.bytes),
        r.ms.toFixed(1),
        r.container,
        r.version,
        r.import,
        r.importCode,
        r.importError,
        r.importPos,
        String(r.errorCount),
        r.errors,
        r.tags,
        String(r.tagOccurrences),
        r.tagDetails,
        r.export,
        r.exportCode,
        r.exportError,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ];
  writeFileSync(join(OUT_DIR, 'results.csv'), `${lines.join('\n')}\n`);

  const importFailures = rows.filter((r) => r.import === 'fail');
  const exportFailures = rows.filter((r) => r.export === 'fail');
  const withTags = rows.filter((r) => r.tagOccurrences > 0);

  // Import problems: fatal failures plus the recorded errors of the
  // partial parses, aggregated across ALL errors of every file.
  let md = `# Import problems\n\n${importFailures.length} files failed entirely; ${rows.filter((r) => r.import === 'partial').length} parsed partially.\n\n`;
  const errorCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.import === 'fail') {
      errorCounts.set(r.importCode, (errorCounts.get(r.importCode) ?? 0) + 1);
    }
    for (const entry of r.errors.split('|')) {
      if (entry === '' || entry.startsWith('+')) {
        continue;
      }
      const code = entry.split('@')[0] ?? '';
      if (code !== '') {
        errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
      }
    }
  }
  md += '| code | occurrences |\n|---|---|\n';
  for (const [code, n] of [...errorCounts].sort((a, b) => b[1] - a[1])) {
    md += `| ${mdCell(code)} | ${n} |\n`;
  }
  md += `\n## Files that failed entirely\n\n| file | code | position | message | errors |\n|---|---|---|---|---|\n`;
  for (const item of importFailures.sort((a, b) => a.relpath.localeCompare(b.relpath))) {
    md += `| ${mdCell(item.relpath)} | ${mdCell(item.importCode)} | ${mdCell(item.importPos)} | ${mdCell(item.importError)} | ${mdCell(item.errors)} |\n`;
  }
  writeFileSync(join(OUT_DIR, 'import-failures.md'), md);

  // Export failures, by code.
  md = `# Export failures\n\n${exportFailures.length} of ${rows.length} corpus files failed the same-version export.\n\n`;
  const byExportCode = [...groupBy(exportFailures, (r) => r.exportCode).entries()].sort((a, b) =>
    (a[0] ?? '').localeCompare(b[0] ?? ''),
  );
  md += '| code | file | message |\n|---|---|---|\n';
  for (const [code, items] of byExportCode) {
    items.sort((a, b) => a.relpath.localeCompare(b.relpath));
    for (const item of items) {
      md += `| ${mdCell(code)} | ${mdCell(item.relpath)} | ${mdCell(item.exportError)} |\n`;
    }
  }
  writeFileSync(join(OUT_DIR, 'export-failures.md'), md);

  // Files still carrying generic tags.
  const tagRows = rows
    .filter((r) => r.tagOccurrences > 0)
    .sort((a, b) => b.tagOccurrences - a.tagOccurrences || a.relpath.localeCompare(b.relpath));
  md = `# Generic tags still in the pile\n\nTags the parser kept verbatim as generic extensions\n(ExtensionStructure / ExtensionRecord) instead of typed model\nfields. ${withTags.length} files carry them.\n\n`;
  md += '| file | occurrences | tags |\n|---|---|---|\n';
  for (const item of tagRows) {
    md += `| ${mdCell(item.relpath)} | ${item.tagOccurrences} | ${mdCell(item.tagDetails)} |\n`;
  }
  writeFileSync(join(OUT_DIR, 'generic-tags.md'), md);

  // Summary.
  const global = new Map<string, GlobalTagStat>();
  let totalOccurrences = 0;
  for (const { stats } of fileStats) {
    for (const [tag, stat] of stats) {
      const g = global.get(tag) ?? { files: 0, occurrences: 0, contexts: new Map() };
      g.files += 1;
      g.occurrences += stat.occurrences;
      totalOccurrences += stat.occurrences;
      for (const [ctx, n] of stat.contexts) {
        g.contexts.set(ctx, (g.contexts.get(ctx) ?? 0) + n);
      }
      global.set(tag, g);
    }
  }
  const ranking = [...global.entries()].sort(
    (a, b) => b[1].files - a[1].files || b[1].occurrences - a[1].occurrences || (a[0] < b[0] ? -1 : 1),
  );
  const importOk = rows.filter((r) => r.import === 'ok').length;
  const partial = rows.filter((r) => r.import === 'partial').length;
  const exportOk = rows.filter((r) => r.export === 'ok').length;

  let summary = `# GEDCOM corpus run — summary\n\n`;
  summary += `Corpus: \`${CORPUS_DIR}\` — ${rows.length} files processed, ${skipped} skipped\n`;
  summary += `Generated: ${new Date().toISOString()}\n\n`;
  summary += `## Import\n\n- ok (no errors): ${importOk}\n- partial (parsed with recorded errors): ${partial}\n- failed: ${importFailures.length}\n\n`;
  summary += `| code | occurrences |\n|---|---|\n`;
  for (const [code, n] of [...errorCounts].sort((a, b) => b[1] - a[1])) {
    summary += `| ${mdCell(code)} | ${n} |\n`;
  }
  summary += `\n## Export (same version as the import)\n\n- ok: ${exportOk}\n- failed: ${exportFailures.length}\n`;
  summary += `- skipped (import failed): ${rows.length - importOk - partial}\n\n`;
  summary += `| code | files | examples |\n|---|---|---|\n`;
  for (const [code, items] of byExportCode) {
    const examples = items.slice(0, MAX_EXAMPLES_PER_CODE).map((r) => `\`${r.relpath}\``).join(', ');
    summary += `| ${mdCell(code)} | ${items.length} | ${mdCell(examples)} |\n`;
  }
  summary += `\n## Generic tags (the ExtensionStructure / ExtensionRecord pile)\n\n`;
  summary += `- files carrying generic tags: ${withTags.length}\n`;
  summary += `- distinct tags: ${global.size}\n`;
  summary += `- total occurrences: ${totalOccurrences}\n\n`;
  summary += `| tag | files | occurrences | top contexts | legacy catalog |\n|---|---|---|---|---|\n`;
  for (const [tag, stat] of ranking) {
    const contexts = [...stat.contexts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CONTEXTS_IN_SUMMARY)
      .map(([ctx, n]) => (n > 1 ? `${ctx}×${n}` : ctx))
      .join(', ');
    summary += `| ${mdCell(tag)} | ${stat.files} | ${stat.occurrences} | ${mdCell(contexts)} | ${LEGACY_GENERIC_TAGS.has(tag) ? 'yes' : ''} |\n`;
  }
  summary += `\n## Import failures by corpus source\n\n| source | failed |\n|---|---|\n`;
  const bySource = groupBy(importFailures, (r) => r.relpath.split('/')[0] ?? '(root)');
  for (const [source, items] of [...bySource.entries()].sort((a, b) => b[1].length - a[1].length)) {
    summary += `| ${mdCell(source)} | ${items.length} |\n`;
  }
  summary += `\n## Method\n\n- Every file is read as bytes and passed to \`parseTolerant\` (the\n  detect entry: plain 7.0 / 5.5.1 stream or GEDZIP archive), which\n  records EVERY error of the file and keeps parsing; then serialized\n  back with the same-version serializer (7.0 → \`serializeGedcom70\`,\n  5.5.1 → \`serializeGedcom551\`, GEDZIP → \`serializeGedzip\`).\n- Generic tags are the \`ExtensionStructure\` / \`ExtensionRecord\`\n  occurrences in the parsed model — tags kept verbatim instead of a\n  typed field.\n- Export completeness (how much of the input survived the projection)\n  is not compared yet.\n- Skipped: \`logs/\`, \`manifest.jsonl\`, \`MANUAL-SOURCES.md\`,\n  \`MANUAL-GEDBAS.md\`, dotfiles.\n`;
  writeFileSync(join(OUT_DIR, 'summary.md'), summary);
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

test('the GEDCOM corpus run', () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const entries = readdirSync(CORPUS_DIR, { recursive: true, withFileTypes: true });
  const files: string[] = [];
  let skipped = 0;
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const rel = relative(CORPUS_DIR, join(entry.parentPath, entry.name));
    const top = rel.split('/')[0] ?? '';
    const base = basename(rel);
    if (top === 'logs' || SKIP_FILES.has(rel) || base.startsWith('.') || rel.split('/').includes('__MACOSX')) {
      skipped += 1;
      continue;
    }
    files.push(rel);
  }
  files.sort();
  const limit = process.env['DORU_LIMIT'] === undefined ? undefined : Number(process.env['DORU_LIMIT']);
  if (limit !== undefined && limit >= 0) {
    files.splice(limit);
  }

  const rows: CorpusRow[] = [];
  const fileStats: Array<{ relpath: string; stats: Map<string, TagStat> }> = [];
  const jsonlPath = join(OUT_DIR, 'results.jsonl');
  writeFileSync(jsonlPath, '');
  for (let i = 0; i < files.length; i++) {
    const rel = files[i] as string;
    const { row, stats } = runFile(rel);
    rows.push(row);
    if (stats.size > 0) {
      fileStats.push({ relpath: rel, stats });
    }
    appendFileSync(jsonlPath, `${JSON.stringify(row)}\n`);
    if ((i + 1) % 200 === 0) {
      console.log(`[corpus] ${i + 1}/${files.length} files processed`);
    }
  }

  writeReports(rows, fileStats, skipped);

  const importFailures = rows.filter((r) => r.import === 'fail');
  const partial = rows.filter((r) => r.import === 'partial');
  const exportFailures = rows.filter((r) => r.export === 'fail');
  const withTags = rows.filter((r) => r.tagOccurrences > 0);
  console.log(`\n[corpus] done: ${rows.length} files (${skipped} skipped)`);
  console.log(`[corpus] import: ${rows.length - importFailures.length - partial.length} clean, ${partial.length} partial, ${importFailures.length} failed`);
  console.log(`[corpus] export: ${rows.length - importFailures.length - exportFailures.length} ok, ${exportFailures.length} failed`);
  console.log(`[corpus] generic tags: ${withTags.length} files carry them`);
  console.log(`[corpus] reports written to ${OUT_DIR}`);
  expect(rows.length).toBeGreaterThan(0);
});
