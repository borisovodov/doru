// Writes the published JSON Schemas (apps/website/public/{settings,theme}.json)
// from the zod schemas in apps/desktop/src/main/schemas.ts. CI
// (check:schemas) fails when the committed files drift from the generated
// output, so run this after editing the zod schemas:
//
//   node scripts/generate-schemas.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingsJsonSchema, themeJsonSchema } from '../apps/desktop/src/main/schemas.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, 'apps', 'website', 'public');
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'settings.json'), `${JSON.stringify(settingsJsonSchema(), null, 2)}\n`);
writeFileSync(join(publicDir, 'theme.json'), `${JSON.stringify(themeJsonSchema(), null, 2)}\n`);
console.log('published schemas written to apps/website/public/');
