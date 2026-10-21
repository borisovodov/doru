// Schema guard: keeps the published JSON Schemas in apps/website/public/ in
// sync with the zod schemas that generate them
// (apps/desktop/src/main/schemas.ts), and validates the shipped settings
// template and bundled themes with the same zod schemas the app uses at
// runtime.
//
// Usage: node .github/scripts/check-schemas.ts (wired as `npm run check:schemas`)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { ParseError } from 'jsonc-parser';
import { z } from 'zod';
import {
  SETTINGS_SCHEMA_URL,
  THEME_SCHEMA_URL,
  SettingsFileSchema,
  ThemeFileSchema,
  settingsJsonSchema,
  themeJsonSchema,
} from '../../apps/desktop/src/main/schemas.ts';

const require = createRequire(import.meta.url);
const { parse } = require('jsonc-parser') as {
  parse(
    text: string,
    errors: ParseError[],
    options: { disallowComments: boolean; allowTrailingComma: boolean },
  ): unknown;
};

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const PUBLIC_DIR = join(root, 'apps', 'website', 'public');
const SETTINGS_TS = join(root, 'apps', 'desktop', 'src', 'main', 'settings.ts');
const THEMES_DIR = join(root, 'themes');

const findings: string[] = [];
const report = (message: string): void => {
  findings.push(message);
};

const generated = (schema: Record<string, unknown>): string => `${JSON.stringify(schema, null, 2)}\n`;

// Checkouts on Windows may normalize line endings; compare content only.
const normalize = (text: string): string => text.replace(/\r\n/g, '\n');

// 1. The published schemas must match the zod-generated output.
if (normalize(readFileSync(join(PUBLIC_DIR, 'settings.json'), 'utf8')) !== generated(settingsJsonSchema())) {
  report('apps/website/public/settings.json is out of sync with the zod schema — run scripts/generate-schemas.ts');
}
if (normalize(readFileSync(join(PUBLIC_DIR, 'theme.json'), 'utf8')) !== generated(themeJsonSchema())) {
  report('apps/website/public/theme.json is out of sync with the zod schema — run scripts/generate-schemas.ts');
}

// 2. The DEFAULT_SETTINGS template in settings.ts: what new users get. It must
//    parse as JSONC, satisfy the settings schema and carry the $schema
//    reference.
const source = readFileSync(SETTINGS_TS, 'utf8');
const match = /DEFAULT_SETTINGS = `([\s\S]*?)`;/.exec(source);
if (!match || match[1] === undefined) {
  report(`could not extract the DEFAULT_SETTINGS template from ${SETTINGS_TS}`);
} else {
  const parseErrors: ParseError[] = [];
  const template = parse(match[1], parseErrors, {
    disallowComments: false,
    allowTrailingComma: true,
  }) as Record<string, unknown>;
  if (parseErrors.length > 0) {
    report(`DEFAULT_SETTINGS template is not valid JSONC: ${parseErrors[0]?.error ?? 'parse error'}`);
  } else {
    if (template['$schema'] !== SETTINGS_SCHEMA_URL) {
      report(`DEFAULT_SETTINGS template must reference ${SETTINGS_SCHEMA_URL}`);
    }
    const result = SettingsFileSchema.safeParse(template);
    if (!result.success) {
      report(`DEFAULT_SETTINGS template violates the settings schema:\n${z.prettifyError(result.error)}`);
    }
  }
}

// 3. Bundled themes: every file must parse, satisfy the theme schema and
//    carry the $schema reference so editors validate user edits.
for (const name of readdirSync(THEMES_DIR).filter((entry) => entry.endsWith('.json'))) {
  const path = join(THEMES_DIR, name);
  let theme: unknown;
  try {
    theme = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    report(`invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }
  if ((theme as Record<string, unknown>)['$schema'] !== THEME_SCHEMA_URL) {
    report(`${path} must reference ${THEME_SCHEMA_URL}`);
  }
  const result = ThemeFileSchema.safeParse(theme);
  if (!result.success) {
    report(`${path} violates the theme schema:\n${z.prettifyError(result.error)}`);
  }
}

if (findings.length > 0) {
  for (const message of findings) {
    console.error(`check-schemas: ${message}`);
  }
  console.error(`check-schemas: ${findings.length} problem(s)`);
  process.exit(1);
}
console.log('check-schemas: ok');
