import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  SOURCE_PAGES,
  TRANSLATED_LOCALES,
  contentHash,
  hasH1,
  isDocPage,
  sourceFile,
  targetFile,
  withSourceHash,
} from './site-i18n.ts';

const args = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const valid = new Set<string>(TRANSLATED_LOCALES);
const pages = new Set<string>(SOURCE_PAGES);
const locales = args.filter((arg) => valid.has(arg));
const pageArgs = args
  .filter((arg) => !valid.has(arg))
  .map((arg) => (pages.has(arg) || arg.startsWith('docs/') ? arg : `docs/${arg}`));
const invalidPages = pageArgs.filter((page) => !pages.has(page));
if (invalidPages.length > 0) {
  console.error(`unknown locale or page: ${invalidPages.join(', ')}`);
  console.error(`locales: ${TRANSLATED_LOCALES.join(', ')}`);
  console.error(`pages: ${[...pages].join(', ')}`);
  process.exit(1);
}

const selectedLocales = locales.length > 0 ? locales : [...TRANSLATED_LOCALES];
const selectedPages = pageArgs.length > 0 ? pageArgs : [...SOURCE_PAGES];
const errors: string[] = [];
let updated = 0;

for (const locale of selectedLocales) {
  for (const page of selectedPages) {
    const target = targetFile(locale, page);
    if (!existsSync(target)) {
      errors.push(`${locale}: missing ${page}`);
      continue;
    }

    const text = readFileSync(target, 'utf8');
    if (isDocPage(page) && !hasH1(text)) {
      errors.push(`${locale}: ${page}: missing H1`);
      continue;
    }

    const next = withSourceHash(text, contentHash(sourceFile(page)));
    if (next !== text) {
      writeFileSync(target, next);
      updated += 1;
    }
  }
}

if (errors.length > 0) {
  console.error(`site i18n stamp failed (${errors.length} problem${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`site i18n stamped ${updated} file${updated === 1 ? '' : 's'} across ${selectedLocales.length} locales`);
