// Renders the OpenGraph preview images: public/og-icon.png (icon over the
// wordmark) and public/og-shot.png (app screenshot). The design lives in
// og-image.html at 2x (2400x1260) for crisp text and is rendered with the
// repo's Electron binary (offscreen), then downscaled to the conventional
// 1200x630 with sips (macOS). Run: npm run og-images -w @doru/website
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const websiteRoot = join(scriptsDir, '..');
const repoRoot = join(scriptsDir, '..', '..', '..');
const publicDir = join(websiteRoot, 'public');

const b64 = (path: string): string => readFileSync(path).toString('base64');

const template = readFileSync(join(scriptsDir, 'og-image.html'), 'utf8')
  .replaceAll('__FONT_B64__', b64(join(publicDir, 'fonts', 'berkshire-swash-latin-400-normal.woff2')))
  .replaceAll('__ICON_B64__', b64(join(repoRoot, 'apps', 'desktop', 'build', 'Icon-512@1x.png')))
  .replaceAll('__SHOT_B64__', b64(join(publicDir, 'screenshot.png')));

const tmp = mkdtempSync(join(tmpdir(), 'doru-og-'));
const htmlPath = join(tmp, 'design.html');
writeFileSync(htmlPath, template);

const exitCode = await new Promise<number | null>((resolve) => {
  const child = spawn(electronPath, [join(scriptsDir, 'og-main.mjs'), htmlPath, tmp], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => resolve(code));
});
if (exitCode !== 0) {
  rmSync(tmp, { recursive: true, force: true });
  process.exit(exitCode ?? 1);
}

for (const name of ['og-icon', 'og-shot'] as const) {
  const src = join(tmp, `${name}.png`);
  const dest = join(publicDir, `${name}.png`);
  try {
    execFileSync('sips', ['--resampleWidth', '1200', src, '--out', dest], { stdio: 'inherit' });
  } catch {
    // No sips outside macOS: keep the 2x render as-is.
    writeFileSync(dest, readFileSync(src));
  }
  console.log(`${dest} written`);
}
rmSync(tmp, { recursive: true, force: true });
