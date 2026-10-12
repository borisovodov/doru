import { cpSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const guideSrc = join(root, 'docs', 'guide');
const guideDest = join(root, 'apps', 'website', 'docs');
rmSync(guideDest, { recursive: true, force: true });
mkdirSync(dirname(guideDest), { recursive: true });
cpSync(guideSrc, guideDest, { recursive: true });

const iconSrc = join(root, 'apps', 'desktop', 'resources', 'icon.svg');
const iconDest = join(root, 'apps', 'website', 'public', 'icon.svg');
mkdirSync(dirname(iconDest), { recursive: true });
copyFileSync(iconSrc, iconDest);

console.log('website docs synced');
