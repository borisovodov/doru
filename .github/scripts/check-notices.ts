// Notices guard: keeps the committed third-party notices data in
// packages/features/src/notices/generated.ts in sync with the workspace
// dependencies. CI (check:notices) fails when the committed file drifts from
// the generated output, so regenerate after changing dependencies:
//
//   node scripts/generate-notices.ts
//
// Usage: node .github/scripts/check-notices.ts (wired as `npm run check:notices`)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectNotices, renderNotices } from '../../scripts/generate-notices.ts';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

// Checkouts on Windows may normalize line endings; compare content only.
const normalize = (text: string): string => text.replace(/\r\n/g, '\n');

const committed = normalize(
  readFileSync(join(root, 'packages', 'features', 'src', 'notices', 'generated.ts'), 'utf8'),
);
const generated = normalize(renderNotices(collectNotices(root)));

if (committed !== generated) {
  console.error(
    'check-notices: packages/features/src/notices/generated.ts is out of sync — run scripts/generate-notices.ts',
  );
  process.exit(1);
}
console.log('check-notices: ok');
