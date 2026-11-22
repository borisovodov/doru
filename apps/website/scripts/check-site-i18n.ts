import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  SOURCE_PAGES,
  TRANSLATED_LOCALES,
  codeBlocks,
  codeFenceCount,
  contentHash,
  hasH1,
  headingAnchors,
  headingLevels,
  isDocPage,
  listItemCount,
  readSourceHash,
  relativeLinks,
  relativeLinkTargets,
  sourceFile,
  tableRowCount,
  targetFile,
  websiteRoot,
} from './site-i18n.ts';

const reportOnly = process.argv.includes('--report');
const docPages = SOURCE_PAGES.filter(isDocPage).map((page) => page.slice('docs/'.length));
const errors: string[] = [];

for (const locale of TRANSLATED_LOCALES) {
  const localeDocs = join(websiteRoot, locale, 'docs');
  if (!existsSync(localeDocs)) {
    errors.push(`${locale}: missing docs directory`);
  } else {
    const extra = readdirSync(localeDocs)
      .filter((name) => name.endsWith('.md') && !docPages.includes(name))
      .sort();
    for (const name of extra) errors.push(`${locale}: extra docs/${name}`);
  }

  for (const page of SOURCE_PAGES) {
    const target = targetFile(locale, page);
    if (!existsSync(target)) {
      errors.push(`${locale}: missing ${page}`);
      continue;
    }

    const text = readFileSync(target, 'utf8');
    const expected = contentHash(sourceFile(page));
    const actual = readSourceHash(text);

    if (actual === undefined) {
      errors.push(`${locale}: ${page}: missing source-hash`);
    } else if (actual !== expected) {
      errors.push(`${locale}: ${page}: stale source-hash (expected ${expected}, found ${actual})`);
    }

    if (isDocPage(page)) {
      if (!hasH1(text)) {
        errors.push(`${locale}: ${page}: missing H1`);
        continue;
      }

      if (page === 'docs/installation.md') {
        for (const anchor of ['{#macos}', '{#linux}', '{#windows-experimental}']) {
          if (!text.includes(anchor)) errors.push(`${locale}: ${page}: missing ${anchor} anchor`);
        }
      }

      const sourceText = readFileSync(sourceFile(page), 'utf8');
      if (headingLevels(text).join('') !== headingLevels(sourceText).join('')) {
        errors.push(`${locale}: ${page}: heading structure differs from English`);
      }
      if (relativeLinkTargets(text).join('\n') !== relativeLinkTargets(sourceText).join('\n')) {
        errors.push(`${locale}: ${page}: relative links differ from English`);
      }
      if (codeFenceCount(text) !== codeFenceCount(sourceText)) {
        errors.push(`${locale}: ${page}: code block count differs from English`);
      }
      if (listItemCount(text) !== listItemCount(sourceText)) {
        errors.push(`${locale}: ${page}: list item count differs from English`);
      }
      if (tableRowCount(text) !== tableRowCount(sourceText)) {
        errors.push(`${locale}: ${page}: table row count differs from English`);
      }
      const sourceCode = codeBlocks(sourceText).filter((block) => block.info !== '');
      const targetCode = codeBlocks(text).filter((block) => block.info !== '');
      if (JSON.stringify(targetCode) !== JSON.stringify(sourceCode)) {
        errors.push(`${locale}: ${page}: code block content differs from English`);
      }

      for (const link of relativeLinks(text)) {
        if (link.fragment === undefined || link.fragment === '') continue;
        let linkedFile = link.target === '' ? target : resolve(dirname(target), link.target);
        if (!existsSync(linkedFile)) continue;
        if (statSync(linkedFile).isDirectory()) linkedFile = join(linkedFile, 'index.md');
        if (!existsSync(linkedFile)) continue;
        let fragment = link.fragment;
        try {
          fragment = decodeURIComponent(fragment);
        } catch {
          /* keep the raw fragment */
        }
        if (!headingAnchors(readFileSync(linkedFile, 'utf8')).has(fragment)) {
          errors.push(`${locale}: ${page}: missing anchor #${fragment} in ${link.target}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`site i18n check failed (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`  - ${error}`);
  if (!reportOnly) process.exit(1);
} else {
  console.log(`site i18n check passed (${TRANSLATED_LOCALES.length} locales, ${SOURCE_PAGES.length} pages each)`);
}
