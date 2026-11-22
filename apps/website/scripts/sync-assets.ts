import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const iconSrc = join(root, 'apps', 'desktop', 'build', 'Icon-256@1x.png');
const iconDest = join(root, 'apps', 'website', 'public', 'icon.png');
mkdirSync(dirname(iconDest), { recursive: true });
copyFileSync(iconSrc, iconDest);

console.log('website assets synced');
