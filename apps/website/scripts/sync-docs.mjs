import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const guideSrc = join(root, 'docs', 'user-guide.md');
const guideDest = join(root, 'apps', 'website', 'guide', 'user-guide.md');
mkdirSync(dirname(guideDest), { recursive: true });
const content = readFileSync(guideSrc, 'utf8');
writeFileSync(guideDest, `---\noutline: deep\n---\n\n${content}`);

const iconSrc = join(root, 'apps', 'desktop', 'resources', 'icon.svg');
const iconDest = join(root, 'apps', 'website', 'public', 'icon.svg');
mkdirSync(dirname(iconDest), { recursive: true });
copyFileSync(iconSrc, iconDest);

console.log('website docs synced');
